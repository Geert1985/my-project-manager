function createCheck({ taskId, sourceVersionId, protocolId, summary = "" }) {
  const task = state.tasks.find(item => item.id === taskId);
  if (!task) throw new Error("Taak bestaat niet.");

  const sourceVersion = getSourceVersion(sourceVersionId);
  if (!sourceVersion) throw new Error("Bronversie bestaat niet.");

  const source = getSource(sourceVersion.sourceId);
  if (!source || source.projectId !== task.projectId || source.taskId !== taskId) {
    throw new Error("De bronversie moet gekoppeld zijn aan dezelfde taak.");
  }

  const protocol = getProtocol(protocolId);
  if (!protocol) throw new Error("Protocol bestaat niet.");

  const check = {
    id: crypto.randomUUID(),
    taskId,
    sourceVersionId,
    protocolId,
    protocolVersion: protocol.version,
    status: "not_started",
    startedAt: null,
    completedAt: null,
    summary: summary.trim(),
    createdAt: new Date().toISOString()
  };

  state.checks.push(check);

  for (const item of getProtocolItems(protocolId)) {
    state.checkResults.push({
      id: crypto.randomUUID(),
      checkId: check.id,
      protocolItemId: item.id,
      status: "not_checked",
      comment: "",
      evidence: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  saveState();
  return check;
}

function getCheck(checkId) {
  return state.checks.find(check => check.id === checkId);
}

function getTaskChecks(taskId) {
  return state.checks
    .filter(check => check.taskId === taskId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function getCheckResults(checkId) {
  return state.checkResults.filter(result => result.checkId === checkId);
}

function startCheck(checkId) {
  const check = getCheck(checkId);
  if (!check) throw new Error("Controle bestaat niet.");
  if (check.status !== "not_started") return check;

  check.status = "in_progress";
  check.startedAt = new Date().toISOString();
  saveState();
  return check;
}

function updateCheckResult({ checkResultId, status, comment = "", evidence = "" }) {
  const result = state.checkResults.find(item => item.id === checkResultId);
  if (!result) throw new Error("Controleresultaat bestaat niet.");

  const check = getCheck(result.checkId);
  if (!check) throw new Error("Controle bestaat niet.");
  if (["passed", "failed", "blocked"].includes(check.status)) {
    throw new Error("Een afgeronde controle is niet meer wijzigbaar.");
  }

  const allowed = ["not_checked", "pass", "fail", "not_applicable"];
  if (!allowed.includes(status)) throw new Error("Ongeldige controlestatus.");

  result.status = status;
  result.comment = comment.trim();
  result.evidence = evidence.trim();
  result.updatedAt = new Date().toISOString();

  reconcileCheck(check.id);
  saveState();
  return result;
}

function reconcileCheck(checkId) {
  const check = getCheck(checkId);
  if (!check) return null;

  const protocolItems = getProtocolItems(check.protocolId);
  const results = getCheckResults(check.id);
  const byItem = new Map(results.map(result => [result.protocolItemId, result]));

  if (!results.length) {
    check.status = "not_started";
    check.completedAt = null;
    return check;
  }

  if (results.some(result => result.status === "fail")) {
    check.status = "failed";
    check.completedAt = check.completedAt || new Date().toISOString();
    return check;
  }

  if (results.some(result => result.status === "not_checked" && byItem.get(result.protocolItemId))) {
    const checkedAny = results.some(result => result.status !== "not_checked");
    check.status = checkedAny ? "in_progress" : "not_started";
    check.completedAt = null;
    return check;
  }

  const requiredIncomplete = protocolItems.some(item => {
    const result = byItem.get(item.id);
    return item.required && (!result || result.status === "not_checked");
  });

  if (requiredIncomplete) {
    check.status = "in_progress";
    check.completedAt = null;
    return check;
  }

  check.status = "passed";
  check.completedAt = check.completedAt || new Date().toISOString();
  return check;
}
