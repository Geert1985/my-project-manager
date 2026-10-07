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
  app.innerHTML = `<div class="card"><h2>Mijn projecten</h2><p class="muted">Projecten, taken en voortgang op één plaats.</p></div>` +
    state.projects.map(projectCard).join("");
}

function projectCard(project) {
  const stats = getTaskStats(project.id);
  return `<article class="card" data-project="${project.id}">
    <h2>${esc(project.name)}</h2>
    <p class="muted">${esc(project.description || project.category || "Geen beschrijving")}</p>
    <div class="project-meta"><span>${stats.completed} / ${stats.total} taken</span><strong>${stats.percent}%</strong></div>
    <div class="progress"><div style="width:${stats.percent}%"></div></div>
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
          <button class="secondary small" onclick="removeTask('${task.id}')">Verwijder</button>
        </div>
        ${children.length ? `<div class="children">${renderTaskTree(projectId, task.id)}</div>` : ""}
      </div>
    </div>`;
  }).join("");
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
  createProject({
    name: document.getElementById("projectName").value.trim(),
    description: document.getElementById("projectDescription").value.trim(),
    category: document.getElementById("projectCategory").value.trim()
  });
  document.getElementById("projectDialog").close();
  render();
});

function openTaskDialog(projectId, parentId) {
  document.getElementById("taskForm").reset();
  document.getElementById("taskParentId").value = parentId || "";
  document.getElementById("taskDialog").showModal();
}

document.getElementById("taskForm").addEventListener("submit", event => {
  event.preventDefault();
  createTask({
    projectId: currentProjectId,
    parentId: document.getElementById("taskParentId").value || null,
    name: document.getElementById("taskName").value.trim(),
    description: document.getElementById("taskDescription").value.trim(),
    priority: document.getElementById("taskPriority").value
  });
  document.getElementById("taskDialog").close();
  render();
});

document.getElementById("newProjectBtn").addEventListener("click", openProjectDialog);
document.querySelectorAll(".nav-btn").forEach(btn => btn.addEventListener("click", () => {
  currentView = btn.dataset.view;
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b === btn));
  render();
}));

render();
