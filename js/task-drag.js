// Pointer-only UX state. Ordering and persistence belong to reorderTask().
let taskDrag = null;
let taskDragFrame = null;

function startTaskDrag(handle, event) {
  if (taskSortView !== "manual" || handle.disabled || !event.isPrimary || event.button !== 0) return;
  cancelTaskDrag();
  event.preventDefault();
  handle.focus({ preventScroll: true });
  taskDrag = {
    handle, pointerId: event.pointerId, taskId: handle.dataset.taskId,
    startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY,
    active: false, targetId: null, placement: null
  };
  handle.setPointerCapture(event.pointerId);
}

function updateTaskDrag(event) {
  if (!taskDrag || event.pointerId !== taskDrag.pointerId) return;
  taskDrag.x = event.clientX;
  taskDrag.y = event.clientY;
  if (!taskDrag.active && Math.hypot(event.clientX - taskDrag.startX, event.clientY - taskDrag.startY) < 6) return;
  event.preventDefault();
  if (!taskDrag.active) {
    taskDrag.active = true;
    taskDrag.handle.classList.add("dragging");
    taskDragFrame = requestAnimationFrame(scrollTaskDrag);
  }
  updateTaskDropTarget();
}

function updateTaskDropTarget() {
  app.querySelectorAll(".task-drop-before, .task-drop-after").forEach(header => {
    header.classList.remove("task-drop-before", "task-drop-after");
  });
  taskDrag.targetId = null;
  const header = document.elementFromPoint(taskDrag.x, taskDrag.y)?.closest("[data-task-header]");
  const task = state.tasks.find(item => item.id === taskDrag.taskId);
  const target = state.tasks.find(item => item.id === header?.dataset.taskHeader);
  if (!task || !target || task.id === target.id || task.projectId !== target.projectId
    || (task.parentId || null) !== (target.parentId || null)) return;
  const rect = header.getBoundingClientRect();
  taskDrag.targetId = target.id;
  taskDrag.placement = taskDrag.y < rect.top + rect.height / 2 ? "before" : "after";
  header.classList.add(`task-drop-${taskDrag.placement}`);
}

function scrollTaskDrag() {
  if (!taskDrag?.active) return;
  const edge = 64;
  // Avoid the fixed topbar and bottom navigation while scrolling.
  const speed = taskDrag.y < edge ? -10 : taskDrag.y > innerHeight - 100 ? 10 : 0;
  if (speed) {
    window.scrollBy(0, speed);
    updateTaskDropTarget();
  }
  taskDragFrame = requestAnimationFrame(scrollTaskDrag);
}

function finishTaskDrag(event) {
  if (!taskDrag || event.pointerId !== taskDrag.pointerId) return;
  if (taskDrag.active) {
    taskDrag.x = event.clientX;
    taskDrag.y = event.clientY;
    updateTaskDropTarget();
  }
  const { active, taskId, targetId, placement } = taskDrag;
  cancelTaskDrag();
  if (taskSortView !== "manual" || !active || !targetId) return;
  try {
    if (reorderTask(taskId, targetId, placement)) {
      render();
      restoreAppFocus(`drag-${taskId}`);
    }
  } catch (error) {
    alert(error.message);
  }
}

function cancelTaskDrag() {
  const drag = taskDrag;
  taskDrag = null;
  if (taskDragFrame !== null) cancelAnimationFrame(taskDragFrame);
  taskDragFrame = null;
  drag?.handle.classList.remove("dragging");
  app.querySelectorAll(".task-drop-before, .task-drop-after").forEach(header => {
    header.classList.remove("task-drop-before", "task-drop-after");
  });
  if (drag?.handle.hasPointerCapture(drag.pointerId)) drag.handle.releasePointerCapture(drag.pointerId);
}

app.addEventListener("keydown", event => {
  if (event.key === "Escape" && taskDrag) {
    event.preventDefault();
    cancelTaskDrag();
  }
});
