import { createContext } from "react";

/**
 * Context para las notificaciones in-app "ricas" (con icono branded,
 * acciones, animación, sonido). Es DIFERENTE del ToastContext: los
 * toasts son feedback efímero de acciones del usuario ("Cliente
 * guardado"), las notificaciones son avisos del sistema dirigidos al
 * usuario y persisten más tiempo.
 */
export const NotificationStackContext = createContext(null);
