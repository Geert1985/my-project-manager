const app = document.getElementById("app");
let currentView = "dashboard";
let currentProjectId = null;
let currentCheckId = null;

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]));
}

function render() {
  if (currentView === "dashboard") renderDashboard();
  else if (currentView === "tasks") renderAllTasks();
  else if (currentView === "project") renderProject();
  else if (currentView === "protocols") renderProtocols();
  else if (currentView === "check") renderCheck();
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
  </div>`;
}

function renderTaskTree(projectId, parentId) {
  const tasks = getProjectTasks(projectId).filter(t => t.parentId === parentId);
  if (!tasks.length) return `<p class="muted small">Nog geen taken.</p>`;

  return tasks.map(task => {
    const children = getChildren(task.id);
    const sources = getTaskSources(task.id);
    return `<div class="task-row">
      <input type="checkbox" ${task.status === "completed" ? "checked" : ""} onchange="toggleTask('${task.id}', this.checked)">
      <div class="task-content">
        <div class="task-name ${task.status === "completed" ? "completed" : ""}">
          <strong>${esc(task.name)}</strong>
          ${task.status === "in_progress" ? `<span class="muted small"> — Bezig</span>` : ""}
        </div>
        ${task.description ? `<div class="muted small">${esc(task.description)}</div>` : ""}
        <div class="task-actions">
          <button class="secondary small" onclick="openTaskDialog('${projectId}', '${task.id}')">＋ Subtaak</button>
          <button class="secondary small" onclick="openSourceDialog('${projectId}', '${task.id}')">＋ Bron</button>
          <button class="secondary small" onclick="openCheckDialog('${task.id}')">＋ Controle</button>
          <button class="secondary small" onclick="removeTask('${task.id}')">Verwijder</button>
        </div>
        ${sources.length ? renderTaskSources(sources) : ""}
        ${children.length ? `<div class="children">${renderTaskTree(projectId, task.id)}</div>` : ""}
      </div>
    </div>`;
  }).join("");
}

function renderTaskSources(sources) {
  return `<div class="source-list">${sources.map(source => {
    const versions = getSourceVersions(source.id);
    return `<div class="source-item">
      <div><strong>Bron:</strong> ${esc(source.title)} <span class="badge">${esc(source.type)}</span></div>
      ${source.author ? `<div class="muted small">Auteur: ${esc(source.author)}</div>` : ""}
      <div class="source-actions">
        <button class="secondary small" onclick="openSourceVersionDialog('${source.id}')">＋ Versie</button>
        ${versions.length ? `<span class="muted small">${versions.length} versie${versions.length === 1 ? "" : "s"}</span>` : `<span class="muted small">Geen versies</span>`}
      </div>
      ${versions.length ? `<div class="source-versions">${versions.map(v => `<div class="muted small">v${esc(v.version)}${v.label ? ` — ${esc(v.label)}` : ""}</div>`).join("")}</div>` : ""}
    </div>`;
  }).join("")}</div>`;
}

function openCheckDialog(taskId) {
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
    .map(protocol => `<option value="${protocol.id}">${esc(protocol.name)} (v${esc(protocol.version)})</option>`)
    .join("");

  document.getElementById("checkSourceVersionId").innerHTML = sourceVersions
    .map(({ source, version }) => `<option value="${version.id}">${esc(source.title)} — v${esc(version.version)}</option>`)
    .join("");

  document.getElementById("checkDialog").showModal();
}

document.getElementById("checkForm").addEventListener("submit", event => {
  event.preventDefault();
  try {
    const check = createCheck({
      taskId: document.getElementById("checkTaskId").value,
      protocolId: document.getElementById("checkProtocolId").value,
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
  const sourceVersion = getSourceVersion(check.sourceVersionId);
  const source = sourceVersion ? getSource(sourceVersion.sourceId) : null;
  const results = getCheckResults(check.id);
  const items = getProtocolItems(check.protocolId);
  const resultByItem = new Map(results.map(result => [result.protocolItemId, result]));

  app.innerHTML = `
    <div class="card">
      <button class="secondary" onclick="returnFromCheck()">← Terug</button>
      <h2 style="margin-top:12px">Controle</h2>
      <p><strong>Protocol:</strong> ${esc(protocol?.name || "")} v${esc(protocol?.version || "")}</p>
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
  const open = state.tasks.filter(t => t.status !== "completed");
  app.innerHTML = `<div class="card"><h2>Alle openstaande taken</h2>
    ${open.length ? open.map(t => `<div class="task-row">
      <input type="checkbox" onchange="toggleTask('${t.id}', this.checked)">
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
  const items = getProtocolItems(protocol.id);
  return `
    <article class="card">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
        <div>
          <h2>${esc(protocol.name)}</h2>
          <p class="muted">${esc(protocol.description || "Geen beschrijving")}</p>
        </div>
        <span class="badge">v${esc(protocol.version)} · ${protocol.active ? "actief" : "inactief"}</span>
      </div>
      <div class="protocol-items">
        <h3>Controlepunten (${items.length})</h3>
        ${items.length ? items.map(item => `
          <div class="protocol-item">
            <div><strong>${item.order}. ${esc(item.title)}</strong>${item.required ? ` <span class="badge">verplicht</span>` : ""}</div>
            ${item.description ? `<div class="muted small">${esc(item.description)}</div>` : ""}
          </div>`).join("") : `<p class="muted small">Nog geen controlepunten.</p>`}
      </div>
      <div class="task-actions">
        <button class="secondary" onclick="openProtocolItemDialog('${protocol.id}')">＋ Controlepunt</button>
      </div>
    </article>`;
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

function openProtocolItemDialog(protocolId) {
  document.getElementById("protocolItemForm").reset();
  document.getElementById("protocolItemProtocolId").value = protocolId;
  document.getElementById("protocolItemRequired").checked = true;
  document.getElementById("protocolItemDialog").showModal();
}

document.getElementById("protocolItemForm").addEventListener("submit", event => {
  event.preventDefault();
  try {
    createProtocolItem({
      protocolId: document.getElementById("protocolItemProtocolId").value,
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

function removeTask(id) {
  if (confirm("Deze taak en eventuele subtaken verwijderen?")) {
    deleteTask(id);
    render();
  }
}

function removeProject(id) {
  if (confirm("Dit project en alle taken verwijderen?")) {
    deleteProject(id);
    render();
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
  currentProjectId = projectId;
  document.getElementById("sourceForm").reset();
  document.getElementById("sourceTaskId").value = taskId;
  document.getElementById("sourceDialog").showModal();
}

document.getElementById("sourceForm").addEventListener("submit", event => {
  event.preventDefault();
  try {
    createSource({
      projectId: currentProjectId,
      taskId: document.getElementById("sourceTaskId").value || null,
      type: document.getElementById("sourceType").value,
      title: document.getElementById("sourceTitle").value,
      author: document.getElementById("sourceAuthor").value,
      publisher: document.getElementById("sourcePublisher").value,
      url: document.getElementById("sourceUrl").value,
      description: document.getElementById("sourceDescription").value
    });
    document.getElementById("sourceDialog").close();
    render();
  } catch (error) {
    alert(error.message);
  }
});

function openSourceVersionDialog(sourceId) {
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

document.getElementById("newProjectBtn").addEventListener("click", openProjectDialog);
document.querySelectorAll(".nav-btn").forEach(btn => btn.addEventListener("click", () => {
  currentView = btn.dataset.view;
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b === btn));
  render();
}));

render();
