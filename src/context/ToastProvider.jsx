import { useCallback, useMemo, useRef, useState } from "react";

import { ToastContext } from "./ToastContext";

/**
 * Provider de notificaciones (toasts).
 *
 * Expone un objeto estable con helpers: success / error / info / custom.
 * Cada llamada devuelve el id del toast, útil si alguna vez queremos
 * cerrarlo programáticamente.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    ({ type = "info", message, duration }) => {
      const id = ++idRef.current;
      // Duración por defecto: los errores se quedan más tiempo (el usuario
      // suele necesitarlos para leerlos; los success son confirmaciones rápidas).
      const ttl = duration ?? (type === "error" ? 6000 : 3500);
      setToasts((ts) => [...ts, { id, type, message }]);
      if (ttl > 0) {
        setTimeout(() => dismiss(id), ttl);
      }
      return id;
    },
    [dismiss]
  );

  // El objeto `toast` es estable entre renders (misma referencia) para que
  // los componentes no vuelvan a renderizar solo porque lo consumen.
  // `push` y `dismiss` están memoizados con useCallback, así que useMemo
  // con esas deps produce la misma referencia en cada render.
  const toast = useMemo(() => ({
    success: (message, opts) => push({ ...opts, type: "success", message }),
    error:   (message, opts) => push({ ...opts, type: "error",   message }),
    info:    (message, opts) => push({ ...opts, type: "info",    message }),
    show:    (opts)          => push(opts),
    dismiss,
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastStack({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-stack" role="region" aria-live="polite" aria-label="Notificaciones">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast--${t.type}`}
          role={t.type === "error" ? "alert" : "status"}
          onClick={() => onDismiss(t.id)}
        >
          <span className="toast-icon" aria-hidden="true">
            {t.type === "success" ? "✓" : t.type === "error" ? "!" : "i"}
          </span>
          <span className="toast-message">{t.message}</span>
          <button
            type="button"
            className="toast-close"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(t.id);
            }}
            aria-label="Cerrar notificación"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
