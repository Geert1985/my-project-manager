function createProject({ name, description = "", category = "" }) {
  if (!name || !name.trim()) {
    throw new Error("Een projectnaam is verplicht.");
  }

  const project = {
    id: crypto.randomUUID(),
    name: name.trim(),
    description: description.trim(),
    category: category.trim(),
    status: "active",
    priority: "normal",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  state.projects.push(project);
  saveState();
  return project;
}

function getProject(projectId) {
  return state.projects.find(p => p.id === projectId);
}

function deleteProject(projectId) {
  const taskIds = new Set(
    state.tasks.filter(task => task.projectId === projectId).map(task => task.id)
  );

  const sourceIds = new Set(
    state.sources
      .filter(source => source.projectId === projectId || taskIds.has(source.taskId))
      .map(source => source.id)
  );

  assertDeletionPreservesHistory(taskIds, sourceIds);

  state.projects = state.projects.filter(p => p.id !== projectId);
  state.tasks = state.tasks.filter(task => !taskIds.has(task.id));
  state.sources = state.sources.filter(source => !sourceIds.has(source.id));
  state.sourceVersions = state.sourceVersions.filter(version => !sourceIds.has(version.sourceId));

  saveState();
}
