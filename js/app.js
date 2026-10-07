const app = document.getElementById("app");
let currentView = "dashboard";
let currentProjectId = null;
let currentCheckId = null;
const collapsedTaskIds = new Set();
let dialogReturnFocusKey = null;
let editingSourceId = null;

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]));
}

function render() {
  if (typeof closeTaskMenu === "function") closeTaskMenu(true);
  const focusKey = document.activeElement?.getAttribute("data-focus-key") || dialogReturnFocusKey;
  const openSourceIds = new Set([...app.querySelectorAll("details[data-source-id][open]")]
    .map(element => element.getAttribute("data-source-id")));
  dialogReturnFocusKey = null;
  if (currentView === "dashboard") renderDashboard();
  else if (currentView === "tasks") renderAllTasks();
  else if (currentView === "project") renderProject();
  else if (currentView === "protocols") renderProtocols();
  else if (currentView === "controls") renderControlsDashboard();
  else if (currentView === "check") renderCheck();
  else if (currentView === "sourceVersion") renderSourceVersion();
  app.querySelectorAll("details[data-source-id]").forEach(element => {
    element.open = openSourceIds.has(element.getAttribute("data-source-id"));
  });
  restoreAppFocus(focusKey);
}

function restoreAppFocus(key) {
  if (!key) return;
  const focusKeys = [key];
  if (key.startsWith("add-task-")) focusKeys.push(key.replace("add-task-", "add-child-bottom-"));
  const target = [...app.querySelectorAll("[data-focus-key]")]
    .find(element => focusKeys.includes(element.getAttribute("data-focus-key")));
  const fallback = target?.closest(".task-row")?.querySelector("input[type=checkbox]")
    || [...app.querySelectorAll("button, input, [tabindex]")]
      .find(element => !element.disabled && element.getClientRects().length);
  (target && !target.disabled && target.getClientRects().length ? target : fallback)?.focus({ preventScroll: true });
}

function rememberDialogFocus() {
  dialogReturnFocusKey = document.activeElement?.getAttribute("data-focus-key") || null;
}

function renderDashboard() {
  currentProjectId = null;
  if (!state.projects.length) {
    app.innerHTML = `<div class="card empty">
      <h2>Welkom</h2><p>Maak je eerste project aan.</p>
      <button class="primary" onclick="openProjectDialog()">＋ Nieuw project</button>
    </div>`;
    return;
  }
  app.innerHTML = `<div class="card"><h2>Mijn projecten</h2><p class="muted">Projecten, taken, bronnen en voortgang op één plaats.</p></div>` +
    state.projects.map(projectCard).join("");
}

function projectCard(project) {
  const stats = getTaskStats(project.id);
  const sourceCount = getProjectSources(project.id).length;
  return `<article class="card" data-project="${project.id}">
    <h2>${esc(project.name)}</h2>
    <p class="muted">${esc(project.description || project.category || "Geen beschrijving")}</p>
    <div class="project-meta"><span>${stats.completed} / ${stats.total} taken</span><strong>${stats.percent}%</strong></div>
    <div class="progress"><div style="width:${stats.percent}%"></div></div>
    <p class="muted small">${sourceCount} bron${sourceCount === 1 ? "" : "nen"}</p>
    <div class="task-actions">
      <button class="primary" onclick="openProject('${project.id}')">Open project</button>
      <button class="secondary" onclick="removeProject('${project.id}')">Verwijder</button>
    </div>
  </article>`;
}

function openProject(projectId) {
  currentProjectId = projectId;
  currentView = "project";
  render();
}

function renderProject() {
  const project = getProject(currentProjectId);
  if (!project) { currentView = "dashboard"; return render(); }
  const stats = getTaskStats(project.id);
  app.innerHTML = `<div class="card">
    <button class="secondary" onclick="goHome()">← Terug</button>
    <h2 style="margin-top:12px">${esc(project.name)}</h2>
    <p class="muted">${esc(project.description || "")}</p>
    <div class="project-meta"><span>${stats.completed} / ${stats.total} taken</span><strong>${stats.percent}%</strong></div>
    <div class="progress"><div style="width:${stats.percent}%"></div></div>
  </div>
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <h2>Taken</h2>
      <button class="primary" onclick="openTaskDialog('${project.id}', null)">＋ Taak</button>
    </div>
    <div>${renderTaskTree(project.id, null)}</div>
    <div class="task-list-footer"><button class="secondary" type="button" data-focus-key="add-root-bottom-${project.id}" onclick="openTaskDialog('${project.id}', null)">＋ Taak toevoegen</button></div>
  </div>`;
}

