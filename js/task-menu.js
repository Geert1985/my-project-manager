let openedTaskMenu = null;

function closeTaskMenu(restoreFocus = false) {
  if (!openedTaskMenu) return;
  const { menu, trigger } = openedTaskMenu;
  openedTaskMenu = null;
  menu.hidden = true;
  trigger.setAttribute("aria-expanded", "false");
  if (restoreFocus) trigger.focus({ preventScroll: true });
}

function toggleTaskMenu(trigger, last = false) {
  const wasOpen = openedTaskMenu?.trigger === trigger;
  closeTaskMenu();
  if (wasOpen) return;
  const menu = document.getElementById(trigger.getAttribute("aria-controls"));
  if (!menu) return;
  openedTaskMenu = { menu, trigger };
  menu.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
  positionTaskMenu();
  const items = [...menu.querySelectorAll("button:not(:disabled)")];
  (last ? items.at(-1) : items[0])?.focus({ preventScroll: true });
}

function positionTaskMenu() {
  if (!openedTaskMenu) return;
  const { menu, trigger } = openedTaskMenu;
  const rect = trigger.getBoundingClientRect();
  if (rect.bottom <= 0 || rect.top >= innerHeight) { closeTaskMenu(); return; }
  const box = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(rect.right - box.width, innerWidth - box.width - 8))}px`;
  const top = rect.bottom + box.height + 8 <= innerHeight ? rect.bottom + 4 : rect.top - box.height - 4;
  menu.style.top = `${Math.max(8, Math.min(top, innerHeight - box.height - 8))}px`;
}

function taskMenuTriggerKey(trigger, event) {
  if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
  event.preventDefault();
  if (openedTaskMenu?.trigger === trigger) closeTaskMenu();
  toggleTaskMenu(trigger, event.key === "ArrowUp");
}

function runTaskMenuAction(button, action) {
  const menu = button.closest(".task-menu");
  const { taskId, projectId } = menu.dataset;
  // Return to the trigger before invoking existing actions, including dialogs.
  closeTaskMenu(true);
  if (action === "source") openSourceDialog(projectId, taskId);
  else if (action === "up" || action === "down") moveTaskFromUi(taskId, action);
  else if (action === "delete") removeTask(taskId);
}

document.addEventListener("pointerdown", event => {
  if (openedTaskMenu && !openedTaskMenu.menu.contains(event.target)
    && !openedTaskMenu.trigger.contains(event.target)) closeTaskMenu();
});

document.addEventListener("keydown", event => {
  if (!openedTaskMenu) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeTaskMenu(true);
    return;
  }
  if (event.key === "Tab") { closeTaskMenu(true); return; }
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  if (!openedTaskMenu.menu.contains(event.target)) return;
  event.preventDefault();
  const items = [...openedTaskMenu.menu.querySelectorAll("button:not(:disabled)")];
  const index = items.indexOf(document.activeElement);
  const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
    : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
  items[next]?.focus();
});
document.addEventListener("scroll", event => {
  if (openedTaskMenu && !openedTaskMenu.menu.contains(event.target)) positionTaskMenu();
}, true);
window.addEventListener("resize", positionTaskMenu);
