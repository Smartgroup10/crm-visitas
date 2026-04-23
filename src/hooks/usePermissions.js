import { useAuth } from "./useAuth";

/**
 * Helper centralizado de permisos derivados del rol del usuario autenticado.
 *
 * Niveles:
 *  - admin      → todo, incluyendo gestión de usuarios
 *  - supervisor → todo excepto gestión de usuarios
 *  - tecnico    → solo lectura en tareas, clientes y técnicos; sin acceso a usuarios
 *
 * La autorización definitiva se aplica en el backend (requireRole). Estos flags
 * sirven para ocultar/desactivar elementos de UI y evitar peticiones que
 * acabarían en un 403.
 */
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

  return {
    role,
    isAdmin,
    isSupervisor,
    isTecnico,
    canManage,
    canManageUsers,
  };
}
