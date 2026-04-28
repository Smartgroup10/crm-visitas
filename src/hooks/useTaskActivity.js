import { useCallback, useEffect, useState } from "react";

import { api, ApiError } from "../lib/api";
import { getSocket } from "../lib/socket";

/**
 * Carga el timeline de actividad de una tarea y lo mantiene fresco:
 *  - Hace fetch inicial al `GET /api/tasks/:id/activity`.
 *  - Refresca cuando otro cliente emite `tasks:change` por socket
 *    sobre ESTA tarea (alguien la editó en otra pestaña / dispositivo).
 *
 * Devuelve `{ items, loading, error, refresh }` para que la UI pueda
 * mostrar estados intermedios sin hacer fetch en cada render.
 */
export function useTaskActivity(taskId) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const refresh = useCallback(async () => {
    if (!taskId) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/tasks/${taskId}/activity`);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error cargando actividad");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Mantenerse al día con cambios remotos: si llega un `tasks:change`
  // del backend para esta tarea, refrescamos. Es eventual y barato
  // (la tabla por tarea suele tener decenas de filas como mucho).
  useEffect(() => {
    if (!taskId) return;
    const socket = getSocket();
    if (!socket) return;
    const handler = (msg) => {
      if (!msg) return;
      if (msg.type === "delete" && msg.id === taskId) {
        setItems([]);
        return;
      }
      if ((msg.type === "insert" || msg.type === "update") && msg.task?.id === taskId) {
        refresh();
      }
    };
    socket.on("tasks:change", handler);
    return () => socket.off("tasks:change", handler);
  }, [taskId, refresh]);

  return { items, loading, error, refresh };
}
