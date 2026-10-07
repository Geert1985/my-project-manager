function createTask({ projectId, parentId = null, name, description = "", priority = "normal" }) {
  const task = {
    id: crypto.randomUUID(),
    projectId,
    parentId,
    name,
    description,
    status: "not_started",
    priority,
    completionMode: "manual",
    createdAt: new Date().toISOString(),
    completedAt: null
  };
  state.tasks.push(task);
  saveState();
  return task;
}

function getProjectTasks(projectId) {
  return state.tasks.filter(t => t.projectId === projectId);
}

function getChildren(taskId) {
  return state.tasks.filter(t => t.parentId === taskId);
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

/*
 * Re-evaluate parents after a child changed.
 *
 * Important: a manually completed parent is deliberately preserved.
 * This prevents a later child change from unexpectedly reopening a
 * parent that the user explicitly marked as completed.
 */
function reconcileAncestors(task) {
  let parentId = task.parentId;

  while (parentId) {
    const parent = state.tasks.find(t => t.id === parentId);
    if (!parent) break;

    const children = getChildren(parent.id);

    if (children.length > 0) {
      const allCompleted = children.every(child => child.status === "completed");
      const someCompleted = children.some(child => child.status === "completed");

      if (allCompleted) {
        if (!(parent.status === "completed" && parent.completionMode === "manual")) {
          updateTaskState(parent, "completed", "automatic");
        }
      } else if (parent.status === "completed" && parent.completionMode === "automatic") {
        updateTaskState(parent, someCompleted ? "in_progress" : "not_started", "automatic");
      } else if (parent.status !== "completed") {
        parent.status = someCompleted ? "in_progress" : "not_started";
        parent.completedAt = null;
      }
    }

    parentId = parent.parentId;
  }
}

function setTaskCompleted(taskId, completed, mode = "manual") {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  if (completed) {
    updateTaskState(task, "completed", mode);
  } else {
    const children = getChildren(task.id);
    const someCompleted = children.some(child => child.status === "completed");
    updateTaskState(task, someCompleted ? "in_progress" : "not_started", mode);
  }

  // A direct user action is saved first. Ancestors are then reconciled.
  reconcileAncestors(task);
  saveState();
}

function deleteTask(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  const parentId = task?.parentId || null;

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

  state.tasks = state.tasks.filter(t => !ids.has(t.id));

  if (parentId) {
    const parent = state.tasks.find(t => t.id === parentId);
    if (parent) reconcileAncestors(parent);
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
