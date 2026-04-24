import { useEffect, useRef } from "react";

/**
 * Modal de ayuda con los atajos de teclado. Se abre con `?`.
 * Cierra con ESC o click fuera.
 */
export default function ShortcutsHelp({ open, onClose }) {
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const groups = [
    {
      title: "Generales",
      items: [
        { keys: ["N"],             desc: "Nueva tarea" },
        { keys: ["/"],             desc: "Enfocar búsqueda" },
        { keys: ["Ctrl", "K"],     desc: "Enfocar búsqueda (también desde un input)" },
        { keys: ["?"],             desc: "Mostrar esta ayuda" },
        { keys: ["Esc"],           desc: "Cerrar modal activo" },
      ],
    },
    {
      title: "Calendario",
      items: [
        { keys: ["G"], desc: "Ir a hoy" },
        { keys: ["1"], desc: "Vista mes" },
        { keys: ["2"], desc: "Vista semana" },
        { keys: ["3"], desc: "Vista día" },
      ],
    },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="shortcuts-help"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-help-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shortcuts-help-header">
          <h3 id="shortcuts-help-title">Atajos de teclado</h3>
          <button
            ref={closeBtnRef}
            type="button"
            className="icon-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="shortcuts-help-body">
          {groups.map((g) => (
            <section key={g.title} className="shortcuts-group">
              <h4>{g.title}</h4>
              <ul>
                {g.items.map((it) => (
                  <li key={it.desc}>
                    <span className="shortcuts-keys">
                      {it.keys.map((k, i) => (
                        <span key={i}>
                          <kbd>{k}</kbd>
                          {i < it.keys.length - 1 && <span className="shortcuts-plus">+</span>}
                        </span>
                      ))}
                    </span>
                    <span className="shortcuts-desc">{it.desc}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="shortcuts-help-footer">
          <p>
            Los atajos de un solo carácter solo funcionan cuando no estás escribiendo en un campo.
          </p>
        </div>
      </div>
    </div>
  );
}
