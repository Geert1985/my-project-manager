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

function createProtocolItem({ protocolId, title, description = "", required = true }) {
  const protocol = getProtocol(protocolId);
  if (!protocol) throw new Error("Protocol bestaat niet.");
  if (!title || !title.trim()) throw new Error("Een controlepunt heeft een titel nodig.");

  const version = getActiveProtocolVersion(protocolId);
  if (!version) throw new Error("Het protocol heeft geen actieve versie.");

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