function renderTaskTree(projectId, parentId) {
  const tasks = getSiblingTasks(projectId, parentId);
  if (!tasks.length) return `<p class="muted small">Nog geen taken.</p>`;

  return tasks.map((task, index) => {
    const children = getChildren(task.id);
    const sources = getTaskSources(task.id);
    const hasDetails = Boolean(task.description || sources.length || children.length);
    return `<div class="task-row task-status-${task.status}">
      <input type="checkbox" data-focus-key="task-${task.id}" aria-label="${esc(task.name)} voltooien" ${task.status === "completed" ? "checked" : ""} onchange="toggleTask('${task.id}', this.checked)">
      <div class="task-content">
        <div class="task-header" data-task-header="${task.id}">
          <button class="task-action-icon task-drag-handle" type="button" data-focus-key="drag-${task.id}" data-task-id="${task.id}" ${tasks.length < 2 ? "disabled" : ""} title="Sleep om de volgorde te wijzigen" aria-label="${esc(task.name)} slepen; gebruik het actiemenu voor toetsenbordbediening" onpointerdown="startTaskDrag(this, event)" onpointermove="updateTaskDrag(event)" onpointerup="finishTaskDrag(event)" onpointercancel="cancelTaskDrag()" onlostpointercapture="cancelTaskDrag()">⠿</button>
          ${hasDetails ? `<button class="task-toggle" type="button" data-task-id="${task.id}" data-focus-key="collapse-${task.id}" aria-expanded="${!collapsedTaskIds.has(task.id)}" onclick="toggleTaskDetails(this)" title="Taak in- of uitklappen"><span aria-hidden="true">▶</span></button>` : `<span class="task-toggle-placeholder" aria-hidden="true"></span>`}
          <div class="task-name">
            <strong class="${task.status === "completed" ? "completed" : ""}">${esc(task.name)}</strong>
            <span class="task-status-label small">${task.status === "completed" ? "Voltooid" : task.status === "in_progress" ? "Bezig" : "Niet gestart"}</span>
            ${children.length ? `<span class="muted small">${children.length} ${children.length === 1 ? "subtaak" : "subtaken"}</span>` : ""}
            ${sources.length ? `<span class="muted small">${sources.length} bron${sources.length === 1 ? "" : "nen"}</span>` : ""}
          </div>
          <div class="task-actions task-actions-compact" aria-label="Taakacties">
            ${!children.length ? `<button class="task-action-icon" type="button" data-focus-key="add-task-${task.id}" onclick="openTaskDialog('${projectId}', '${task.id}')" title="Eerste subtaak toevoegen" aria-label="Eerste subtaak toevoegen">＋</button>` : ""}
            <button class="task-action-icon" type="button" id="task-menu-button-${task.id}" data-focus-key="menu-${task.id}" aria-haspopup="menu" aria-expanded="false" aria-controls="task-menu-${task.id}" onclick="toggleTaskMenu(this)" onkeydown="taskMenuTriggerKey(this, event)" title="Taakacties" aria-label="Acties voor ${esc(task.name)}">⋮</button>
            <div class="task-menu" id="task-menu-${task.id}" role="menu" aria-labelledby="task-menu-button-${task.id}" data-task-id="${task.id}" data-project-id="${projectId}" hidden>
              <button type="button" role="menuitem" tabindex="-1" data-focus-key="add-source-${task.id}" onclick="runTaskMenuAction(this, 'source')">Bron toevoegen</button>
              <button type="button" role="menuitem" tabindex="-1" data-focus-key="move-up-${task.id}" ${index === 0 ? "disabled" : ""} onclick="runTaskMenuAction(this, 'up')">Omhoog</button>
              <button type="button" role="menuitem" tabindex="-1" data-focus-key="move-down-${task.id}" ${index === tasks.length - 1 ? "disabled" : ""} onclick="runTaskMenuAction(this, 'down')">Omlaag</button>
              <button type="button" role="menuitem" tabindex="-1" class="task-menu-delete" data-focus-key="delete-task-${task.id}" onclick="runTaskMenuAction(this, 'delete')">Taak verwijderen</button>
            </div>
          </div>
        </div>
        <div class="task-details" ${collapsedTaskIds.has(task.id) ? "hidden" : ""}>
          ${task.description ? `<div class="muted small">${esc(task.description)}</div>` : ""}
          ${sources.length ? renderTaskSources(sources) : ""}
          ${children.length ? `<div class="children">${renderTaskTree(projectId, task.id)}<div class="task-list-footer"><button class="secondary" type="button" data-focus-key="add-child-bottom-${task.id}" onclick="openTaskDialog('${projectId}', '${task.id}')">＋ Subtaak toevoegen</button></div></div>` : ""}
        </div>
      </div>
    </div>`;
  }).join("");
}


function toggleTaskDetails(button) {
  const taskContent = button.closest(".task-content");
  const details = taskContent?.querySelector(":scope > .task-details");
  if (!details) return;

  const expanded = button.getAttribute("aria-expanded") === "true";
  button.setAttribute("aria-expanded", String(!expanded));
  details.hidden = expanded;
  const taskId = button.getAttribute("data-task-id");
  if (expanded) collapsedTaskIds.add(taskId);
  else collapsedTaskIds.delete(taskId);
}


function getCheckDisplayState(check) {
  const review = getReviewForCheck(check.id);
  if (check.status === "failed") return { key: "failed", label: "Controle mislukt", icon: "🔴" };
  if (check.status === "passed" && review?.status === "approved") return { key: "approved", label: "Goedgekeurd", icon: "🟢" };
  if (check.status === "passed" && review?.status === "pending") return { key: "pending", label: "Review in behandeling", icon: "🟠" };
  if (check.status === "passed") return { key: "completed", label: "Controle uitgevoerd", icon: "🔵" };
  if (check.status === "in_progress") return { key: "progress", label: "Controle bezig", icon: "🔵" };
  return { key: "neutral", label: "Nog niet gestart", icon: "⚪" };
}

function renderStatusChip(check) {
  const status = getCheckDisplayState(check);
  return `<span class="status-chip status-${status.key}">${status.icon} ${status.label}</span>`;
}

let activeControlFilter = null;

function setControlFilter(filter) {
  activeControlFilter = activeControlFilter === filter ? null : filter;
  renderControlsDashboard();
  restoreAppFocus(`filter-${filter}`);
}

