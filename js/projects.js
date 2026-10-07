function createProject({ name, description = "", category = "" }) {
  const project = {
    id: crypto.randomUUID(),
    name,
    description,
    category,
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
  state.projects = state.projects.filter(p => p.id !== projectId);
  state.tasks = state.tasks.filter(t => t.projectId !== projectId);
  saveState();
}
