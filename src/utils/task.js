import { getClientName, peopleFromIds } from "./id";

export function emptyTask(date) {
  return {
    id: null,
    title: "",
    clientId: "",
    phone: "",
    category: "Visita",
    date,
    technicianIds: [],
    status: "No iniciado",
    priority: "Media",
    notes: "",
    materials: "",
    estimatedTime: "",
    vehicle: "",
    attachments: [],
  };
}

export function normalizeTask(task) {
  return {
    ...task,
    technicianIds: Array.isArray(task.technicianIds) ? task.technicianIds : [],
    attachments: Array.isArray(task.attachments) ? task.attachments : [],
  };
}

export function taskHaystack(task, clients, technicians) {
  return [
    task.title,
    getClientName(task.clientId, clients),
    task.phone,
    peopleFromIds(task.technicianIds, technicians),
    task.category,
    task.notes,
    task.materials,
    task.estimatedTime,
    task.vehicle,
    ...(task.attachments || []).map((f) => f.name),
  ]
    .join(" ")
    .toLowerCase();
}
