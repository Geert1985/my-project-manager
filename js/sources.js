function createSource({ projectId, taskId = null, type = "document", title, author = "", publisher = "", url = "", description = "" }) {
  if (!state.projects.some(project => project.id === projectId)) {
    throw new Error("Project bestaat niet.");
  }

  if (!title || !title.trim()) {
    throw new Error("Een bronnaam is verplicht.");
  }

  if (taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) throw new Error("Taak bestaat niet.");
    if (task.projectId !== projectId) {
      throw new Error("De bron en taak moeten bij hetzelfde project horen.");
    }
  }

  const source = {
    id: crypto.randomUUID(),
    projectId,
    taskId,
    type,
    title: title.trim(),
    author: author.trim(),
    publisher: publisher.trim(),
    url: url.trim(),
    description: description.trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  state.sources.push(source);
  saveState();
  return source;
}

function getSource(sourceId) {
  return state.sources.find(source => source.id === sourceId);
}

function getProjectSources(projectId) {
  return state.sources.filter(source => source.projectId === projectId);
}

function getTaskSources(taskId) {
  return state.sources.filter(source => source.taskId === taskId);
}

function createSourceVersion({
  sourceId,
  version,
  label = "",
  contentHash = "",
  fileName = "",
  filePath = "",
  url = "",
  notes = ""
}) {
  const source = getSource(sourceId);
  if (!source) throw new Error("Bron bestaat niet.");

  if (!version || !version.trim()) {
    throw new Error("Een bronversie heeft een versienummer of versie-id nodig.");
  }

  const existing = state.sourceVersions.find(
    item => item.sourceId === sourceId && item.version === version.trim()
  );

  if (existing) {
    throw new Error("Deze bronversie bestaat al.");
  }

  const sourceVersion = {
    id: crypto.randomUUID(),
    sourceId,
    version: version.trim(),
    label: label.trim(),
    contentHash: contentHash.trim(),
    fileName: fileName.trim(),
    filePath: filePath.trim(),
    url: url.trim(),
    notes: notes.trim(),
    createdAt: new Date().toISOString()
  };

  state.sourceVersions.push(sourceVersion);
  source.updatedAt = new Date().toISOString();
  saveState();
  return sourceVersion;
}

function getSourceVersions(sourceId) {
  return state.sourceVersions
    .filter(version => version.sourceId === sourceId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function getSourceVersion(sourceVersionId) {
  return state.sourceVersions.find(version => version.id === sourceVersionId);
}


function getSourceDeletionState(sourceId) {
  const source = getSource(sourceId);
  if (!source) return { allowed: false, reason: "Bron bestaat niet." };

  const versionIds = new Set(getSourceVersions(sourceId).map(version => version.id));
  const linkedChecks = state.checks.filter(check => versionIds.has(check.sourceVersionId));

  if (linkedChecks.length) {
    return {
      allowed: false,
      reason: `Deze bron kan niet worden verwijderd omdat ${linkedChecks.length} controle${linkedChecks.length === 1 ? "" : "s"} aan een bronversie gekoppeld ${linkedChecks.length === 1 ? "is" : "zijn"}. De historische controleketen blijft behouden.`
    };
  }

  return { allowed: true, reason: "" };
}

function deleteSource(sourceId) {
  const deletion = getSourceDeletionState(sourceId);
  if (!deletion.allowed) throw new Error(deletion.reason);

  state.sources = state.sources.filter(source => source.id !== sourceId);
  state.sourceVersions = state.sourceVersions.filter(version => version.sourceId !== sourceId);
  saveState();
}
