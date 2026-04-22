import { TECH_AVATAR_COLORS } from "../../data/constants";
import { TASK_TYPES } from "../../data/taskTypes";
import { todayISO, addDays, formatShortDate } from "../../utils/date";
import { getClientName, peopleFromIds } from "../../utils/id";
import { statusSlug, getPriorityClass } from "../../utils/status";

export default function InicioView({ tasks, clients, technicians, onEditTask }) {
  const today = todayISO();
  const tomorrow = addDays(today, 1);
  const in7 = addDays(today, 7);

  const kpiPending  = tasks.filter((t) => t.status === "No iniciado");
  const kpiProgress = tasks.filter((t) => t.status === "En curso");
  const kpiBlocked  = tasks.filter((t) => t.status === "Bloqueado");
  const kpiToday    = tasks.filter((t) => t.date === today);
  const kpiDoneRate = tasks.length
    ? Math.round((tasks.filter((t) => t.status === "Listo").length / tasks.length) * 100)
    : 0;

  const urgentOrBlocked = tasks
    .filter((t) => t.status === "Bloqueado" || (t.priority === "Urgente" && t.status !== "Listo"))
    .sort((a, b) => {
      if (a.status === "Bloqueado" && b.status !== "Bloqueado") return -1;
      if (b.status === "Bloqueado" && a.status !== "Bloqueado") return 1;
      return a.date.localeCompare(b.date);
    })
    .slice(0, 8);

  const todayAndTomorrow = tasks
    .filter((t) => t.date === today || t.date === tomorrow)
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "es"));

  const next7 = tasks
    .filter((t) => t.date > tomorrow && t.date <= in7)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  const techLoad = technicians.map((tech) => {
    const tt = tasks.filter((t) => t.technicianIds.includes(tech.id));
    return {
      ...tech,
      active:  tt.filter((t) => t.status === "En curso").length,
      total:   tt.length,
    };
  }).sort((a, b) => b.active - a.active || b.total - a.total);

  const maxLoad = Math.max(...techLoad.map((t) => t.total), 1);

  return (
    <div className="inicio-view">
      <div className="inicio-header">
        <h2>Inicio</h2>
        <p>Resumen operativo · {formatShortDate(today)}</p>
      </div>

      <div className="kpi-row">
        <div className="kpi-card kpi-pending">
          <span className="kpi-num">{kpiPending.length}</span>
          <span className="kpi-label">Pendientes</span>
        </div>
        <div className="kpi-card kpi-progress">
          <span className="kpi-num">{kpiProgress.length}</span>
          <span className="kpi-label">En curso</span>
        </div>
        <div className="kpi-card kpi-blocked">
          <span className="kpi-num">{kpiBlocked.length}</span>
          <span className="kpi-label">Bloqueadas</span>
        </div>
        <div className="kpi-card kpi-today">
          <span className="kpi-num">{kpiToday.length}</span>
          <span className="kpi-label">Hoy</span>
        </div>
        <div className="kpi-card kpi-rate">
          <span className="kpi-num">{kpiDoneRate}%</span>
          <span className="kpi-label">Completadas</span>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="panel-block">
          <div className="panel-block-header">
            <h2>Urgente / Bloqueado</h2>
            <span>{urgentOrBlocked.length}</span>
          </div>
          {urgentOrBlocked.length === 0 ? (
            <div className="empty-state">Sin tareas urgentes ni bloqueadas.</div>
          ) : (
            <div className="day-task-list">
              {urgentOrBlocked.map((task) => (
                <button key={task.id} className="day-task-card" onClick={() => onEditTask(task)}>
                  <div className="day-task-top">
                    <strong>{task.title}</strong>
                    <span className={`mini-status ${statusSlug(task.status)}`}>{task.status}</span>
                  </div>
                  <div className="day-task-meta">{getClientName(task.clientId, clients)} · {formatShortDate(task.date)}</div>
                  <div className="day-task-meta">
                    <span className={`mini-priority ${getPriorityClass(task.priority)}`}>{task.priority}</span>
                    {" "}{peopleFromIds(task.technicianIds, technicians)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="panel-block">
          <div className="panel-block-header">
            <h2>Hoy y mañana</h2>
            <span>{todayAndTomorrow.length}</span>
          </div>
          {todayAndTomorrow.length === 0 ? (
            <div className="empty-state">No hay tareas para hoy ni mañana.</div>
          ) : (
            <div className="day-task-list">
              {todayAndTomorrow.map((task) => (
                <button key={task.id} className="day-task-card" onClick={() => onEditTask(task)}>
                  <div className="day-task-top">
                    <strong>{task.title}</strong>
                    <span className={`mini-status ${statusSlug(task.status)}`}>{task.status}</span>
                  </div>
                  <div className="day-task-meta">
                    {task.date === today ? "Hoy" : "Mañana"} · {getClientName(task.clientId, clients)}
                  </div>
                  <div className="day-task-meta">{TASK_TYPES[task.type]?.label || task.type} · {peopleFromIds(task.technicianIds, technicians)}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="panel-block">
          <div className="panel-block-header">
            <h2>Carga por técnico</h2>
            <span>{technicians.length} técnicos</span>
          </div>
          <div className="tech-load-list">
            {techLoad.map((tech, i) => (
              <div key={tech.id} className="tech-load-row">
                <div className="tech-avatar tech-avatar-sm" style={{ background: TECH_AVATAR_COLORS[i % TECH_AVATAR_COLORS.length] }}>
                  {tech.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="tech-load-name">{tech.name}</div>
                <div className="tech-load-bar-wrap">
                  <div className="tech-load-bar" style={{ width: `${Math.min((tech.total / maxLoad) * 100, 100)}%` }} />
                </div>
                <div className="tech-load-nums">
                  <span style={{ color: "var(--c-progress)" }}>{tech.active}</span>
                  {" / "}
                  <span style={{ color: "var(--text-soft)" }}>{tech.total}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel-block">
          <div className="panel-block-header">
            <h2>Próximos 7 días</h2>
            <span>{next7.length} tareas</span>
          </div>
          {next7.length === 0 ? (
            <div className="empty-state">No hay tareas planificadas esta semana.</div>
          ) : (
            <div className="day-task-list">
              {next7.map((task) => (
                <button key={task.id} className="day-task-card" onClick={() => onEditTask(task)}>
                  <div className="day-task-top">
                    <strong>{task.title}</strong>
                    <span className={`mini-priority ${getPriorityClass(task.priority)}`}>{task.priority}</span>
                  </div>
                  <div className="day-task-meta">{formatShortDate(task.date)} · {getClientName(task.clientId, clients)}</div>
                  <div className="day-task-meta">{TASK_TYPES[task.type]?.label || task.type} · {peopleFromIds(task.technicianIds, technicians)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
