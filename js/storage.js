const STORAGE_KEY = "my-project-manager-v0.1";

const defaultState = {
  projects: [],
  tasks: []
};

function normalizeState(raw) {
  const normalized = raw && typeof raw === "object" ? raw : structuredClone(defaultState);

  normalized.projects = Array.isArray(normalized.projects) ? normalized.projects : [];
  normalized.tasks = Array.isArray(normalized.tasks) ? normalized.tasks : [];

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
