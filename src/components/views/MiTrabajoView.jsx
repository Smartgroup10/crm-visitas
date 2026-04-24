import { TASK_TYPES } from "../../data/taskTypes";
import { todayISO, formatShortDate } from "../../utils/date";
import { getClientName, peopleFromIds } from "../../utils/id";
import { statusSlug, getPriorityClass } from "../../utils/status";
import { IconAlert } from "../Icon";
import EmptyState from "../EmptyState";

export default function MiTrabajoView({ tasks, clients, technicians, onEditTask }) {
  const today = todayISO();

  const requiresAction = tasks
    .filter((t) => t.status === "Bloqueado" || (t.priority === "Urgente" && t.status === "No iniciado"))
    .sort((a, b) => {
      if (a.status === "Bloqueado" && b.status !== "Bloqueado") return -1;
      if (b.status === "Bloqueado" && a.status !== "Bloqueado") return 1;
      return a.date.localeCompare(b.date);
    });

  const agendaHoy = tasks
    .filter((t) => t.date === today)
    .sort((a, b) => {
      const la = TASK_TYPES[a.type]?.label || a.type || "";
      const lb = TASK_TYPES[b.type]?.label || b.type || "";
      return la.localeCompare(lb, "es") || a.title.localeCompare(b.title, "es");
    });

  const vehiclesOut = [...new Set(agendaHoy.map((t) => t.vehicle).filter(Boolean))];

  const incomplete = tasks
    .filter((t) => t.technicianIds.length === 0 || !t.date)
    .sort((a, b) => {
      if (!a.date && b.date) return 1;
      if (a.date && !b.date) return -1;
      return a.date.localeCompare(b.date);
    });

  return (
    <div className="mitrabajo-view">
      <div className="mitrabajo-header">
        <h2>Mi trabajo</h2>
        <p>Vista de gestión · {formatShortDate(today)}</p>
      </div>

      {requiresAction.length > 0 && (
        <div className="mt-alert-banner">
          <span className="mt-alert-icon"><IconAlert /></span>
          <span>
            {requiresAction.length} {requiresAction.length === 1 ? "tarea requiere" : "tareas requieren"} atención inmediata
          </span>
        </div>
      )}

      <div className="dashboard-grid">
        <div className="panel-block">
          <div className="panel-block-header">
            <h2>Requieren acción</h2>
            <span>{requiresAction.length}</span>
          </div>
          {requiresAction.length === 0 ? (
            <EmptyState
              compact
              icon="check"
              title="Nada que atender ahora"
              description="No hay tareas bloqueadas ni urgentes pendientes."
            />
          ) : (
            <div className="day-task-list">
              {requiresAction.map((task) => (
                <button key={task.id} className="day-task-card" onClick={() => onEditTask(task)}>
                  <div className="day-task-top">
                    <strong>{task.title}</strong>
                    <span className={`mini-status ${statusSlug(task.status)}`}>{task.status}</span>
                  </div>
                  <div className="day-task-meta">{getClientName(task.clientId, clients)} · {formatShortDate(task.date)}</div>
                  <div className="day-task-meta">
                    <span className={`mini-priority ${getPriorityClass(task.priority)}`}>{task.priority}</span>
                    {" "}{peopleFromIds(task.technicianIds, technicians) || <em>Sin técnico</em>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="panel-block">
          <div className="panel-block-header">
            <h2>Agenda de hoy</h2>
            <span>{agendaHoy.length} intervenciones</span>
          </div>
          {vehiclesOut.length > 0 && (
            <div className="mt-vehicles-row">
              <span className="mt-vehicles-label">Vehículos: </span>
              {vehiclesOut.map((v) => (
                <span key={v} className="mt-vehicle-chip">{v}</span>
              ))}
            </div>
          )}
          {agendaHoy.length === 0 ? (
            <EmptyState
              compact
              icon="inbox"
              title="Sin intervenciones hoy"
              description="La agenda de hoy está vacía."
            />
          ) : (
            <div className="day-task-list">
              {agendaHoy.map((task) => (
                <button key={task.id} className="day-task-card" onClick={() => onEditTask(task)}>
                  <div className="day-task-top">
                    <strong>{task.title}</strong>
                    <span className={`mini-status ${statusSlug(task.status)}`}>{task.status}</span>
                  </div>
                  <div className="day-task-meta">{TASK_TYPES[task.type]?.label || task.type} · {getClientName(task.clientId, clients)}</div>
                  <div className="day-task-meta">
                    {peopleFromIds(task.technicianIds, technicians)}{task.vehicle ? ` · ${task.vehicle}` : ""}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="panel-block dashboard-full">
          <div className="panel-block-header">
            <h2>Tareas incompletas</h2>
            <span>{incomplete.length} sin técnico o sin fecha</span>
          </div>
          {incomplete.length === 0 ? (
            <EmptyState
              compact
              icon="check"
              title="Sin datos faltantes"
              description="Todas las tareas tienen técnico y fecha asignados."
            />
          ) : (
            <div className="incomplete-grid">
              {incomplete.map((task) => (
                <button key={task.id} className="day-task-card" onClick={() => onEditTask(task)}>
                  <div className="day-task-top">
                    <strong>{task.title}</strong>
                    <span className={`mini-priority ${getPriorityClass(task.priority)}`}>{task.priority}</span>
                  </div>
                  <div className="day-task-meta">
                    {getClientName(task.clientId, clients) || "—"} · {task.date ? formatShortDate(task.date) : "Sin fecha"}
                  </div>
                  <div className="day-task-meta day-task-warn">
                    {task.technicianIds.length === 0 && (
                      <span className="warn-chip"><IconAlert /> Sin técnico asignado</span>
                    )}
                    {!task.date && (
                      <span className="warn-chip"><IconAlert /> Sin fecha</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
