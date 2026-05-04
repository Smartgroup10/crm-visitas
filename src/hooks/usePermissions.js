import { useAuth } from "./useAuth";

/**
 * Helper centralizado de permisos derivados del rol del usuario autenticado.
 *
 * Niveles:
 *  - admin      → todo, incluyendo gestión de usuarios
 *  - supervisor → todo excepto gestión de usuarios
 *  - tecnico    → lectura general; sobre las tareas que tiene asignadas
 *                 puede actualizar estado, notas, materiales, tiempo y
 *                 adjuntos (no puede reasignar, cambiar fecha/hora,
 *                 prioridad, cliente ni borrar)
 *
 * La autorización definitiva se aplica en el backend (requireRole +
 * canEditTask). Estos flags sirven para ocultar/desactivar UI y evitar
 * peticiones que acabarían en un 403.
 */

// Campos que un técnico puede editar en una tarea suya (espejo del set
// TECH_EDITABLE_FIELDS del backend, pero usando los nombres camelCase
// del frontend — el taskMapper traduce a snake_case al guardar).
export const TECH_EDITABLE_FIELDS = new Set([
  "status",
  "notes",
  "materials",
  "estimatedTime",
  "attachments",
]);

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role || null;

  const isAdmin      = role === "admin";
  const isSupervisor = role === "supervisor";
  const isTecnico    = role === "tecnico";

  // admins y supervisores pueden crear / editar / borrar tareas, clientes y técnicos.
  const canManage = isAdmin || isSupervisor;

  // solo admin puede gestionar usuarios.
  const canManageUsers = isAdmin;

  /**
   * ¿Puede el usuario actual editar (parcialmente) esta tarea?
   *   - admin / supervisor: siempre que la tarea exista
   *   - tecnico: solo si está en su lista de asignados
   *   - sin sesión: nunca
   *
   * Para "edición completa" (todos los campos) sigue mandando `canManage`.
   * Este flag indica si la tarea es interactiva para el usuario actual
   * (mostrar botón "Marcar como finalizada", habilitar campos seguros). */
  function canEditTask(task) {
    if (!task) return false;
    if (canManage) return true;
    if (isTecnico && user?.id) {
      const ids = Array.isArray(task.technicianIds) ? task.technicianIds : [];
      return ids.includes(user.id);
    }
    return false;
  }

  /**
   * Para una tarea concreta, ¿puede el usuario editar el campo `name`?
   * - admin / supervisor: cualquier campo (mientras canEditTask = true)
   * - tecnico: sólo los de TECH_EDITABLE_FIELDS, y sólo si asignado
   * El TaskModal usa esto para deshabilitar campos visualmente cuando
   * el técnico abre una tarea suya. */
  function canEditTaskField(task, name) {
    if (!canEditTask(task)) return false;
    if (canManage) return true;
    return TECH_EDITABLE_FIELDS.has(name);
  }

  return {
    role,
    isAdmin,
    isSupervisor,
    isTecnico,
    canManage,
    canManageUsers,
    canEditTask,
    canEditTaskField,
  };
}
