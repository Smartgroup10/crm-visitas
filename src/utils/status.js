export function statusSlug(status) {
  return status.toLowerCase().replaceAll(" ", "-");
}

export function getStatusClass(status) {
  switch (status) {
    case "Listo":
      return "status-done";
    case "En curso":
      return "status-progress";
    case "Bloqueado":
      return "status-blocked";
    default:
      return "status-pending";
  }
}

export function getPriorityClass(priority) {
  switch (priority) {
    case "Urgente":
      return "priority-urgent";
    case "Alta":
      return "priority-high";
    case "Media":
      return "priority-medium";
    default:
      return "priority-low";
  }
}
