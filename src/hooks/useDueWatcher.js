import { useEffect, useRef, useLayoutEffect } from "react";

/**
 * Vigila localmente las tareas y recordatorios del usuario y dispara
 * notificaciones cuando entra el momento de avisar.
 *
 * Es una **red de seguridad**: el backend (pg-boss + workers + SMTP) ya
 * dispara notificaciones por socket cuando llega el momento. Pero si el
 * backend está caído, sin SMTP configurado, o el usuario está offline
 * justo en ese instante, este watcher se encarga de avisar igual usando
 * sólo la lista de objetos que ya está en memoria.
 *
 * Decisiones:
 *  - Idempotencia: usamos sessionStorage con la `tag` del aviso. Si ya
 *    notificamos esta tarea/reminder en esta sesión, no lo repetimos.
 *    Usamos `sessionStorage` (no `localStorage`) para que tras cerrar
 *    el navegador y volver a abrirlo, si la cita sigue siendo "ahora",
 *    el usuario lo vea otra vez (es lo que querrías).
 *  - Tick cada 30s: precisión suficiente para avisos al minuto sin
 *    consumir cpu/batería.
 *  - Ventana: disparamos cuando `Date.now()` está entre `target` y
 *    `target + 5min`. Esto cubre el caso "abrí la app 2 min después
 *    de la hora prevista": el usuario ve el aviso igual.
 *  - Sólo recordatorios `pending` y tareas no `Listo`. No notificamos
 *    sobre lo ya cerrado.
 */

const TICK_MS = 30_000;
const GRACE_WINDOW_MS = 5 * 60 * 1000;
const STORAGE_KEY_PREFIX = "crm.notified.";

function alreadyNotified(tag) {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY_PREFIX + tag) === "1";
  } catch {
    return false;
  }
}
function markNotified(tag) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY_PREFIX + tag, "1");
  } catch {
    // privado o lleno; no es crítico
  }
}

// Combina date (YYYY-MM-DD) + start_time (HH:MM) en hora local del navegador.
// Devuelve null si falta cualquiera de los dos o el formato no es válido.
function startDateTime(task) {
  if (!task?.date || !task?.startTime) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(task.date)) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(task.startTime)) return null;
  const d = new Date(`${task.date}T${task.startTime}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function useDueWatcher({
  userId,
  tasks,
  reminders,
  leadMinutes,
  onDue,    // ({ kind, id, title, body, when, tag }) => void
  enabled = true,
}) {
  // Mantenemos las dependencias en un ref para que el setInterval no se
  // recree con cada re-render (cada cambio en `tasks` haría restart).
  // Usamos useLayoutEffect en lugar de asignar durante el render: React
  // (especialmente en strict-mode + dev) no permite mutar refs durante
  // render porque rompe la pureza. El layoutEffect corre síncronamente
  // antes del paint, así que el siguiente tick del watcher ya ve los
  // valores frescos sin race.
  const ref = useRef({ userId, tasks, reminders, leadMinutes, onDue, enabled });
  useLayoutEffect(() => {
    ref.current = { userId, tasks, reminders, leadMinutes, onDue, enabled };
  });

  useEffect(() => {
    let timer = null;

    const tick = () => {
      const { userId, tasks, reminders, leadMinutes, onDue, enabled } = ref.current;
      if (!enabled || !onDue) return;
      const now = Date.now();

      // ── Recordatorios personales ──────────────────────────
      for (const r of reminders || []) {
        if (r.status !== "pending") continue;
        const target = new Date(r.remind_at).getTime();
        if (Number.isNaN(target)) continue;
        if (now < target) continue;
        if (now - target > GRACE_WINDOW_MS) continue; // demasiado viejo
        const tag = `reminder:${r.id}`;
        if (alreadyNotified(tag)) continue;
        markNotified(tag);
        onDue({
          kind: "reminder",
          id: r.id,
          title: r.title,
          body: r.body || "",
          when: r.remind_at,
          tag,
        });
      }

      // ── Tareas con fecha+hora del usuario ─────────────────
      const lead = Math.max(0, Number(leadMinutes ?? 60));
      for (const t of tasks || []) {
        if (!userId) break;
        if (!Array.isArray(t.technicianIds) || !t.technicianIds.includes(userId)) continue;
        if (t.status === "Listo") continue;
        const start = startDateTime(t);
        if (!start) continue;
        const target = start.getTime() - lead * 60_000;
        if (now < target) continue;
        if (now - target > GRACE_WINDOW_MS) continue;
        const tag = `task:${t.id}`;
        if (alreadyNotified(tag)) continue;
        markNotified(tag);
        onDue({
          kind: "task",
          id: t.id,
          title: t.title || "Tarea",
          body: lead
            ? `Empieza en ${lead} min`
            : "Empieza ahora",
          when: start.toISOString(),
          tag,
        });
      }
    };

    // Una pasada inicial al montar (cubre "entré a la app y tenía un
    // aviso pendiente"), luego cada 30s.
    tick();
    timer = setInterval(tick, TICK_MS);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);
}
