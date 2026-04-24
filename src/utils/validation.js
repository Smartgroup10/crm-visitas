import { TASK_TYPES } from "../data/taskTypes";

/**
 * Validación del formulario de tareas.
 *
 * Mantenemos únicamente las reglas de los campos comunes que el usuario
 * edita en la UI (título, cliente, técnicos y tipo). Los campos específicos
 * de cada tipo ya no se editan desde el modal: se almacenan con defaults
 * (ver `sanitizeForType` en TaskModal) para no romper la estructura ya
 * guardada en BBDD, pero no bloqueamos el guardado si están vacíos.
 */
export function validateTask(task) {
  const errors = {};

  if (!task.title || !task.title.trim()) {
    errors.title = "Este campo es obligatorio";
  }
  if (!task.clientId) {
    errors.clientId = "Selecciona un cliente";
  }
  if (!Array.isArray(task.technicianIds) || task.technicianIds.length === 0) {
    errors.technicianIds = "Selecciona al menos un técnico";
  }
  if (!task.type || !TASK_TYPES[task.type]) {
    errors.type = "Selecciona un tipo";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