function renderControlsDashboard() {
  const checks = [...state.checks].sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  const counts = { approved:0, pending:0, failed:0, completed:0 };
  checks.forEach(check => {
    const key = getCheckDisplayState(check).key;
    if (counts[key] !== undefined) counts[key]++;
  });

  const visibleChecks = activeControlFilter
    ? checks.filter(check => getCheckDisplayState(check).key === activeControlFilter)
    : checks;
  const filterLabels = {
    approved: "Goedgekeurd",
    pending: "Review in behandeling",
    failed: "Controle mislukt",
    completed: "Controle uitgevoerd"
  };

  app.innerHTML = `
    <div class="card">
      <h2>Controle- en reviewdashboard</h2>
      <p class="muted">Overzicht van alle uitgevoerde controles, reviews en hun actuele status.</p>
      <div class="dashboard-grid">
        <button class="dashboard-stat dashboard-filter ${activeControlFilter === "approved" ? "active" : ""}" type="button" aria-pressed="${activeControlFilter === "approved"}" data-focus-key="filter-approved" onclick="setControlFilter('approved')"><span>🟢 Goedgekeurd</span><strong>${counts.approved}</strong></button>
        <button class="dashboard-stat dashboard-filter ${activeControlFilter === "pending" ? "active" : ""}" type="button" aria-pressed="${activeControlFilter === "pending"}" data-focus-key="filter-pending" onclick="setControlFilter('pending')"><span>🟠 Review in behandeling</span><strong>${counts.pending}</strong></button>
        <button class="dashboard-stat dashboard-filter ${activeControlFilter === "failed" ? "active" : ""}" type="button" aria-pressed="${activeControlFilter === "failed"}" data-focus-key="filter-failed" onclick="setControlFilter('failed')"><span>🔴 Controle mislukt</span><strong>${counts.failed}</strong></button>
        <button class="dashboard-stat dashboard-filter ${activeControlFilter === "completed" ? "active" : ""}" type="button" aria-pressed="${activeControlFilter === "completed"}" data-focus-key="filter-completed" onclick="setControlFilter('completed')"><span>🔵 Controle uitgevoerd</span><strong>${counts.completed}</strong></button>
      </div>
      ${activeControlFilter ? `<div class="active-filter-note small">Filter actief: <strong>${filterLabels[activeControlFilter]}</strong> · klik opnieuw op dezelfde kaart om alle controles te tonen.</div>` : ""}
    </div>
    <div class="card">
      <h2>${activeControlFilter ? filterLabels[activeControlFilter] : "Alle controles"} (${visibleChecks.length})</h2>
      ${visibleChecks.length ? visibleChecks.map(renderControlDashboardRow).join("") : `<div class="empty">${activeControlFilter ? "Geen controles met deze status." : "Nog geen controles uitgevoerd."}</div>`}
    </div>
    <div class="card">
      <h2>Alle reviews (${state.reviews.length})</h2>
      ${state.reviews.length ? [...state.reviews].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map(renderReviewDashboardRow).join("") : `<div class="empty">Nog geen reviews.</div>`}
    </div>`;
}

function renderReviewDashboardRow(review) {
  const check = getCheck(review.checkId);
  const task = check ? state.tasks.find(item => item.id === check.taskId) : null;
  const sourceVersion = check ? getSourceVersion(check.sourceVersionId) : null;
  const source = sourceVersion ? getSource(sourceVersion.sourceId) : null;

  return `<div class="control-row">
    <div class="control-row-main">
      <div>
        <strong>Review · ${esc(review.reviewer)}</strong>
        <div class="muted small">${esc(task?.name || "Onbekende taak")} · ${esc(source?.title || "")} v${esc(sourceVersion?.version || "")}</div>
      </div>
      ${`<span class="status-chip status-${review.status === "approved" ? "approved" : review.status === "pending" ? "pending" : "failed"}">${review.status === "approved" ? "🟢 Goedgekeurd" : review.status === "pending" ? "🟠 In behandeling" : "🔴 Afgewezen"}</span>`}
    </div>
    ${review.comment ? `<div class="control-meta muted small">${esc(review.comment)}</div>` : ""}
    <div class="task-actions">
      ${check ? `<button class="secondary small" onclick="openCheck('${check.id}')">Open controle</button>` : ""}
      ${sourceVersion ? `<button class="secondary small" onclick="openSourceVersion('${sourceVersion.id}')">Bronversie</button>` : ""}
    </div>
  </div>`;
}

function renderControlDashboardRow(check) {
  const task = state.tasks.find(item => item.id === check.taskId);
  const project = task ? getProject(task.projectId) : null;
  const protocol = getProtocol(check.protocolId);
  const sourceVersion = getSourceVersion(check.sourceVersionId);
  const source = sourceVersion ? getSource(sourceVersion.sourceId) : null;
  const review = getReviewForCheck(check.id);

  return `<div class="control-row">
    <div class="control-row-main">
      <div>
        <strong>${esc(task?.name || "Onbekende taak")}</strong>
        <div class="muted small">${esc(project?.name || "")}</div>
      </div>
      ${renderStatusChip(check)}
    </div>
    <div class="control-meta muted small">
      Protocol: ${esc(protocol?.name || "")} v${esc(check.protocolVersion || protocol?.version || "")}
      · Bron: ${esc(source?.title || "")} v${esc(sourceVersion?.version || "")}
      ${review ? `· Review: ${esc(review.status)}` : ""}
    </div>
    <div class="task-actions">
      <button class="secondary small" onclick="openCheck('${check.id}')">Open controle</button>
      ${sourceVersion ? `<button class="secondary small" onclick="openSourceVersion('${sourceVersion.id}')">Bronversie</button>` : ""}
    </div>
  </div>`;
}

