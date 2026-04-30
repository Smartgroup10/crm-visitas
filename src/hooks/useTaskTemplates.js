import { useCallback, useEffect, useState } from "react";

import { api, ApiError } from "../lib/api";
import { getSocket } from "../lib/socket";

/**
 * Lista de plantillas de tarea + CRUD.
 *
 * Se sincroniza por socket: si otro usuario crea/edita/borra una
 * plantilla en otra pestaña, las aplicamos al estado local sin
 * re-fetch (el payload ya viene completo desde el backend).
 *
 * Devuelve:
 *   { items, loading, error, create, update, remove, refresh }
 *
 * Patrón optimista: create devuelve la fila creada y la añadimos
 * localmente al instante. Si falla, lanzamos para que el caller
 * decida (típicamente el form mostrará el error y dejará al usuario
 * reintentar).
 */
export function useTaskTemplates() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get("/task-templates");
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error cargando plantillas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Sincronización en tiempo real entre pestañas / usuarios.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (msg) => {
      if (!msg) return;
      if (msg.type === "insert" && msg.template) {
        setItems((prev) =>
          prev.some((t) => t.id === msg.template.id) ? prev : [...prev, msg.template]
        );
      } else if (msg.type === "update" && msg.template) {
        setItems((prev) => prev.map((t) => (t.id === msg.template.id ? msg.template : t)));
      } else if (msg.type === "delete" && msg.id) {
        setItems((prev) => prev.filter((t) => t.id !== msg.id));
      }
    };
    socket.on("task-templates:change", handler);
    return () => socket.off("task-templates:change", handler);
  }, []);

  const create = useCallback(async (payload) => {
    const created = await api.post("/task-templates", payload);
    setItems((prev) =>
      prev.some((t) => t.id === created.id) ? prev : [...prev, created]
    );
    return created;
  }, []);

  const update = useCallback(async (id, payload) => {
    const updated = await api.put(`/task-templates/${id}`, payload);
    setItems((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    return updated;
  }, []);

  const remove = useCallback(async (id) => {
    await api.delete(`/task-templates/${id}`);
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { items, loading, error, create, update, remove, refresh };
}
