import { useEffect, useRef } from "react";

import { getSocket } from "../lib/socket";
import { useReminders } from "../hooks/useReminders";
import { useBrowserNotifications } from "../hooks/useBrowserNotifications";
import { useDueWatcher } from "../hooks/useDueWatcher";
import { useNotificationStack } from "../hooks/useNotificationStack";

/**
 * Orquesta las notificaciones in-app del usuario:
 *
 *   ┌────────────────┐    socket "notify"    ┌─────────────┐
 *   │ Backend worker │──────────────────────▶│ this        │
 *   │ (pg-boss)      │                       │ component   │
 *   └────────────────┘                       │             │
 *                                            │ ┌─────────┐ │
 *   ┌────────────────┐    setInterval 30s   │ │ Card    │ │
 *   │ Watcher local  │──────────────────────▶│ │ in-app  │ │
 *   │ (red de seg.)  │                       │ │ + Browser│ │
 *   └────────────────┘                       │ │  API    │ │
 *                                            │ └─────────┘ │
 *                                            └─────────────┘
 *
 * Tres entradas (socket, watcher local, llamada manual) que terminan en
 * el mismo `dispatch()`, que dedupica por `tag` y dispara:
 *   - `Notification` del navegador (si permiso + toggle local).
 *   - Card "rich" del stack in-app (con icono branded, sonido, acción
 *     primaria "Ver tarea"). Sustituye al toast plano de la v1: el toast
 *     era feedback efímero genérico; las notificaciones de agenda son
 *     un canal separado y merecen su propio look-and-feel.
 *
 * No renderiza nada propio: vive como hijo de `App` y trabaja en efectos.
 */

// Ventana mínima entre dos disparos del mismo `tag`. Evita que socket +
// watcher local emitan a la vez si pillan el evento simultáneamente.
const DEDUP_WINDOW_MS = 2 * 60 * 1000;

export default function NotificationOrchestrator({ userId, tasks, leadMinutes }) {
  const notifStack = useNotificationStack();
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

    // Acción de "abrir la tarea" reutilizable: la usamos tanto desde el
    //   click en la Notification del navegador como desde el botón
    //   primario de la card in-app, así nos aseguramos de que ambos
    //   destinos hacen exactamente lo mismo.
    const openTask = () => {
      try { window.focus(); } catch { /* ignore */ }
      if (payload.kind === "task" && payload.id) {
        const url = new URL(window.location.href);
        url.searchParams.set("task", payload.id);
        window.history.replaceState({}, "", url.toString());
        window.dispatchEvent(new CustomEvent("crm:open-task", { detail: { id: payload.id } }));
      }
    };

    // Branded title: prefijo con un emoji que identifica el tipo de
    //   evento incluso al verlo de un vistazo en la esquina del SO.
    //   No metemos "SMARTGROUP" en el título porque la mayoría de
    //   navegadores ya pintan el origen ("crm-visitas.api2smart.com")
    //   debajo, y duplicar texto reduce la legibilidad.
    const brandedTitle = payload.kind === "task"
      ? `⏰ ${payload.title}`
      : `🔔 ${payload.title}`;

    // 1) Notificación del navegador (sale aunque la pestaña esté en
    //    background o en otra ventana — es el caso de uso principal).
    //    requireInteraction sólo para tareas: el usuario puede estar
    //    en otra app y queremos que la notificación se quede hasta que
    //    la atienda. Los reminders genéricos pueden auto-cerrarse.
    const n = browser.notify({
      title: brandedTitle,
      body: payload.body,
      tag: payload.tag,
      data: { kind: payload.kind, id: payload.id },
      requireInteraction: payload.kind === "task",
    });
    if (n) {
      n.onclick = () => {
        openTask();
        n.close();
      };
    }

    // 2) Card rich del stack in-app: refuerzo visual cuando la pestaña
    //    está activa, y único canal cuando el navegador no tiene
    //    permiso o el toggle local está apagado.
    notifStack.push({
      kind: payload.kind,
      title: payload.title,
      body: payload.body,
      when: payload.when,
      tag: payload.tag,
      actionLabel: payload.kind === "task" && payload.id ? "Ver tarea" : null,
      onAction: payload.kind === "task" && payload.id ? openTask : null,
      // Si es tarea próxima, dejamos la card pegada hasta que el
      // usuario interactúe — coherente con requireInteraction de la
      // Notification del navegador.
      requireInteraction: payload.kind === "task",
    });
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