function openSourceVersion(sourceVersionId) {
  currentView = "sourceVersion";
  currentCheckId = null;
  window.currentSourceVersionId = sourceVersionId;
  render();
}

function renderSourceVersion() {
  const sourceVersion = getSourceVersion(window.currentSourceVersionId);
  const source = sourceVersion ? getSource(sourceVersion.sourceId) : null;
  if (!sourceVersion || !source) { currentView = "controls"; return render(); }

  const project = getProject(source.projectId);
  const task = source.taskId ? state.tasks.find(item => item.id === source.taskId) : null;
  const checks = state.checks.filter(check => check.sourceVersionId === sourceVersion.id);

  app.innerHTML = `
    <div class="card source-information">
      <button class="secondary" onclick="currentView='controls'; render()">← Terug naar controles</button>
      <h2 style="margin-top:12px">${esc(source.title)}</h2>
      <p><strong>Bronversie:</strong> v${esc(sourceVersion.version)}${sourceVersion.label ? ` — ${esc(sourceVersion.label)}` : ""}</p>
      ${renderSourceText("Beschrijving (bronmetadata)", source.description)}
      ${renderSourceText("Auteur", source.author)}
      ${renderSourceText("Uitgever", source.publisher)}
      ${renderSourceVersionMetadata(sourceVersion)}
      ${!sourceVersion.url ? renderSourceLink("URL van de bron", source.url) : ""}
      ${project ? `<p class="muted small">Project: ${esc(project.name)}${task ? ` · Taak: ${esc(task.name)}` : ""}</p>` : ""}
    </div>
    <div class="card">
      <h3>Controles op deze bronversie (${checks.length})</h3>
      ${checks.length ? checks.map(check => `
        <div class="control-row">
          <div class="control-row-main"><strong>Controle</strong>${renderStatusChip(check)}</div>
          <div class="task-actions"><button class="secondary small" onclick="openCheck('${check.id}')">Open controle</button></div>
        </div>`).join("") : `<p class="muted">Geen controles op deze bronversie.</p>`}
    </div>`;
}

function renderSourceText(label, value) {
  if (!value || !String(value).trim()) return "";
  return `<div class="source-metadata"><strong>${esc(label)}</strong><div class="source-text">${esc(value)}</div></div>`;
}

function renderSourceLink(label, value) {
  if (!value || !String(value).trim()) return "";
  let clickable = false;
  try { clickable = ["http:", "https:"].includes(new URL(value).protocol); } catch {}
  return `<div class="source-metadata"><strong>${esc(label)}</strong><div class="source-text">${esc(value)}</div>
    ${clickable ? `<a class="source-open-link" href="${esc(value)}" target="_blank" rel="noopener noreferrer">Open link</a>` : ""}</div>`;
}

function renderSourceVersionMetadata(version) {
  return renderSourceText("Bestandsnaam", version.fileName) + renderSourceText("Bestandspad", version.filePath)
    + renderSourceText("Notities", version.notes) + renderSourceText("Contenthash", version.contentHash)
    + renderSourceLink("URL van deze versie", version.url);
}

function renderTaskSources(sources) {
  return `<div class="source-list">${sources.map(source => {
    const versions = [...getSourceVersions(source.id)].reverse();
    return `<details class="source-item source-card" data-source-id="${source.id}">\n      <summary class="source-summary"><strong>Bron:</strong> <span class="source-summary-title">${esc(source.title)}</span> <span class="badge">${esc(source.type)}</span> <span class="muted small">· ${versions.length} versie${versions.length === 1 ? "" : "s"}</span></summary>
      <div><strong>Bron:</strong> ${esc(source.title)} <span class="badge">${esc(source.type)}</span></div>
      ${source.author ? `<div class="muted small">Auteur: ${esc(source.author)}</div>` : ""}
      ${renderSourceText("Uitgever", source.publisher)}
      ${renderSourceText("Beschrijving", source.description)}
      ${renderSourceLink("URL van de bron", source.url)}
      <div class="source-actions">
        <button class="secondary small" data-focus-key="add-version-${source.id}" onclick="openSourceVersionDialog('${source.id}')">＋ Versie</button>
        <button class="secondary small" data-focus-key="edit-source-${source.id}" onclick="openSourceEditDialog('${source.id}')">Bron bewerken</button>
        <button class="secondary small" data-focus-key="delete-source-${source.id}" onclick="removeSource('${source.id}')" title="Bron verwijderen">🗑 Verwijder bron</button>
        ${versions.length ? `<span class="muted small">${versions.length} versie${versions.length === 1 ? "" : "s"}</span>` : `<span class="muted small">Geen versies</span>`}
      </div>
      ${versions.length ? `<div class="source-versions">${versions.map(v => {
        const checks = state.checks
          .filter(check => check.taskId === source.taskId && check.sourceVersionId === v.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const latestCheck = checks[0] || null;
        const status = latestCheck ? getCheckDisplayState(latestCheck) : null;
        return `<div class="source-version-entry"><div class="source-version-row">
          <span class="muted small">v${esc(v.version)}${v.label ? ` — ${esc(v.label)}` : ""}</span>
          ${status ? `<span class="check-status-dot status-dot-${status.key}" title="${esc(status.label)}" aria-label="${esc(status.label)}"></span>` : `<span class="check-status-dot status-dot-none" title="Nog niet gecontroleerd" aria-label="Nog niet gecontroleerd"></span>`}
          <button class="secondary small" onclick="openCheckDialog('${source.taskId}', '${v.id}')">＋ Controle</button>
        </div>${renderSourceVersionMetadata(v)}<button class="secondary small" onclick="openSourceVersion('${v.id}')">Bekijk versie</button></div>`;
      }).join("")}</div>` : ""}
    </details>`;
  }).join("")}</div>`;
}

