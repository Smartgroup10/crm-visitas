import { TASK_TYPES } from "../data/taskTypes";

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
    return { valid: false, errors };
  }

  const fields = TASK_TYPES[task.type].specificFields;
  for (const f of fields) {
    if (!f.required) continue;
    const val = task[f.name];

    if (f.type === "text" || f.type === "textarea") {
      if (typeof val !== "string" || !val.trim()) {
        errors[f.name] = "Este campo es obligatorio";
      }
    } else if (f.type === "select") {
      if (!val || !f.options.includes(val)) {
        errors[f.name] = "Selecciona una opción";
      }
    } else if (f.type === "date") {
      if (!val) {
        errors[f.name] = "Este campo es obligatorio";
      }
    } else if (f.type === "boolean") {
      if (typeof val !== "boolean") {
        errors[f.name] = "Este campo es obligatorio";
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
