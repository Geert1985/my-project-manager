function createProtocol({ name, description = "", version = "1.0", active = true }) {
  if (!name || !name.trim()) throw new Error("Een protocolnaam is verplicht.");
  if (!version || !version.trim()) throw new Error("Een protocolversie is verplicht.");

  const protocol = {
    id: crypto.randomUUID(),
    name: name.trim(),
    description: description.trim(),
    version: version.trim(),
    active: Boolean(active),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  state.protocols.push(protocol);

  state.protocolVersions.push({
    id: crypto.randomUUID(),
    protocolId: protocol.id,
    version: protocol.version,
    description: protocol.description,
    status: "active",
    createdAt: protocol.createdAt
  });

  saveState();
  return protocol;
}

function getProtocol(protocolId) {
  return state.protocols.find(protocol => protocol.id === protocolId);
}

function getProtocolVersion(protocolVersionId) {
  return state.protocolVersions.find(version => version.id === protocolVersionId);
}

function getProtocolVersions(protocolId) {
  return state.protocolVersions
    .filter(version => version.protocolId === protocolId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function getActiveProtocolVersion(protocolId) {
  return getProtocolVersions(protocolId).find(version => version.status === "active")
    || getProtocolVersions(protocolId)[getProtocolVersions(protocolId).length - 1]
    || null;
}

function getProtocolItems(protocolId) {
  return state.protocolItems
    .filter(item => item.protocolId === protocolId)
    .sort((a, b) => a.order - b.order);
}

function getProtocolItemsForVersion(protocolVersionId) {
  return state.protocolItems
    .filter(item => item.protocolVersionId === protocolVersionId)
    .sort((a, b) => a.order - b.order);
}

function createProtocolVersion({ protocolId, version, description = "", copyFromVersionId = null }) {
  const protocol = getProtocol(protocolId);
  if (!protocol) throw new Error("Protocol bestaat niet.");
  if (!version || !version.trim()) throw new Error("Een protocolversie is verplicht.");

  const versionName = version.trim();
  if (getProtocolVersions(protocolId).some(existing => existing.version === versionName)) {
    throw new Error("Deze protocolversie bestaat al.");
  }

  let sourceVersion = null;
  if (copyFromVersionId) {
    sourceVersion = getProtocolVersion(copyFromVersionId);
    if (!sourceVersion || sourceVersion.protocolId !== protocolId) {
      throw new Error("De bronversie bestaat niet binnen dit protocol.");
    }
  }

  const now = new Date().toISOString();
  const newVersion = {
    id: crypto.randomUUID(),
    protocolId,
    version: versionName,
    description: description.trim(),
    status: "draft",
    createdAt: now
  };

  state.protocolVersions.push(newVersion);

  if (sourceVersion) {
    const sourceItems = getProtocolItemsForVersion(sourceVersion.id);
    sourceItems.forEach(sourceItem => {
      state.protocolItems.push({
        id: crypto.randomUUID(),
        protocolId,
        protocolVersionId: newVersion.id,
        order: sourceItem.order,
        title: sourceItem.title,
        description: sourceItem.description || "",
        required: Boolean(sourceItem.required),
        createdAt: now,
        updatedAt: now
      });
    });
  }

  protocol.updatedAt = now;
  saveState();
  return newVersion;
}

function createProtocolItem({ protocolId, protocolVersionId = null, title, description = "", required = true }) {
  const protocol = getProtocol(protocolId);
  if (!protocol) throw new Error("Protocol bestaat niet.");
  if (!title || !title.trim()) throw new Error("Een controlepunt heeft een titel nodig.");

  const version = protocolVersionId
    ? getProtocolVersion(protocolVersionId)
    : getActiveProtocolVersion(protocolId);

  if (!version || version.protocolId !== protocolId) {
    throw new Error("De protocolversie bestaat niet binnen dit protocol.");
  }
  if (state.checks.some(check => check.protocolVersionId === version.id)) {
    throw new Error("Deze protocolversie is al in gebruik en kan niet meer worden aangepast.");
  }

  const items = getProtocolItemsForVersion(version.id);
  const nextOrder = items.length ? Math.max(...items.map(item => item.order)) + 1 : 1;

  const item = {
    id: crypto.randomUUID(),
    protocolId,
    protocolVersionId: version.id,
    order: nextOrder,
    title: title.trim(),
    description: description.trim(),
    required: Boolean(required),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  state.protocolItems.push(item);
  protocol.updatedAt = new Date().toISOString();
  saveState();
  return item;
}

function deleteProtocolItem(protocolItemId) {
  state.protocolItems = state.protocolItems.filter(item => item.id !== protocolItemId);
  saveState();
}