function removeSource(sourceId) {
  const deletion = getSourceDeletionState(sourceId);
  if (!deletion.allowed) {
    alert(deletion.reason);
    return;
  }

  if (confirm("Deze bron en alle bronversies verwijderen?")) {
    try {
      deleteSource(sourceId);
      render();
    } catch (error) {
      alert(error.message);
    }
  }
}

function openCheckDialog(taskId, selectedSourceVersionId = null) {
  const task = state.tasks.find(item => item.id === taskId);
  if (!task) return;

  const protocols = state.protocols.filter(protocol => protocol.active);
  const sourceVersions = getTaskSources(taskId).flatMap(source =>
    getSourceVersions(source.id).map(version => ({ source, version }))
  );

  if (!protocols.length) {
    alert("Maak eerst een actief controleprotocol aan.");
    return;
  }

  if (!sourceVersions.length) {
    alert("Voeg eerst minstens één bronversie toe aan deze taak.");
    return;
  }

  document.getElementById("checkForm").reset();
  document.getElementById("checkTaskId").value = taskId;

  document.getElementById("checkProtocolId").innerHTML = protocols
    .map(protocol => `<option value="${protocol.id}">${esc(protocol.name)}</option>`)
    .join("");

  populateCheckProtocolVersions();

  document.getElementById("checkSourceVersionId").innerHTML = sourceVersions
    .map(({ source, version }) => `<option value="${version.id}">${esc(source.title)} — v${esc(version.version)}</option>`)
    .join("");

  if (selectedSourceVersionId && sourceVersions.some(({ version }) => version.id === selectedSourceVersionId)) {
    document.getElementById("checkSourceVersionId").value = selectedSourceVersionId;
  }

  document.getElementById("checkDialog").showModal();
}

function populateCheckProtocolVersions() {
  const protocolId = document.getElementById("checkProtocolId").value;
  const versions = getProtocolVersions(protocolId)
    .filter(version => version.status === "active");

  document.getElementById("checkProtocolVersionId").innerHTML = versions
    .map(version => `<option value="${version.id}">v${esc(version.version)}</option>`)
    .join("");

  if (!versions.length) {
    document.getElementById("checkProtocolVersionId").innerHTML =
      `<option value="">Geen actieve versie beschikbaar</option>`;
  }
}

document.getElementById("checkProtocolId").addEventListener("change", populateCheckProtocolVersions);

document.getElementById("checkForm").addEventListener("submit", event => {
  event.preventDefault();
  try {
    const check = createCheck({
      taskId: document.getElementById("checkTaskId").value,
      protocolId: document.getElementById("checkProtocolId").value,
      protocolVersionId: document.getElementById("checkProtocolVersionId").value,
      sourceVersionId: document.getElementById("checkSourceVersionId").value,
      summary: document.getElementById("checkSummary").value
    });
    startCheck(check.id);
    document.getElementById("checkDialog").close();
    openCheck(check.id);
  } catch (error) {
    alert(error.message);
  }
});

function openCheck(checkId) {
  currentView = "check";
  currentCheckId = checkId;
  render();
}

function renderCheck() {
  const check = getCheck(currentCheckId);
  if (!check) { currentView = "dashboard"; return render(); }

  const protocol = getProtocol(check.protocolId);
  const protocolVersion = check.protocolVersionId
    ? getProtocolVersion(check.protocolVersionId)
    : null;
  const sourceVersion = getSourceVersion(check.sourceVersionId);
  const source = sourceVersion ? getSource(sourceVersion.sourceId) : null;
  const results = getCheckResults(check.id);
  const items = protocolVersion
    ? getProtocolItemsForVersion(protocolVersion.id)
    : getProtocolItems(check.protocolId);
  const resultByItem = new Map(results.map(result => [result.protocolItemId, result]));

  app.innerHTML = `
    <div class="card">
      <button class="secondary" onclick="returnFromCheck()">← Terug</button>
      <h2 style="margin-top:12px">Controle</h2>
      <p><strong>Protocol:</strong> ${esc(protocol?.name || "")} v${esc(protocolVersion?.version || check.protocolVersion || protocol?.version || "")}</p>
      <p><strong>Bron:</strong> ${esc(source?.title || "")} — v${esc(sourceVersion?.version || "")}</p>
      <p class="muted">Status: ${esc(check.status)}</p>
      ${renderReviewSection(check)}
    </div>
    <div class="card">
      <h2>Controlepunten</h2>
      ${items.map(item => {
        const result = resultByItem.get(item.id);
        return `
          <div class="check-result">
            <div><strong>${item.order}. ${esc(item.title)}</strong>${item.required ? ` <span class="badge">verplicht</span>` : ""}</div>
            ${item.description ? `<div class="muted small">${esc(item.description)}</div>` : ""}
            <select onchange="saveCheckResult('${result.id}', this.value)">
              <option value="not_checked" ${result.status === "not_checked" ? "selected" : ""}>Niet gecontroleerd</option>
              <option value="pass" ${result.status === "pass" ? "selected" : ""}>Pass</option>
              <option value="fail" ${result.status === "fail" ? "selected" : ""}>Fail</option>
              <option value="not_applicable" ${result.status === "not_applicable" ? "selected" : ""}>N.v.t.</option>
            </select>
            ${result.comment ? `<div class="muted small">Opmerking: ${esc(result.comment)}</div>` : ""}
            ${result.evidence ? `<div class="muted small">Bewijs: ${esc(result.evidence)}</div>` : ""}
          </div>`;
      }).join("")}
    </div>
  `;
}

