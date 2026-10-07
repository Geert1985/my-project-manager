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

function getProtocolItems(protocolId) {
  return state.protocolItems
    .filter(item => item.protocolId === protocolId)
    .sort((a, b) => a.order - b.order);
}

function createProtocolItem({ protocolId, title, description = "", required = true }) {
  const protocol = getProtocol(protocolId);
  if (!protocol) throw new Error("Protocol bestaat niet.");
  if (!title || !title.trim()) throw new Error("Een controlepunt heeft een titel nodig.");

  const items = getProtocolItems(protocolId);
  const nextOrder = items.length ? Math.max(...items.map(item => item.order)) + 1 : 1;

  const item = {
    id: crypto.randomUUID(),
    protocolId,
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
