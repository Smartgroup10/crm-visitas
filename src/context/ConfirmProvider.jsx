import { useCallback, useEffect, useRef, useState } from "react";

import { ConfirmContext } from "./ConfirmContext";

/**
 * Provider para confirmaciones modales.
 *
 * Expone una función `confirm({ title, message, ... })` que devuelve una
 * Promise<boolean> — resuelve a true si el usuario acepta, false si cancela.
 *
 * Uso:
 *   const confirm = useConfirm();
 *   const ok = await confirm({
 *     title: "Borrar usuario",
 *     message: "Esta acción no se puede deshacer.",
 *     variant: "danger",
 *     confirmLabel: "Borrar",
 *   });
 *   if (!ok) return;
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { id, title, message, ... } | null
  const resolverRef = useRef(null);

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({
        id: Date.now(),
        title:        opts.title        ?? "¿Continuar?",
        message:      opts.message      ?? "",
        variant:      opts.variant      ?? "default", // "default" | "danger"
        confirmLabel: opts.confirmLabel ?? "Confirmar",
        cancelLabel:  opts.cancelLabel  ?? "Cancelar",
      });
    });
  }, []);

  const settle = useCallback((value) => {
    setState(null);
    if (resolverRef.current) {
      resolverRef.current(value);
      resolverRef.current = null;
    }
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && <ConfirmDialog {...state} onSettle={settle} />}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({ title, message, variant, confirmLabel, cancelLabel, onSettle }) {
  const confirmBtnRef = useRef(null);

  // Enfocamos el botón de confirmar al abrir, y atrapamos ESC.
  useEffect(() => {
    confirmBtnRef.current?.focus();
    function onKey(e) {
      if (e.key === "Escape") onSettle(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSettle]);

  return (
    <div className="modal-overlay" onClick={() => onSettle(false)}>
      <div
        className={`confirm-dialog confirm-dialog--${variant}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-dialog-title" className="confirm-dialog-title">
          {title}
        </h3>
        {message && <p className="confirm-dialog-message">{message}</p>}
        <div className="confirm-dialog-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onSettle(false)}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={variant === "danger" ? "btn-danger" : "btn-primary"}
            onClick={() => onSettle(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