function renderReviewSection(check) {
  const review = getReviewForCheck(check.id);

  if (!["passed", "failed"].includes(check.status)) {
    return `<p class="muted small">Een review kan pas worden aangemaakt nadat de controle is afgerond.</p>`;
  }

  if (!review) {
    return `<div class="review-box">
      <h3>Review</h3>
      <p class="muted small">Deze controle is nog niet gereviewd.</p>
      <button class="secondary" onclick="openReviewDialog('${check.id}')">＋ Review</button>
    </div>`;
  }

  return `<div class="review-box">
    <h3>Review</h3>
    <p><strong>Status:</strong> ${esc(review.status)}</p>
    <p><strong>Reviewer:</strong> ${esc(review.reviewer)}</p>
    ${review.comment ? `<p class="muted small">${esc(review.comment)}</p>` : ""}
    ${review.status === "pending" ? `
      <div class="task-actions">
        <button class="secondary small" onclick="setReviewStatus('${review.id}', 'approved')">Goedkeuren</button>
        <button class="secondary small" onclick="setReviewStatus('${review.id}', 'rejected')">Afwijzen</button>
      </div>` : ""}
  </div>`;
}

function openReviewDialog(checkId) {
  document.getElementById("reviewForm").reset();
  document.getElementById("reviewCheckId").value = checkId;
  document.getElementById("reviewDialog").showModal();
}

document.getElementById("reviewForm").addEventListener("submit", event => {
  event.preventDefault();
  try {
    createReview({
      checkId: document.getElementById("reviewCheckId").value,
      reviewer: document.getElementById("reviewReviewer").value,
      comment: document.getElementById("reviewComment").value
    });
    document.getElementById("reviewDialog").close();
    render();
  } catch (error) {
    alert(error.message);
  }
});

function setReviewStatus(reviewId, status) {
  try {
    updateReviewStatus({ reviewId, status });
    render();
  } catch (error) {
    alert(error.message);
  }
}

function saveCheckResult(resultId, status) {
  try {
    updateCheckResult({ checkResultId: resultId, status });
    render();
  } catch (error) {
    alert(error.message);
    render();
  }
}

function returnFromCheck() {
  const check = getCheck(currentCheckId);
  const task = check ? state.tasks.find(item => item.id === check.taskId) : null;
  if (task) {
    currentProjectId = task.projectId;
    currentView = "project";
  } else {
    currentView = "dashboard";
  }
  render();
}

function renderAllTasks() {
  const open = state.projects.flatMap(project => getProjectTasksInTreeOrder(project.id))
    .filter(task => task.status !== "completed");
  app.innerHTML = `<div class="card"><h2>Alle openstaande taken</h2>
    ${open.length ? open.map(t => `<div class="task-row">
      <input type="checkbox" data-focus-key="task-${t.id}" aria-label="${esc(t.name)} voltooien" onchange="toggleTask('${t.id}', this.checked)">
      <div class="task-content"><strong>${esc(t.name)}</strong><div class="muted small">${esc(getProject(t.projectId)?.name || "")}</div></div>
    </div>`).join("") : `<div class="empty">Geen openstaande taken.</div>`}
  </div>`;
}

