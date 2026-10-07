const app = document.getElementById("app");
let currentView = "dashboard";
let currentProjectId = null;

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]));
}

function render() {
  if (currentView === "dashboard") renderDashboard();
  else if (currentView === "tasks") renderAllTasks();
  else if (currentView === "project") renderProject();
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

function renderAllTasks() {
  const open = state.tasks.filter(t => t.status !== "completed");
  app.innerHTML = `<div class="card"><h2>Alle openstaande taken</h2>
    ${open.length ? open.map(t => `<div class="task-row">
      <input type="checkbox" onchange="toggleTask('${t.id}', this.checked)">
      <div class="task-content"><strong>${esc(t.name)}</strong><div class="muted small">${esc(getProject(t.projectId)?.name || "")}</div></div>
    </div>`).join("") : `<div class="empty">Geen openstaande taken.</div>`}
  </div>`;
}

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
