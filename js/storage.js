const STORAGE_KEY = "my-project-manager-v0.1";

const defaultState = {
  projects: [],
  tasks: [],
  sources: [],
  sourceVersions: [],
  protocols: [],
  protocolItems: [],
  checks: [],
  checkResults: [],
  reviews: []
};

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeState(raw) {
  const normalized = raw && typeof raw === "object"
    ? raw
    : structuredClone(defaultState);

  normalized.projects = normalizeArray(normalized.projects);
  normalized.tasks = normalizeArray(normalized.tasks);

  // v0.2 collections. Older localStorage data receives empty collections.
  normalized.sources = normalizeArray(normalized.sources);
  normalized.sourceVersions = normalizeArray(normalized.sourceVersions);
  normalized.protocols = normalizeArray(normalized.protocols);
  normalized.protocolItems = normalizeArray(normalized.protocolItems);
  normalized.checks = normalizeArray(normalized.checks);
  normalized.checkResults = normalizeArray(normalized.checkResults);
  normalized.reviews = normalizeArray(normalized.reviews);

  // Migrate tasks created before completionMode existed.
  normalized.tasks = normalized.tasks.map(task => ({
    ...task,
    completionMode: task.completionMode || "manual"
  }));

  return normalized;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : structuredClone(defaultState);
  } catch (error) {
    console.error("Kon gegevens niet laden:", error);
    return structuredClone(defaultState);
  }
}

let state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
