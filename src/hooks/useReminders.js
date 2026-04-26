import { useCallback, useEffect, useState } from "react";

import { api, ApiError } from "../lib/api";

/**
 * Hook para los recordatorios personales del usuario actual.
 *
 *   const { reminders, loading, refresh, create, update, dismiss, remove } = useReminders();
 *
 * Por defecto carga los `pending`. Pasa `{ status: "all" }` o
 * `{ status: "sent" }` si necesitas otro listado.
 */
export function useReminders({ status = "pending" } = {}) {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/reminders?status=${encodeURIComponent(status)}`);
      setReminders(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Sin sesión: el wrapper de api ya dispara el evento auth:unauthorized.
        setReminders([]);
      } else {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { refresh(); }, [refresh]);

  const create = useCallback(async (payload) => {
    const created = await api.post("/reminders", payload);
    setReminders((rs) => sortByDate([...rs, created]));
    return created;
  }, []);

  const update = useCallback(async (id, patch) => {
    const updated = await api.patch(`/reminders/${id}`, patch);
    setReminders((rs) => {
      // Si cambia el status (re-pending) puede entrar/salir del listado actual.
      const next = rs.map((r) => (r.id === id ? updated : r));
      return sortByDate(next.filter((r) => status === "all" || r.status === status));
    });
    return updated;
  }, [status]);

  const dismiss = useCallback(async (id) => {
    const updated = await api.post(`/reminders/${id}/dismiss`);
    setReminders((rs) => rs.filter((r) => r.id !== id));
    return updated;
  }, []);

  const remove = useCallback(async (id) => {
    await api.delete(`/reminders/${id}`);
    setReminders((rs) => rs.filter((r) => r.id !== id));
  }, []);

  return { reminders, loading, error, refresh, create, update, dismiss, remove };
}

function sortByDate(list) {
  return [...list].sort((a, b) => String(a.remind_at).localeCompare(String(b.remind_at)));
}
