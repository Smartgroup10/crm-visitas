import { TASK_TYPES } from "../data/taskTypes";

/**
 * Convierte una fila de Supabase (snake_case) → objeto de tarea del frontend (camelCase).
 * Los campos específicos del tipo se mezclan al nivel raíz del objeto.
 */
export function taskFromDb(row) {
  return {
    id:             row.id,
    title:          row.title          ?? "",
    date:           row.date           ?? "",
    status:         row.status         ?? "No iniciado",
    priority:       row.priority       ?? "Media",
    clientId:       row.client_id      ?? "",
    phone:          row.phone          ?? "",
    technicianIds:  Array.isArray(row.technician_ids) ? row.technician_ids : [],
    vehicle:        row.vehicle        ?? "",
    type:           row.type           ?? "",
    notes:          row.notes          ?? "",
    materials:      row.materials      ?? "",
    estimatedTime:  row.estimated_time ?? "",
    attachments:    Array.isArray(row.attachments) ? row.attachments : [],
    // Campos específicos del tipo se expanden al nivel raíz
    ...(row.type_fields ?? {}),
  };
}

/**
 * Convierte un objeto de tarea del frontend (camelCase) → fila para Supabase (snake_case).
 * Los campos específicos del tipo se agrupan en type_fields (JSONB).
 */
export function taskToDb(task, userId) {
  // Extraer campos específicos según el tipo
  const typeFields = {};
  if (task.type && TASK_TYPES[task.type]) {
    for (const field of TASK_TYPES[task.type].specificFields) {
      if (Object.prototype.hasOwnProperty.call(task, field.name)) {
        typeFields[field.name] = task[field.name];
      }
    }
  }

  return {
    title:          task.title          ?? "",
    date:           task.date           ?? null,
    status:         task.status         ?? "No iniciado",
    priority:       task.priority       ?? "Media",
    client_id:      task.clientId       || null,
    phone:          task.phone          ?? "",
    technician_ids: Array.isArray(task.technicianIds) ? task.technicianIds : [],
    vehicle:        task.vehicle        ?? "",
    type:           task.type           ?? null,
    notes:          task.notes          ?? "",
    materials:      task.materials      ?? "",
    estimated_time: task.estimatedTime  ?? "",
    attachments:    Array.isArray(task.attachments) ? task.attachments : [],
    type_fields:    typeFields,
    updated_by:     userId              ?? null,
  };
}
