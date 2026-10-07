const STORAGE_KEY = "my-project-manager-v0.1";

const defaultState = {
  projects: [],
  tasks: []
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : structuredClone(defaultState);
  } catch (error) {
    console.error("Kon gegevens niet laden:", error);
    return structuredClone(defaultState);
  }
}

let state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
