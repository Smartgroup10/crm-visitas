import { useEffect, useState } from "react";

import { IconBell } from "./Icon";

/**
 * Card individual del stack de notificaciones in-app.
 *
 * - Diseño "panel a la derecha" inspirado en Slack / Linear: barra
 *   coloreada a la izquierda según `kind`, icono circular, título grande,
 *   body, hora relativa, acciones primarias/secundarias.
 * - Animación de entrada (slide + fade) que se monta vía CSS al añadir
 *   la clase `is-entering`. La salida la dispara `onDismiss` que quita
 *   la card del stack (la animación de salida la podríamos añadir más
 *   adelante con un wrapper transition; para v1 valoramos simplicidad).
 * - Hover: pausa el auto-cierre. Lo implementamos vía la API del provider:
 *   éste auto-cierra con setTimeout; al pasar el ratón paramos el contador
 *   visual (barra de progreso) sólo para feedback visual; el setTimeout
 *   real sigue corriendo (aceptable: si el usuario ve la card y le hace
 *   hover, ya la procesó).
 */

// Iconos específicos por tipo, todos siguiendo el estilo Lucide del resto.
function IconAlarmClock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="13" r="8"/>
      <path d="M12 9v4l2 2"/>
      <path d="M5 3 2 6"/>
      <path d="m22 6-3-3"/>
      <path d="M6.4 19.4l-1.4 1.4"/>
      <path d="m17.6 19.4 1.4 1.4"/>
    </svg>
  );
}

function relativeWhen(iso) {
  if (!iso) return "";
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return "";
  const diff = target - Date.now();
  const abs = Math.abs(diff);
  const min = Math.round(abs / 60_000);
  if (min < 1) return diff >= 0 ? "ahora" : "hace un instante";
  if (min < 60) return diff >= 0 ? `en ${min} min` : `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return diff >= 0 ? `en ${h} h` : `hace ${h} h`;
  const d = Math.round(h / 24);
  return diff >= 0 ? `en ${d} d` : `hace ${d} d`;
}

const KIND_META = {
  task: {
    label: "Tarea próxima",
    Icon: IconAlarmClock,
    accent: "var(--notif-task, #f59e0b)",        // ámbar
    softBg: "var(--notif-task-soft, #fef3c7)",
  },
  reminder: {
    label: "Recordatorio",
    Icon: IconBell,
    accent: "var(--notif-reminder, #2563eb)",    // azul de marca
    softBg: "var(--notif-reminder-soft, #dbeafe)",
  },
  info: {
    label: "Aviso",
    Icon: IconBell,
    accent: "var(--brand, #2563eb)",
    softBg: "var(--brand-soft, #dbeafe)",
  },
};

export default function NotificationCard({ notif, onDismiss }) {
  const meta = KIND_META[notif.kind] || KIND_META.info;
  const Icon = meta.Icon;
  const [entering, setEntering] = useState(true);

  // Quitamos la clase de entrada en el primer frame para que la
  // transición CSS arranque desde el estado "fuera de pantalla".
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setEntering(false));
    return () => window.cancelAnimationFrame(id);
  }, []);

  function handleAction() {
    try {
      notif.onAction?.();
    } finally {
      // Cerramos siempre tras la acción: el usuario ya atendió la
      // notificación, no tiene sentido dejarla.
      onDismiss();
    }
  }

  const when = relativeWhen(notif.when);

  return (
    <div
      className={`notif-card ${entering ? "is-entering" : ""}`}
      role="alert"
      aria-live="assertive"
      style={{ "--notif-accent": meta.accent, "--notif-soft": meta.softBg }}
    >
      {/* Barra de acento a la izquierda — refuerza el tipo (tarea / reminder) */}
      <div className="notif-accent" aria-hidden="true" />

      <div className="notif-icon" aria-hidden="true">
        <Icon />
      </div>

      <div className="notif-body">
        <div className="notif-meta">
          <span className="notif-kind">{meta.label}</span>
          {when && <span className="notif-when">· {when}</span>}
        </div>
        <div className="notif-title">{notif.title}</div>
        {notif.body && <div className="notif-text">{notif.body}</div>}

        {(notif.actionLabel || notif.onAction) && (
          <div className="notif-actions">
            {notif.actionLabel && notif.onAction && (
              <button
                type="button"
                className="notif-btn notif-btn-primary"
                onClick={handleAction}
              >
                {notif.actionLabel}
              </button>
            )}
            <button
              type="button"
              className="notif-btn notif-btn-ghost"
              onClick={onDismiss}
            >
              Descartar
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        className="notif-close"
        onClick={onDismiss}
        aria-label="Cerrar notificación"
        title="Cerrar"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
             aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  );
}
