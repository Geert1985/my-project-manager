function createTask({ projectId, parentId = null, name, description = "", priority = "normal" }) {
  const task = {
    id: crypto.randomUUID(),
    projectId,
    parentId,
    name,
    description,
    status: "not_started",
    priority,
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

function setTaskCompleted(taskId, completed) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  task.status = completed ? "completed" : "not_started";
  task.completedAt = completed ? new Date().toISOString() : null;
  saveState();
}

function deleteTask(taskId) {
  const ids = new Set([taskId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const task of state.tasks) {
      if (task.parentId && ids.has(task.parentId) && !ids.has(task.id)) {
        ids.add(task.id); changed = true;
      }
    }
  }
  state.tasks = state.tasks.filter(t => !ids.has(t.id));
  saveState();
}

function getTaskStats(projectId, parentId = null) {
  const tasks = getProjectTasks(projectId).filter(t => t.parentId === parentId);
  const descendants = [];
  const collect = parent => {
    const children = getChildren(parent);
    descendants.push(...children);
    children.forEach(c => collect(c.id));
  };
  tasks.forEach(t => collect(t.id));
  const all = [...tasks, ...descendants];
  const completed = all.filter(t => t.status === "completed").length;
  return { total: all.length, completed, percent: all.length ? Math.round(completed / all.length * 100) : 0 };
}
