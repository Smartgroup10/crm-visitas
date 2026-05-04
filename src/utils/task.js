import { getClientName, peopleFromIds } from "./id";
import { defaultsForType, TASK_TYPES } from "../data/taskTypes";

export function emptyTask(date, type = "incidencia") {
  return {
    id: null,
    title: "",
    clientId: "",
    phone: "",
    type,
    date,
    startTime: "",
    technicianIds: [],
    status: "No iniciado",
    priority: "Media",
    notes: "",
    materials: "",
    estimatedTime: "",
    vehicle: "",
    attachments: [],
    ...defaultsForType(type),
  };
}

export function normalizeTask(task) {
  return {
    ...task,
    technicianIds: Array.isArray(task.technicianIds) ? task.technicianIds : [],
    attachments: Array.isArray(task.attachments) ? task.attachments : [],
  };
}

/**
 * Predicado canónico de "tarea que requiere atención inmediata":
 *   - estado Bloqueado (independientemente de prioridad)
 *   - O urgente y aún no iniciada
 *
 * Usado por el badge del Sidebar y la sección "Requieren acción"
 * de Mi Trabajo. Mantenerlo en un único sitio evita derivas (un
 * lugar diciendo 7 y otro diciendo 9 para los mismos datos).
 */
export function requiresAttention(task) {
  return (
    task.status === "Bloqueado" ||
    (task.priority === "Urgente" && task.status === "No iniciado")
  );
}

export function getAttentionTasks(tasks) {
  return tasks.filter(requiresAttention);
}

export function taskHaystack(task, clients, technicians) {
  const typeLabel = TASK_TYPES[task.type]?.label || task.type || "";
  return [
    task.title,
    getClientName(task.clientId, clients),
    task.phone,
    peopleFromIds(task.technicianIds, technicians),
    typeLabel,
    task.notes,
    task.materials,
    task.estimatedTime,
    task.vehicle,
    ...(task.attachments || []).map((f) => f.name),
  ]
    .join(" ")
    .toLowerCase();
}
