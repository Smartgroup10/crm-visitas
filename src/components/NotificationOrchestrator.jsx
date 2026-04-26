import { useEffect, useRef } from "react";

import { getSocket } from "../lib/socket";
import { useReminders } from "../hooks/useReminders";
import { useBrowserNotifications } from "../hooks/useBrowserNotifications";
import { useDueWatcher } from "../hooks/useDueWatcher";
import { useToast } from "../hooks/useToast";

/**
 * Orquesta las notificaciones in-app del usuario:
 *
 *   ┌────────────────┐    socket "notify"    ┌─────────────┐
 *   │ Backend worker │──────────────────────▶│ this        │
 *   │ (pg-boss)      │                       │ component   │
 *   └────────────────┘                       │             │
 *                                            │ ┌─────────┐ │
 *   ┌────────────────┐    setInterval 30s   │ │ Toast   │ │
 *   │ Watcher local  │──────────────────────▶│ │ Browser │ │
 *   │ (red de seg.)  │                       │ │  API    │ │
 *   └────────────────┘                       │ └─────────┘ │
 *                                            └─────────────┘
 *
 * Tres entradas (socket, watcher local, llamada manual) que terminan en
 * el mismo `dispatch()`, que dedupica por `tag` y dispara:
 *   - `Notification` del navegador (si permiso + toggle local).
 *   - Toast in-app (siempre, como refuerzo si la pestaña está activa).
 *
 * No renderiza nada propio: vive como hijo de `App` y trabaja en efectos.
 */

// Ventana mínima entre dos disparos del mismo `tag`. Evita que socket +
// watcher local emitan a la vez si pillan el evento simultáneamente.
const DEDUP_WINDOW_MS = 2 * 60 * 1000;

export default function NotificationOrchestrator({ userId, tasks, leadMinutes }) {
  const toast = useToast();
  const browser = useBrowserNotifications();
  const { reminders } = useReminders({ status: "pending" });

  // Memoria en sesión de qué tags ya disparamos y cuándo. No usa state
  // (no queremos re-renders) ni storage (no queremos persistir entre
  // pestañas — cada pestaña tiene su propia copia y el watcher local
  // ya se apoya en sessionStorage para dedupe entre montados).
  const lastDispatch = useRef(new Map());

  function dispatch(payload) {
    if (!payload?.tag) return;
    const now = Date.now();
    const prev = lastDispatch.current.get(payload.tag);
    if (prev && now - prev < DEDUP_WINDOW_MS) return;
    lastDispatch.current.set(payload.tag, now);

    // 1) Notificación del navegador (sale aunque la pestaña esté en
    //    background o en otra ventana — es el caso de uso principal).
    const n = browser.notify({
      title: payload.title,
      body: payload.body,
      tag: payload.tag,
      data: { kind: payload.kind, id: payload.id },
    });
    if (n) {
      n.onclick = () => {
        // Traer la pestaña al frente y, si es una tarea, abrir su modal
        // vía el deep link. Para reminders no hay un modal específico,
        // así que sólo enfocamos.
        try { window.focus(); } catch { /* ignore */ }
        if (payload.kind === "task" && payload.id) {
          const url = new URL(window.location.href);
          url.searchParams.set("task", payload.id);
          window.history.replaceState({}, "", url.toString());
          // Trigger un evento para que App reabra el modal sin recargar.
          window.dispatchEvent(new CustomEvent("crm:open-task", { detail: { id: payload.id } }));
        }
        n.close();
      };
    }

    // 2) Toast in-app: refuerzo visual cuando la pestaña está activa.
    //    Si NO está activa, las notifications del navegador ya hacen
    //    el trabajo; el toast esperará en pantalla a que vuelva.
    const toastBody = payload.body
      ? `${payload.title} · ${payload.body}`
      : payload.title;
    toast.info(toastBody, { duration: 8000 });
  }

  // ── Socket: el backend emite "notify" a la sala user:<id> ─────
  useEffect(() => {
    if (!userId) return;
    const socket = getSocket();
    if (!socket) return;
    const handler = (payload) => dispatch(payload);
    socket.on("notify", handler);
    return () => socket.off("notify", handler);
    // dispatch es estable porque sólo usa refs y closures de hooks
    // estables; lo dejamos fuera de deps a propósito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── Watcher local: red de seguridad ──────────────────────────
  useDueWatcher({
    userId,
    tasks,
    reminders,
    leadMinutes,
    onDue: dispatch,
    enabled: true,
  });

  return null;
}
