import { useCallback, useMemo, useRef, useState } from "react";

import { NotificationStackContext } from "./NotificationStackContext";
import NotificationCard from "../components/NotificationCard";
import { playNotificationSound } from "../lib/notificationSound";

/**
 * Proveedor del stack de notificaciones in-app ricas.
 *
 *   const notif = useNotificationStack();
 *   notif.push({
 *     kind: "task" | "reminder",
 *     title: "Tu tarea empieza en 15 min",
 *     body: "Reparación en Hotel Centro",
 *     actionId: "uuid-de-la-tarea",
 *     actionLabel: "Ver tarea",
 *     onAction: () => { ... },
 *   });
 *
 * Diseño:
 *  - Las cards aparecen en la esquina superior derecha (escritorio) o
 *    centradas arriba en mobile.
 *  - Auto-cierre a 12s salvo que el cursor esté encima.
 *  - Apilables: hasta 5 visibles a la vez. Las viejas se descartan
 *    para no tapar la app.
 *  - Suenan UNA sola vez por enqueue (no por re-render) y sólo si el
 *    push viene marcado con `playSound: true` (por defecto, true).
 */

const MAX_VISIBLE = 5;
const AUTO_DISMISS_MS = 12_000;

export function NotificationStackProvider({ children }) {
  const [items, setItems] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const push = useCallback((notif) => {
    if (!notif?.title) return null;
    const id = ++idRef.current;
    const item = {
      id,
      createdAt: Date.now(),
      kind: notif.kind || "info",
      title: notif.title,
      body: notif.body || "",
      when: notif.when || null,
      actionLabel: notif.actionLabel || null,
      onAction: notif.onAction || null,
      requireInteraction: !!notif.requireInteraction,
    };
    setItems((prev) => {
      // Si ya existe una notif con la misma `tag`, la reemplazamos en
      // su sitio (evita duplicados visuales cuando el socket y el
      // watcher local llegan a la vez aunque el dispatch ya dedupica).
      const next = notif.tag
        ? prev.filter((n) => n.tag !== notif.tag)
        : prev;
      // Añadir como cabecera del stack y limitar tamaño.
      const withNew = [{ ...item, tag: notif.tag || null }, ...next];
      return withNew.slice(0, MAX_VISIBLE);
    });
    if (notif.playSound !== false) {
      // Disparado fuera del setState para no llamarlo dos veces en
      // strict-mode (el reducer puede ejecutarse dos veces en dev).
      try { playNotificationSound(); } catch { /* noop */ }
    }
    if (!item.requireInteraction) {
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    }
    return id;
  }, [dismiss]);

  // Objeto estable: misma referencia mientras `push` y `dismiss` no
  // cambien (ambos están memoizados con useCallback).
  const ctx = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <NotificationStackContext.Provider value={ctx}>
      {children}
      <NotificationStack items={items} onDismiss={dismiss} />
    </NotificationStackContext.Provider>
  );
}

function NotificationStack({ items, onDismiss }) {
  if (items.length === 0) return null;
  return (
    <div
      className="notif-stack"
      role="region"
      aria-live="polite"
      aria-label="Notificaciones del sistema"
    >
      {items.map((n) => (
        <NotificationCard
          key={n.id}
          notif={n}
          onDismiss={() => onDismiss(n.id)}
        />
      ))}
    </div>
  );
}
