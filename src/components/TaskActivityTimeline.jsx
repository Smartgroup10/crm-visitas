import { useTaskActivity } from "../hooks/useTaskActivity";

/**
 * Timeline de actividad de una tarea (audit log).
 *
 * Pinta una lista vertical con un punto por cada evento (created /
 * updated / deleted). Cada item muestra:
 *  - Avatar/icono según tipo (➕ creó · ✎ editó · × borró)
 *  - Quién (nombre del actor) y cuándo (relativo: "hace 5 min")
 *  - Detalle: para `updated`, las líneas de cambios devueltas por el
 *    backend (label, from, to) o las altas/bajas de técnicos.
 *
 * Estilos en `styles/activity.css`. El componente sólo monta DOM, no
 * conoce nada del modal — se puede reutilizar fuera del TaskModal.
 */

// ─── Helpers de formato ───────────────────────────────────────────
function relativeTime(iso) {
  if (!iso) return "";
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return "";
  const diff = Date.now() - target;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "ahora mismo";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `hace ${d} d`;
  // Para más antiguos, fecha en formato corto local.
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtVal(v) {
  if (v === null || v === undefined || v === "") return "—";
  // Fecha YYYY-MM-DD → DD/MM/YYYY para legibilidad. Heurística simple.
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-");
    return `${d}/${m}/${y}`;
  }
  // Truncar valores muy largos (notas, materiales) — el detalle completo
  // está en la tarea misma, aquí sólo se muestra qué cambió.
  const s = String(v);
  return s.length > 80 ? s.slice(0, 77) + "…" : s;
}

function fullTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Renderizado de una línea de cambio ───────────────────────────
function ChangeLine({ change }) {
  if (change.kind === "tech_added") {
    return (
      <span>
        Asignó a <strong>{change.users.map((u) => u.name).join(", ")}</strong>
      </span>
    );
  }
  if (change.kind === "tech_removed") {
    return (
      <span>
        Desasignó a <strong>{change.users.map((u) => u.name).join(", ")}</strong>
      </span>
    );
  }
  // kind === "field"
  return (
    <span>
      <strong>{change.label}</strong>:{" "}
      <span className="activity-from">{fmtVal(change.from)}</span>
      <span className="activity-arrow">→</span>
      <span className="activity-to">{fmtVal(change.to)}</span>
    </span>
  );
}

function ActivityIcon({ type }) {
  if (type === "created") {
    return (
      <span className="activity-dot activity-dot-created" aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
    );
  }
  if (type === "deleted") {
    return (
      <span className="activity-dot activity-dot-deleted" aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </span>
    );
  }
  return (
    <span className="activity-dot activity-dot-updated" aria-hidden="true">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/>
        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z"/>
      </svg>
    </span>
  );
}

// ─── Componente principal ─────────────────────────────────────────
export default function TaskActivityTimeline({ taskId }) {
  const { items, loading, error } = useTaskActivity(taskId);

  if (!taskId) return null;

  return (
    <section className="task-activity" aria-label="Historial de la tarea">
      <header className="task-activity-header">
        <h3>Actividad</h3>
        {loading && <span className="task-activity-status">cargando…</span>}
      </header>

      {error && (
        <div className="task-activity-error" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="task-activity-empty">
          Sin actividad registrada todavía.
        </div>
      )}

      {items.length > 0 && (
        <ol className="task-activity-list">
          {items.map((item) => (
            <li key={item.id} className={`activity-item activity-item-${item.type}`}>
              <ActivityIcon type={item.type} />
              <div className="activity-body">
                <div className="activity-meta">
                  <strong className="activity-actor">
                    {item.actor_name || "Sistema"}
                  </strong>
                  <span className="activity-time" title={fullTime(item.created_at)}>
                    {relativeTime(item.created_at)}
                  </span>
                </div>
                <div className="activity-detail">
                  {item.type === "created" && (
                    <span className="activity-summary">Creó la tarea</span>
                  )}
                  {item.type === "deleted" && (
                    <span className="activity-summary">Eliminó la tarea</span>
                  )}
                  {item.type === "updated" && Array.isArray(item.payload?.changes) && (
                    <ul className="activity-changes">
                      {item.payload.changes.map((c, i) => (
                        <li key={i}><ChangeLine change={c} /></li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
