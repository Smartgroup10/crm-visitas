import { useEffect } from "react";

import { useClientDetail } from "../hooks/useClientDetail";

/**
 * Modal de detalle de cliente: ficha + estadísticas + histórico
 * cronológico de intervenciones.
 *
 * Click en cualquier tarea del histórico → cierra este modal y
 * dispara el evento `crm:open-task` que App.jsx escucha para abrir
 * el TaskModal. Misma mecánica que usa el deep-link `?task=<id>`,
 * así no duplicamos lógica.
 *
 * Cierra con Escape, click fuera, o el botón ×. Bloquea scroll del
 * body mientras está abierto.
 */

const STATUS_COLORS = {
  "No iniciado":   "var(--c-pending, #c4cedf)",
  "En curso":      "var(--c-progress, #f59e0b)",
  "Bloqueado":     "var(--c-blocked, #ef4444)",
  "Listo":         "var(--c-done, #10b981)",
};

const PRIORITY_LABELS = { Alta: "Alta", Media: "Media", Baja: "Baja" };

function fmtDate(iso) {
  if (!iso) return "Sin fecha";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtMonth(iso) {
  if (!iso) return "Sin fecha";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

// Agrupa las tareas por mes (clave = "YYYY-MM") preservando el orden
// que ya viene del backend (date desc). Las tareas sin fecha se
// agrupan en una clave especial al final.
function groupByMonth(tasks) {
  const groups = new Map();
  for (const t of tasks) {
    const key = t.date && /^\d{4}-\d{2}/.test(t.date)
      ? t.date.slice(0, 7)
      : "_no-date";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  return [...groups.entries()];
}

export default function ClientDetailModal({ open, clientId, technicians, onClose }) {
  const { client, tasks, stats, loading, error } = useClientDetail(open ? clientId : null);

  // Bloqueo de scroll + Escape
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  function openTask(taskId) {
    // Cerramos primero para que no se solapen dos modales, y disparamos
    // en el siguiente tick para dar tiempo al unmount + state update.
    onClose?.();
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("crm:open-task", { detail: { id: taskId } }));
    }, 60);
  }

  const techByIdName = (id) => technicians?.find((t) => t.id === id)?.name || "—";
  const groups = groupByMonth(tasks);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="task-modal client-detail-modal"
        style={{ width: "min(720px, 100%)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-detail-title"
      >
        <div className="modal-header">
          <div className="modal-header-main">
            <div>
              <h2 id="client-detail-title">
                {client?.name || (loading ? "Cargando…" : "Cliente")}
              </h2>
              <p>Ficha del cliente e historial de intervenciones</p>
            </div>
          </div>
          <button
            type="button"
            className="icon-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="form-section">
            <div className="task-comments-error" role="alert">{error}</div>
          </div>
        )}

        {/* ─── Estadísticas resumen ─────────────────────── */}
        {!loading && !error && tasks.length > 0 && (
          <div className="client-stats">
            <div className="client-stat">
              <strong>{stats.total}</strong>
              <span>tareas</span>
            </div>
            <div className="client-stat">
              <strong>{stats.upcoming}</strong>
              <span>próximas</span>
            </div>
            <div className="client-stat">
              <strong>{stats.completed}%</strong>
              <span>completadas</span>
            </div>
            <div className="client-stat">
              <strong>
                {stats.lastVisit
                  ? stats.lastVisit.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })
                  : "—"}
              </strong>
              <span>última visita</span>
            </div>
          </div>
        )}

        {/* ─── Por estado y por tipo ────────────────────── */}
        {!loading && !error && tasks.length > 0 && (
          <div className="client-breakdown">
            {Object.keys(stats.byStatus).length > 0 && (
              <div className="client-breakdown-row">
                <span className="client-breakdown-label">Estado:</span>
                {Object.entries(stats.byStatus).map(([k, v]) => (
                  <span key={k} className="client-chip">
                    <span
                      className="client-chip-dot"
                      style={{ background: STATUS_COLORS[k] || "var(--text-muted)" }}
                    />
                    {k} · {v}
                  </span>
                ))}
              </div>
            )}
            {Object.keys(stats.byType).length > 0 && (
              <div className="client-breakdown-row">
                <span className="client-breakdown-label">Tipo:</span>
                {Object.entries(stats.byType).map(([k, v]) => (
                  <span key={k} className="client-chip">{k} · {v}</span>
                ))}
              </div>
            )}
            {stats.primaryTechnicianIds.length > 0 && (
              <div className="client-breakdown-row">
                <span className="client-breakdown-label">Técnicos habituales:</span>
                {stats.primaryTechnicianIds.map(({ id, count }) => (
                  <span key={id} className="client-chip">
                    {techByIdName(id)} · {count}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Histórico cronológico ────────────────────── */}
        <div className="client-history">
          {loading && (
            <div className="task-comments-empty">Cargando histórico…</div>
          )}
          {!loading && !error && tasks.length === 0 && (
            <div className="task-comments-empty">
              Este cliente no tiene tareas registradas todavía.
            </div>
          )}
          {!loading && !error && groups.map(([monthKey, monthTasks]) => (
            <div key={monthKey} className="client-history-group">
              <div className="client-history-month">
                {monthKey === "_no-date"
                  ? "Sin fecha asignada"
                  : fmtMonth(monthTasks[0].date)}
                <span className="client-history-count">
                  · {monthTasks.length} {monthTasks.length === 1 ? "tarea" : "tareas"}
                </span>
              </div>
              <ul className="client-history-list">
                {monthTasks.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      className="client-history-item"
                      onClick={() => openTask(task.id)}
                    >
                      <div className="client-history-item-main">
                        <span
                          className="client-history-status"
                          style={{ background: STATUS_COLORS[task.status] || "var(--text-muted)" }}
                          title={task.status}
                        />
                        <span className="client-history-title">{task.title || "Sin título"}</span>
                        {task.type && (
                          <span className="client-history-type">{task.type}</span>
                        )}
                      </div>
                      <div className="client-history-meta">
                        <span>{fmtDate(task.date)}</span>
                        {task.startTime && <span>· {task.startTime}</span>}
                        {task.priority && <span>· {PRIORITY_LABELS[task.priority] || task.priority}</span>}
                        {task.technicianIds?.length > 0 && (
                          <span>· {task.technicianIds.map(techByIdName).join(", ")}</span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
