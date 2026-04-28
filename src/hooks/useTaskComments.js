import { useCallback, useEffect, useState } from "react";

import { api, ApiError } from "../lib/api";
import { getSocket } from "../lib/socket";

/**
 * Maneja el hilo de comentarios de una tarea.
 *
 * Devuelve:
 *   { items, loading, error, sending, addComment, updateComment, deleteComment, refresh }
 *
 * Los `items` están ordenados ascendentemente (más antiguos arriba)
 * para que el thread se lea como un chat normal.
 *
 * Tiempo real: escucha el evento `task-comments:change` que emite el
 * backend en cada mutación. Si llega un evento sobre ESTA tarea,
 * mergea el cambio en el estado local (insert / update / delete) sin
 * necesidad de re-fetch — los payloads ya vienen completos.
 */
export function useTaskComments(taskId) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    if (!taskId) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/tasks/${taskId}/comments`);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error cargando comentarios");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Sincronización en tiempo real con cambios de otros clientes
  // (otra pestaña, otro técnico desde su móvil, etc).
  useEffect(() => {
    if (!taskId) return;
    const socket = getSocket();
    if (!socket) return;

    const handler = (msg) => {
      if (!msg || msg.taskId !== taskId) return;
      if (msg.type === "insert" && msg.comment) {
        setItems((prev) => {
          // Defensa contra duplicados: si ya tenemos esa id (porque
          // el socket llegó después del POST que ya añadimos), no la
          // añadimos otra vez.
          if (prev.some((c) => c.id === msg.comment.id)) return prev;
          return [...prev, msg.comment];
        });
      } else if (msg.type === "update" && msg.comment) {
        setItems((prev) => prev.map((c) => (c.id === msg.comment.id ? msg.comment : c)));
      } else if (msg.type === "delete" && msg.commentId) {
        setItems((prev) => prev.filter((c) => c.id !== msg.commentId));
      }
    };
    socket.on("task-comments:change", handler);
    return () => socket.off("task-comments:change", handler);
  }, [taskId]);

  const addComment = useCallback(async (body) => {
    const trimmed = (body || "").trim();
    if (!trimmed || !taskId) return null;
    setSending(true);
    setError(null);
    try {
      const created = await api.post(`/tasks/${taskId}/comments`, { body: trimmed });
      // Inserción optimista local. El socket llegará después con el
      // mismo objeto pero el handler tiene dedup por id.
      setItems((prev) =>
        prev.some((c) => c.id === created.id) ? prev : [...prev, created]
      );
      return created;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Error enviando comentario";
      setError(msg);
      throw err;
    } finally {
      setSending(false);
    }
  }, [taskId]);

  const updateComment = useCallback(async (commentId, body) => {
    const trimmed = (body || "").trim();
    if (!trimmed || !taskId) return null;
    try {
      const updated = await api.put(`/tasks/${taskId}/comments/${commentId}`, { body: trimmed });
      setItems((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      return updated;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Error actualizando comentario";
      setError(msg);
      throw err;
    }
  }, [taskId]);

  const deleteComment = useCallback(async (commentId) => {
    if (!taskId) return;
    try {
      await api.delete(`/tasks/${taskId}/comments/${commentId}`);
      setItems((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Error eliminando comentario";
      setError(msg);
      throw err;
    }
  }, [taskId]);

  return { items, loading, error, sending, addComment, updateComment, deleteComment, refresh };
}
