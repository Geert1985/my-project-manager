const STORAGE_KEY = "my-project-manager-v0.1";

const defaultState = {
  projects: [],
  tasks: [],
  sources: [],
  sourceVersions: [],
  protocols: [],
  protocolVersions: [],
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
  normalized.protocolVersions = normalizeArray(normalized.protocolVersions);
  normalized.protocolItems = normalizeArray(normalized.protocolItems);
  normalized.checks = normalizeArray(normalized.checks);
  normalized.checkResults = normalizeArray(normalized.checkResults);
  normalized.reviews = normalizeArray(normalized.reviews);

  // Migrate tasks created before completionMode existed.
  normalized.tasks = normalized.tasks.map(task => ({
    ...task,
    completionMode: task.completionMode || "manual"
  }));

  // v0.4 migration: create a historical ProtocolVersion for every
  // existing Protocol and connect existing ProtocolItems and Checks to it.
  // The migration is idempotent because the schema marker is persisted.
  if ((normalized.schemaVersion || 1) < 4) {
    const now = new Date().toISOString();

    for (const protocol of normalized.protocols) {
      let version = normalized.protocolVersions.find(
        item => item.protocolId === protocol.id && item.version === protocol.version
      );

      if (!version) {
        version = {
          id: crypto.randomUUID(),
          protocolId: protocol.id,
          version: protocol.version,
          description: protocol.description || "",
          status: "active",
          createdAt: protocol.createdAt || now
        };
        normalized.protocolVersions.push(version);
      }

      normalized.protocolItems
        .filter(item => item.protocolId === protocol.id && !item.protocolVersionId)
        .forEach(item => {
          item.protocolVersionId = version.id;
        });

      normalized.checks
        .filter(check => check.protocolId === protocol.id && !check.protocolVersionId)
        .forEach(check => {
          check.protocolVersionId = version.id;
        });
    }

    normalized.schemaVersion = 4;
  }

  return normalized;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const loaded = raw ? normalizeState(JSON.parse(raw)) : structuredClone(defaultState);
    if (raw && loaded.schemaVersion === 4) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
    }
    return loaded;
  } catch (error) {
    console.error("Kon gegevens niet laden:", error);
    return structuredClone(defaultState);
  }
}

let state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
