import { useCallback, useEffect, useMemo, useState } from "react";

import { api, ApiError } from "../lib/api";
import { taskFromDb } from "../utils/taskMapper";
import { getSocket } from "../lib/socket";

/**
 * Carga la ficha completa de un cliente: info + todas sus tareas
 * históricas y futuras. Refresca cuando llega `tasks:change` o
 * `clients:change` por socket (alguien añadió/editó una tarea de
 * este cliente desde otra pestaña).
 *
 * Devuelve además `stats` calculadas en el cliente:
 *   - total: nº de tareas
 *   - byStatus: { "No iniciado": N, "En curso": N, "Listo": N, ... }
 *   - byType: { "Instalación": N, "Incidencia": N, ... }
 *   - completed: % completadas (Listo)
 *   - lastVisit: fecha de la última visita realizada (Listo más reciente)
 *   - upcoming: nº de tareas futuras (sin completar)
 *   - primaryTechnicianIds: top 3 técnicos por nº de intervenciones
 *
 * Las stats son derivadas, no se persisten — barato y siempre fresh.
 */
export function useClientDetail(clientId) {
  const [client, setClient] = useState(null);
  const [tasks, setTasks]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const refresh = useCallback(async () => {
    if (!clientId) {
      setClient(null);
      setTasks([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/clients/${clientId}/details`);
      setClient(data?.client || null);
      // Mapeamos las tareas a la forma camelCase que usa el resto de
      // la app, así podemos reutilizar componentes existentes (status
      // pills, etc.) sin código intermedio.
      setTasks(Array.isArray(data?.tasks) ? data.tasks.map(taskFromDb) : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error cargando ficha del cliente");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Si una tarea de este cliente cambia en otra pestaña, recargamos.
  // Es perezoso: refresh entero en lugar de aplicar el delta — para
  // 50-100 tareas el payload es del orden de KB, no merece la pena la
  // complejidad de parchear el array localmente.
  useEffect(() => {
    if (!clientId) return;
    const socket = getSocket();
    if (!socket) return;
    const handler = (msg) => {
      if (!msg) return;
      // Si la tarea afectada no es de este cliente, ignoramos.
      // Para insert/update miramos el client_id (snake_case del
      // backend); para delete refrescamos siempre porque no sabemos
      // a qué cliente pertenecía.
      if (msg.type === "delete") return refresh();
      if (msg.task?.client_id === clientId) refresh();
    };
    socket.on("tasks:change", handler);
    return () => socket.off("tasks:change", handler);
  }, [clientId, refresh]);

  // ─── Derivar stats del array de tareas ─────────────────
  const stats = useMemo(() => {
    if (!tasks.length) {
      return {
        total: 0,
        byStatus: {},
        byType: {},
        completed: 0,
        lastVisit: null,
        upcoming: 0,
        primaryTechnicianIds: [],
      };
    }
    const byStatus = {};
    const byType = {};
    const techCounts = new Map();
    let lastVisit = null;
    let upcoming = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const t of tasks) {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      if (t.type) byType[t.type] = (byType[t.type] || 0) + 1;

      // Última visita = tarea más reciente con status "Listo"
      if (t.status === "Listo" && t.date) {
        const d = new Date(t.date);
        if (!Number.isNaN(d.getTime())) {
          if (!lastVisit || d > lastVisit) lastVisit = d;
        }
      }

      // Pendiente futura: fecha >= hoy y status != Listo
      if (t.status !== "Listo" && t.date) {
        const d = new Date(t.date);
        if (!Number.isNaN(d.getTime()) && d >= today) upcoming++;
      }

      // Conteo por técnico
      for (const tid of t.technicianIds || []) {
        techCounts.set(tid, (techCounts.get(tid) || 0) + 1);
      }
    }

    const total = tasks.length;
    const done = byStatus["Listo"] || 0;

    return {
      total,
      byStatus,
      byType,
      completed: total > 0 ? Math.round((done / total) * 100) : 0,
      lastVisit,
      upcoming,
      primaryTechnicianIds: [...techCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id, count]) => ({ id, count })),
    };
  }, [tasks]);

  return { client, tasks, stats, loading, error, refresh };
}
