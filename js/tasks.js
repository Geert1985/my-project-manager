function createTask({ projectId, parentId = null, name, description = "", priority = "normal" }) {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) {
    throw new Error("Project bestaat niet.");
  }

  if (!name || !name.trim()) {
    throw new Error("Een taaknaam is verplicht.");
  }

  if (parentId) {
    const parent = state.tasks.find(t => t.id === parentId);

    if (!parent) {
      throw new Error("Parent-taak bestaat niet.");
    }

    if (parent.projectId !== projectId) {
      throw new Error("Een subtaak moet bij hetzelfde project horen als de parent.");
    }
  }

  const task = {
    id: crypto.randomUUID(),
    projectId,
    parentId,
    sortOrder: getSiblingTasks(projectId, parentId).reduce((max, sibling) =>
      Math.max(max, sibling.sortOrder), -1) + 1,
    name: name.trim(),
    description: description.trim(),
    status: "not_started",
    priority,
    completionMode: "manual",
    createdAt: new Date().toISOString(),
    completedAt: null
  };

  state.tasks.push(task);

  // A newly added child represents new work. A completed parent
  // therefore becomes in_progress, regardless of how it was completed.
  if (parentId) {
    const parent = state.tasks.find(t => t.id === parentId);
    if (parent && parent.status === "completed") {
      updateTaskState(parent, "in_progress", "manual");
      const ancestor = state.tasks.find(t => t.id === parent.parentId);
      if (ancestor) reconcileTaskAndAncestors(ancestor);
    } else if (parent) {
      reconcileTaskAndAncestors(parent);
    }
  }

  saveState();
  return task;
}

function getProjectTasks(projectId) {
  return state.tasks.filter(t => t.projectId === projectId);
}

function getChildren(taskId) {
  const parent = state.tasks.find(task => task.id === taskId);
  return parent ? getSiblingTasks(parent.projectId, taskId) : [];
}

function getSiblingTasks(projectId, parentId = null) {
  return state.tasks
    .filter(task => task.projectId === projectId && (task.parentId || null) === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function getProjectTasksInTreeOrder(projectId) {
  const ordered = [];
  const collect = parentId => {
    for (const task of getSiblingTasks(projectId, parentId)) {
      ordered.push(task);
      collect(task.id);
    }
  };
  collect(null);
  return ordered;
}

function moveTask(taskId, direction) {
  if (!["up", "down"].includes(direction)) throw new Error("Ongeldige verplaatsing.");
  const task = state.tasks.find(item => item.id === taskId);
  if (!task) throw new Error("Taak bestaat niet.");
  const siblings = getSiblingTasks(task.projectId, task.parentId || null);
  const index = siblings.findIndex(item => item.id === taskId);
  const targetIndex = index + (direction === "up" ? -1 : 1);
  if (targetIndex < 0 || targetIndex >= siblings.length) return false;

  [siblings[index], siblings[targetIndex]] = [siblings[targetIndex], siblings[index]];
  siblings.forEach((sibling, order) => { sibling.sortOrder = order; });
  saveState();
  return true;
}

function updateTaskState(task, status, completionMode) {
  task.status = status;
  task.completionMode = completionMode;

  if (status === "completed") {
    task.completedAt = task.completedAt || new Date().toISOString();
  } else {
    task.completedAt = null;
  }
}

function reconcileTask(task) {
  const children = getChildren(task.id);
  if (!children.length) return;

  const allCompleted = children.every(child => child.status === "completed");
  const someCompleted = children.some(child => child.status === "completed");

  if (allCompleted) {
    // Preserve an explicit manual completion.
    if (!(task.status === "completed" && task.completionMode === "manual")) {
      updateTaskState(task, "completed", "automatic");
    }
    return;
  }

  // Only automatically completed parents are automatically reopened.
  if (task.status === "completed" && task.completionMode === "automatic") {
    updateTaskState(task, "in_progress", "automatic");
    return;
  }

  // A non-completed parent reflects child progress.
  if (task.status !== "completed") {
    task.status = someCompleted ? "in_progress" : "not_started";
    task.completedAt = null;
  }
}

function reconcileTaskAndAncestors(task) {
  reconcileTask(task);

  let parentId = task.parentId;

  while (parentId) {
    const parent = state.tasks.find(t => t.id === parentId);
    if (!parent) break;

    reconcileTask(parent);
    parentId = parent.parentId;
  }
}

function completeDescendants(taskId) {
  const children = getChildren(taskId);

  for (const child of children) {
    updateTaskState(child, "completed", "manual");
    completeDescendants(child.id);
  }
}

function setTaskCompleted(taskId, completed, mode = "manual") {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  if (completed) {
    updateTaskState(task, "completed", mode);

    // A manual completion of a parent cascades to all descendants.
    // Automatic completion does not need to do this because all children
    // are already completed by definition.
    if (mode === "manual") {
      completeDescendants(task.id);
    }
  } else {
    const children = getChildren(task.id);
    const someCompleted = children.some(child => child.status === "completed");
    updateTaskState(task, someCompleted ? "in_progress" : "not_started", mode);
  }

  // An explicit reopen must survive this action even if every child is done.
  // Subsequent child changes still reconcile this parent normally.
  if (!completed && mode === "manual") {
    const parent = state.tasks.find(t => t.id === task.parentId);
    if (parent) reconcileTaskAndAncestors(parent);
  } else {
    reconcileTaskAndAncestors(task);
  }
  saveState();
}

function deleteTask(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  const parentId = task.parentId || null;

  const ids = new Set([taskId]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const current of state.tasks) {
      if (current.parentId && ids.has(current.parentId) && !ids.has(current.id)) {
        ids.add(current.id);
        changed = true;
      }
    }
  }

  const sourceIds = new Set(state.sources.filter(source => ids.has(source.taskId)).map(source => source.id));
  assertDeletionPreservesHistory(ids, sourceIds);

  state.tasks = state.tasks.filter(t => !ids.has(t.id));
  state.sources = state.sources.filter(source => !sourceIds.has(source.id));
  state.sourceVersions = state.sourceVersions.filter(version => !sourceIds.has(version.sourceId));

  // Recalculate the parent itself after deleting its child.
  if (parentId) {
    const parent = state.tasks.find(t => t.id === parentId);
    if (parent) reconcileTaskAndAncestors(parent);
  }

  saveState();
}

function getTaskStats(projectId, parentId = null) {
  const tasks = getProjectTasks(projectId).filter(t => t.parentId === parentId);
  const descendants = [];

  const collect = parent => {
    const children = getChildren(parent);
    descendants.push(...children);
    children.forEach(child => collect(child.id));
  };

  tasks.forEach(task => collect(task.id));

  const all = [...tasks, ...descendants];
  const completed = all.filter(t => t.status === "completed").length;

  return {
    total: all.length,
    completed,
    percent: all.length ? Math.round(completed / all.length * 100) : 0
  };
}