function renderProtocols() {
  app.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div>
          <h2>Controleprotocollen</h2>
          <p class="muted">Herbruikbare controleprocedures voor projecten en taken.</p>
        </div>
        <button class="primary" onclick="openProtocolDialog()">＋ Protocol</button>
      </div>
    </div>
    ${state.protocols.length ? state.protocols.map(renderProtocolCard).join("") : `
      <div class="card empty">
        <p>Nog geen controleprotocollen.</p>
        <button class="primary" onclick="openProtocolDialog()">＋ Eerste protocol</button>
      </div>`}
  `;
}

function renderProtocolCard(protocol) {
  const versions = [...getProtocolVersions(protocol.id)].reverse();
  const activeVersion = getActiveProtocolVersion(protocol.id);

  return `
    <article class="card protocol-card">
      <div class="protocol-card-header">
        <button class="protocol-toggle" type="button" aria-expanded="false" onclick="toggleProtocolCard(this)">
          <span class="protocol-toggle-icon" aria-hidden="true">▶</span>
          <span>
            <strong class="protocol-card-title">${esc(protocol.name)}</strong>
            <span class="muted small protocol-card-summary">
              ${activeVersion ? `Actieve versie: v${esc(activeVersion.version)} · ` : ""}${versions.length} versie${versions.length === 1 ? "" : "s"}
            </span>
          </span>
        </button>
        <span class="badge">${protocol.active ? "actief" : "inactief"}</span>
      </div>

      <div class="protocol-card-body" hidden>
        <p class="muted">${esc(protocol.description || "Geen beschrijving")}</p>
        <div class="protocol-items">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <h3>Versies (${versions.length})</h3>
          <button class="secondary small" onclick="openProtocolVersionDialog('${protocol.id}')">＋ Nieuwe versie</button>
        </div>
        ${versions.length ? versions.map(version => {
          const items = getProtocolItemsForVersion(version.id);
          const used = state.checks.some(check => check.protocolVersionId === version.id);
          const canEdit = (version.status === "draft" || version.status === "active") && !used;

          return `
            <div class="protocol-version-card">
              <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
                <div>
                  <strong>v${esc(version.version)}</strong>
                  <span class="badge">${esc(version.status)}</span>
                  ${used ? ` <span class="badge">in gebruik</span>` : ""}
                </div>
                <span class="muted small">${items.length} controlepunt${items.length === 1 ? "" : "en"}</span>
              </div>
              ${version.description ? `<div class="muted small" style="margin-top:4px">${esc(version.description)}</div>` : ""}
              <div class="protocol-version-items">
                ${items.length ? items.map(item => `
                  <div class="protocol-item">
                    <div><strong>${item.order}. ${esc(item.title)}</strong>${item.required ? ` <span class="badge">verplicht</span>` : ""}</div>
                    ${item.description ? `<div class="muted small">${esc(item.description)}</div>` : ""}
                  </div>`).join("") : `<p class="muted small">Nog geen controlepunten.</p>`}
              </div>
              ${canEdit ? `
                <div class="task-actions">
                  <button class="secondary" onclick="openProtocolItemDialog('${protocol.id}', '${version.id}')">＋ Controlepunt</button>
                  ${version.status === "draft" ? `<button class="primary" onclick="activateProtocolVersionFromUi('${version.id}')">Activeren</button>` : ""}
                </div>` : ""}
            </div>`;
        }).join("") : `<p class="muted small">Nog geen protocolversies.</p>`}
        </div>

        ${activeVersion ? `<p class="muted small">Actieve versie: v${esc(activeVersion.version)}</p>` : ""}
      </div>
    </article>`;
}

function toggleProtocolCard(button) {
  const card = button.closest(".protocol-card");
  const body = card?.querySelector(".protocol-card-body");
  if (!body) return;

  const expanded = button.getAttribute("aria-expanded") === "true";
  button.setAttribute("aria-expanded", String(!expanded));
  body.hidden = expanded;
}

function activateProtocolVersionFromUi(protocolVersionId) {
  const version = getProtocolVersion(protocolVersionId);
  if (!version) return;

  if (!confirm(`Protocolversie v${version.version} activeren? De huidige actieve versie wordt retired.`)) {
    return;
  }

  try {
    activateProtocolVersion(protocolVersionId);
    render();
  } catch (error) {
    alert(error.message);
  }
}

function openProtocolDialog() {
  document.getElementById("protocolForm").reset();
  document.getElementById("protocolVersion").value = "1.0";
  document.getElementById("protocolDialog").showModal();
}

document.getElementById("protocolForm").addEventListener("submit", event => {
  event.preventDefault();
  try {
    createProtocol({
      name: document.getElementById("protocolName").value,
      version: document.getElementById("protocolVersion").value,
      description: document.getElementById("protocolDescription").value
    });
    document.getElementById("protocolDialog").close();
    render();
  } catch (error) {
    alert(error.message);
  }
});

function openProtocolVersionDialog(protocolId) {
  const protocol = getProtocol(protocolId);
  if (!protocol) return;

  document.getElementById("protocolVersionForm").reset();
  document.getElementById("protocolVersionProtocolId").value = protocolId;

  const versions = getProtocolVersions(protocolId);
  document.getElementById("protocolVersionCopyFrom").innerHTML =
    `<option value="">Lege versie</option>` +
    versions.map(version =>
      `<option value="${version.id}">v${esc(version.version)} (${esc(version.status)})</option>`
    ).join("");

  document.getElementById("protocolVersionDialog").showModal();
}

document.getElementById("protocolVersionForm").addEventListener("submit", event => {
  event.preventDefault();
  try {
    createProtocolVersion({
      protocolId: document.getElementById("protocolVersionProtocolId").value,
      version: document.getElementById("protocolVersionNewVersion").value,
      description: document.getElementById("protocolVersionNewDescription").value,
      copyFromVersionId: document.getElementById("protocolVersionCopyFrom").value || null
    });
    document.getElementById("protocolVersionDialog").close();
    render();
  } catch (error) {
    alert(error.message);
  }
});

function openProtocolItemDialog(protocolId, protocolVersionId = null) {
  document.getElementById("protocolItemForm").reset();
  document.getElementById("protocolItemProtocolId").value = protocolId;
  document.getElementById("protocolItemVersionId").value = protocolVersionId || "";
  document.getElementById("protocolItemRequired").checked = true;
  document.getElementById("protocolItemDialog").showModal();
}

document.getElementById("protocolItemForm").addEventListener("submit", event => {
  event.preventDefault();
  try {
    createProtocolItem({
      protocolId: document.getElementById("protocolItemProtocolId").value,
      protocolVersionId: document.getElementById("protocolItemVersionId").value || null,
      title: document.getElementById("protocolItemTitle").value,
      description: document.getElementById("protocolItemDescription").value,
      required: document.getElementById("protocolItemRequired").checked
    });
    document.getElementById("protocolItemDialog").close();
    render();
  } catch (error) {
    alert(error.message);
  }
});

function toggleTask(id, checked) {
  setTaskCompleted(id, checked, "manual");
  render();
}

function moveTaskFromUi(id, direction) {
  try {
    if (moveTask(id, direction)) render();
  } catch (error) {
    alert(error.message);
  }
}

function removeTask(id) {
  if (confirm("Deze taak en eventuele subtaken verwijderen?")) {
    try {
      deleteTask(id);
      render();
    } catch (error) {
      alert(error.message);
    }
  }
}

function removeProject(id) {
  if (confirm("Dit project en alle taken verwijderen?")) {
    try {
      deleteProject(id);
      render();
    } catch (error) {
      alert(error.message);
    }
  }
}

function goHome() {
  currentView = "dashboard";
  currentProjectId = null;
  render();
}

function openProjectDialog() {
  document.getElementById("projectForm").reset();
  document.getElementById("projectDialog").showModal();
}

document.getElementById("projectForm").addEventListener("submit", event => {
  event.preventDefault();
  try {
    createProject({
      name: document.getElementById("projectName").value,
      description: document.getElementById("projectDescription").value,
      category: document.getElementById("projectCategory").value
    });
    document.getElementById("projectDialog").close();
    render();
  } catch (error) {
    alert(error.message);
  }
});

function openTaskDialog(projectId, parentId) {
  rememberDialogFocus();
  currentProjectId = projectId;
  document.getElementById("taskForm").reset();
  document.getElementById("taskParentId").value = parentId || "";
  document.getElementById("taskDialog").showModal();
}

document.getElementById("taskForm").addEventListener("submit", event => {
  event.preventDefault();
  try {
    createTask({
      projectId: currentProjectId,
      parentId: document.getElementById("taskParentId").value || null,
      name: document.getElementById("taskName").value,
      description: document.getElementById("taskDescription").value,
      priority: document.getElementById("taskPriority").value
    });
    document.getElementById("taskDialog").close();
    render();
  } catch (error) {
    alert(error.message);
  }
});

function openSourceDialog(projectId, taskId) {
  rememberDialogFocus();
  currentProjectId = projectId;
  document.getElementById("sourceForm").reset();
  editingSourceId = null;
  document.getElementById("sourceDialogTitle").textContent = "Nieuwe bron";
  document.getElementById("sourceSubmitButton").textContent = "Bron toevoegen";
  document.getElementById("sourceUrl").disabled = false;
  document.getElementById("sourceEditNote").hidden = true;
  document.getElementById("sourceTaskId").value = taskId;
  document.getElementById("sourceDialog").showModal();
}

function openSourceEditDialog(sourceId) {
  const source = getSource(sourceId);
  if (!source) return;
  openSourceDialog(source.projectId, source.taskId);
  editingSourceId = sourceId;
  document.getElementById("sourceDialogTitle").textContent = "Bron bewerken";
  document.getElementById("sourceSubmitButton").textContent = "Opslaan";
  for (const [id, field] of Object.entries({sourceTitle:"title", sourceType:"type", sourceAuthor:"author",
    sourcePublisher:"publisher", sourceUrl:"url", sourceDescription:"description"})) {
    document.getElementById(id).value = source[field] || "";
  }
  const locked = !getSourceDeletionState(sourceId).allowed;
  document.getElementById("sourceUrl").disabled = locked;
  const note = document.getElementById("sourceEditNote");
  note.hidden = false;
  note.textContent = "Je bewerkt bronmetadata; bestaande bronversies blijven ongewijzigd." +
    (locked ? " De bron-URL is beschermd door gekoppelde controles. Gebruik een nieuwe bronversie voor een andere link." : "");
  document.getElementById("sourceTitle").focus();
}

document.getElementById("sourceForm").addEventListener("submit", event => {
  event.preventDefault();
  try {
    const metadata = {
      projectId: currentProjectId,
      taskId: document.getElementById("sourceTaskId").value || null,
      type: document.getElementById("sourceType").value,
      title: document.getElementById("sourceTitle").value,
      author: document.getElementById("sourceAuthor").value,
      publisher: document.getElementById("sourcePublisher").value,
      url: document.getElementById("sourceUrl").value,
      description: document.getElementById("sourceDescription").value
    };
    if (editingSourceId) updateSourceMetadata(editingSourceId, metadata);
    else createSource(metadata);
    document.getElementById("sourceDialog").close();
    render();
  } catch (error) {
    alert(error.message);
  }
});

function openSourceVersionDialog(sourceId) {
  rememberDialogFocus();
  document.getElementById("sourceVersionForm").reset();
  document.getElementById("sourceVersionSourceId").value = sourceId;
  document.getElementById("sourceVersionDialog").showModal();
}

document.getElementById("sourceVersionForm").addEventListener("submit", event => {
  event.preventDefault();
  try {
    createSourceVersion({
      sourceId: document.getElementById("sourceVersionSourceId").value,
      version: document.getElementById("sourceVersion").value,
      label: document.getElementById("sourceVersionLabel").value,
      fileName: document.getElementById("sourceVersionFileName").value,
      filePath: document.getElementById("sourceVersionFilePath").value,
      url: document.getElementById("sourceVersionUrl").value,
      notes: document.getElementById("sourceVersionNotes").value
    });
    document.getElementById("sourceVersionDialog").close();
    render();
  } catch (error) {
    alert(error.message);
  }
});

document.querySelectorAll("[data-dialog-cancel]").forEach(button => {
  button.addEventListener("click", () => {
    const dialog = button.closest("dialog");
    if (dialog?.open) dialog.close();
    dialogReturnFocusKey = null;
  });
});

document.querySelectorAll("dialog").forEach(dialog => {
  dialog.addEventListener("cancel", () => { dialogReturnFocusKey = null; });
});

document.getElementById("newProjectBtn").addEventListener("click", openProjectDialog);
document.querySelectorAll(".nav-btn").forEach(btn => btn.addEventListener("click", () => {
  currentView = btn.dataset.view;
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b === btn));
  render();
}));

render();
