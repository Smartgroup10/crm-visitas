import { useAuth } from "./useAuth";

/**
 * Helper centralizado de permisos derivados del rol del usuario autenticado.
 *
 * Niveles:
 *  - admin      → todo, incluyendo gestión de usuarios y borrado de tareas
 *  - supervisor → todo excepto gestión de usuarios. Puede borrar tareas.
 *  - tecnico    → puede crear y editar tareas (cualquier campo, cualquier
 *                 tarea — puede asignarse a sí mismo o a otros). NO puede
 *                 borrar tareas (acción destructiva reservada a admin/
 *                 supervisor) ni gestionar usuarios.
 *
 * La autorización definitiva se aplica en el backend (requireRole +
 * canEditOrCreateTask). Estos flags sirven para mostrar/ocultar UI y
 * evitar peticiones que acabarían en un 403.
 */
export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role || null;

  const isAdmin      = role === "admin";
  const isSupervisor = role === "supervisor";
  const isTecnico    = role === "tecnico";

  // admins y supervisores pueden BORRAR tareas, clientes y usuarios.
  // Sigue siendo la línea entre "modificar" (todos pueden) y "destruir".
  const canManage = isAdmin || isSupervisor;

  // solo admin puede gestionar usuarios.
  const canManageUsers = isAdmin;

  // Crear/editar tareas: cualquier usuario autenticado con un rol
  // válido (admin/supervisor/técnico). Un técnico que descubre algo
  // importante en campo puede dar de alta la tarea él mismo y
  // asignarla a quien corresponda — sin tener que pedir al
  // supervisor que lo cree por él.
  const canCreateTasks = isAdmin || isSupervisor || isTecnico;

  /**
   * ¿Puede el usuario actual editar esta tarea?
   * Sí cuando tiene rol válido (admin/supervisor/técnico). El backend
   * acepta el PATCH sin restricciones de asignación, así que el UI
   * deja editar también. Si en el futuro queremos restringir
   * "técnicos sólo sus tareas", aquí es donde se filtra. */
  function canEditTask(task) {
    if (!task) return canCreateTasks;        // borrador nuevo
    return canCreateTasks;
  }

  /**
   * ¿Puede editar este campo concreto?
   * Ya no hay filtro por campo — todos los roles con permiso de
   * edición pueden tocar cualquier campo. Función conservada para
   * compatibilidad con TaskModal y posibles restricciones futuras
   * (p.ej. "técnico no puede cambiar prioridad"). */
  // eslint-disable-next-line no-unused-vars
  function canEditTaskField(task, name) {
    return canEditTask(task);
  }

  return {
    role,
    isAdmin,
    isSupervisor,
    isTecnico,
    canManage,
    canManageUsers,
    canCreateTasks,
    canEditTask,
    canEditTaskField,
  };
}
