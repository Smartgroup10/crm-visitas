import { TECH_AVATAR_COLORS } from "../../data/constants";
import { TASK_TYPES } from "../../data/taskTypes";
import { todayISO, addDays, formatShortDate } from "../../utils/date";
import { getClientName, peopleFromIds } from "../../utils/id";
import { statusSlug, getPriorityClass } from "../../utils/status";
import { usePermissions } from "../../hooks/usePermissions";
import { useAuth } from "../../hooks/useAuth";
import EmptyState from "../EmptyState";

/**
 * Inicio (dashboard) — Field Engineering aesthetic.
 *
 * Estructura:
 *   1. Hero con kicker mono + greeting en serif italic + subline
 *      adaptativa (cambia el tono según el estado del día).
 *   2. KPI tiles en grid unificado (sin cards flotantes — un único
 *      contenedor con hairlines internas). La última tile va en
 *      navy oscuro como "feature" con barra de progreso.
 *   3. Banner de alerta (sólo si hay tareas bloqueadas).
 *   4. Grid 2-col: Hoy y mañana | Próximos 7 días.
 *   5. Grid 2-col: Carga por técnico (ranking 01-N) | Urgente / Bloqueado.
 *
 * Tipografía: números en JetBrains Mono tabular, etiquetas mono
 * uppercase, greeting en Instrument Serif. Inter para el resto.
 */
export default function InicioView({ tasks, clients, technicians, onEditTask, openNewTask }) {
  const { canManage } = usePermissions();
  const { user } = useAuth();
  const today = todayISO();
  const tomorrow = addDays(today, 1);
  const in7 = addDays(today, 7);

  // ─── KPIs ──────────────────────────────────────
  const kpiPending  = tasks.filter((t) => t.status === "No iniciado");
  const kpiProgress = tasks.filter((t) => t.status === "En curso");
  const kpiBlocked  = tasks.filter((t) => t.status === "Bloqueado");
  const kpiToday    = tasks.filter((t) => t.date === today);
  const kpiDone     = tasks.filter((t) => t.status === "Listo");
  const kpiDoneRate = tasks.length ? Math.round((kpiDone.length / tasks.length) * 100) : 0;

  // ─── Listas derivadas ─────────────────────────
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
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || "99").localeCompare(b.startTime || "99"))
    .slice(0, 6);

  const next7 = tasks
    .filter((t) => t.date > tomorrow && t.date <= in7)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  const techLoad = technicians.map((tech) => {
    const tt = tasks.filter((t) => t.technicianIds.includes(tech.id));
    return {
      ...tech,
      active: tt.filter((t) => t.status === "En curso").length,
      pending: tt.filter((t) => t.status === "No iniciado").length,
      total: tt.length,
    };
  })
  .filter((t) => t.total > 0)
  .sort((a, b) => b.active - a.active || b.total - a.total)
  .slice(0, 6);

  const maxLoad = Math.max(...techLoad.map((t) => t.total), 1);

  // ─── Hero ──────────────────────────────────────
  const firstName =
    (user?.name?.split(" ")[0]) ||
    (user?.email?.split("@")[0]) ||
    "";

  // Etiqueta de fecha en uppercase mono: "MIÉ · 28 ABR"
  const dateLabel = (() => {
    const d = new Date();
    const dow = d.toLocaleDateString("es-ES", { weekday: "short" }).replace(/\./g, "");
    const day = String(d.getDate()).padStart(2, "0");
    const mon = d.toLocaleDateString("es-ES", { month: "short" }).replace(/\./g, "");
    return `${dow.toUpperCase()} · ${day} ${mon.toUpperCase()}`;
  })();

  // Subline adaptativa: prioriza lo que más urge.
  const subline = (() => {
    if (kpiBlocked.length > 0) {
      const n = kpiBlocked.length;
      return n === 1
        ? "Hay 1 incidencia bloqueada que requiere atención."
        : `Hay ${n} incidencias bloqueadas que requieren atención.`;
    }
    if (kpiToday.length > 0) {
      const n = kpiToday.length;
      return n === 1
        ? "Tienes 1 tarea programada para hoy."
        : `Tienes ${n} tareas programadas para hoy.`;
    }
    if (next7.length > 0) {
      const n = next7.length;
      return n === 1
        ? "Próxima semana: 1 tarea planificada."
        : `Próxima semana: ${n} tareas planificadas.`;
    }
    return "Todo bajo control. Buen momento para planificar la semana.";
  })();

  const hasBlocked = kpiBlocked.length > 0;

  return (
    <div className="inicio-view-v2">
      {/* ─── HERO ─────────────────────────────────── */}
      <header className="inicio-hero">
        <div className="inicio-eyebrow">
          <span>PANEL DE OPERACIONES</span>
          <span className="inicio-eyebrow-sep" aria-hidden="true">·</span>
          <span className="inicio-eyebrow-date">{dateLabel}</span>
        </div>
        <h1 className="inicio-greeting">
          Hola, <em>{firstName || "equipo"}</em>.
        </h1>
        <p className="inicio-subline">{subline}</p>
      </header>

      {/* ─── KPI TILES ─────────────────────────────── */}
      <section className="kpi-tiles" aria-label="Indicadores clave">
        <div className="kpi-tile">
          <div className="kpi-tile-label">PENDIENTES</div>
          <div className="kpi-tile-value">{kpiPending.length}</div>
          <div className="kpi-tile-meta">
            <span className="kpi-dot kpi-dot-pending" aria-hidden="true" />
            <span>sin iniciar</span>
          </div>
        </div>

        <div className="kpi-tile">
          <div className="kpi-tile-label">EN CURSO</div>
          <div className="kpi-tile-value">{kpiProgress.length}</div>
          <div className="kpi-tile-meta">
            <span
              className={`kpi-dot kpi-dot-progress ${kpiProgress.length > 0 ? "is-live" : ""}`}
              aria-hidden="true"
            />
            <span>{kpiProgress.length > 0 ? "activas ahora" : "ninguna activa"}</span>
          </div>
        </div>

        <div className="kpi-tile">
          <div className="kpi-tile-label">BLOQUEADAS</div>
          <div className={`kpi-tile-value ${kpiBlocked.length > 0 ? "kpi-tile-value-warn" : ""}`}>
            {kpiBlocked.length}
          </div>
          <div className="kpi-tile-meta">
            <span
              className={`kpi-dot kpi-dot-blocked ${kpiBlocked.length > 0 ? "is-live" : ""}`}
              aria-hidden="true"
            />
            <span>{kpiBlocked.length > 0 ? "requieren atención" : "todo desbloqueado"}</span>
          </div>
        </div>

        <div className="kpi-tile">
          <div className="kpi-tile-label">HOY</div>
          <div className="kpi-tile-value">{kpiToday.length}</div>
          <div className="kpi-tile-meta">
            {kpiToday.length > 0 ? (
              <>
                <span>
                  {kpiToday.filter((t) => t.status === "Listo").length} hechas
                </span>
                <span className="kpi-tile-meta-sep">·</span>
                <span>{kpiToday.filter((t) => t.status !== "Listo").length} restan</span>
              </>
            ) : (
              <span>sin tareas hoy</span>
            )}
          </div>
        </div>

        <div className="kpi-tile kpi-tile-feature">
          <div className="kpi-tile-label">COMPLETADAS</div>
          <div className="kpi-tile-value">
            {kpiDoneRate}
            <span className="kpi-tile-value-unit">%</span>
          </div>
          <div className="kpi-tile-progress" aria-label={`${kpiDoneRate} por ciento completadas`}>
            <div className="kpi-tile-progress-bar" style={{ width: `${kpiDoneRate}%` }} />
          </div>
          <div className="kpi-tile-meta">
            <span>{kpiDone.length} de {tasks.length} tareas</span>
          </div>
        </div>
      </section>

      {/* ─── ALERT BANNER (sólo si hay bloqueadas) ─ */}
      {hasBlocked && (
        <aside className="inicio-alert" role="alert">
          <span className="inicio-alert-mark" aria-hidden="true" />
          <div className="inicio-alert-body">
            <strong>
              {kpiBlocked.length} {kpiBlocked.length === 1 ? "tarea bloqueada" : "tareas bloqueadas"}
            </strong>
            <span>
              Llevan parado el flujo y necesitan acción para avanzar.
            </span>
          </div>
          <div className="inicio-alert-tasks">
            {kpiBlocked.slice(0, 3).map((t) => (
              <button
                key={t.id}
                type="button"
                className="inicio-alert-task"
                onClick={() => onEditTask(t)}
                title={t.title}
              >
                {t.title}
              </button>
            ))}
            {kpiBlocked.length > 3 && (
              <span className="inicio-alert-more">+{kpiBlocked.length - 3}</span>
            )}
          </div>
        </aside>
      )}

      {/* ─── GRID 1: Hoy y mañana | Próximos 7 días ─ */}
      <section className="inicio-grid">
        <article className="inicio-panel">
          <header className="inicio-panel-header">
            <h2>Hoy y mañana</h2>
            <span>{todayAndTomorrow.length} {todayAndTomorrow.length === 1 ? "tarea" : "tareas"}</span>
          </header>
          {todayAndTomorrow.length === 0 ? (
            <EmptyState
              compact
              icon="inbox"
              title="Agenda despejada"
              description="No hay tareas para hoy ni mañana."
              action={
                canManage && openNewTask
                  ? { label: "+ Nueva tarea", variant: "primary", onClick: openNewTask }
                  : undefined
              }
            />
          ) : (
            <ol className="inicio-list">
              {todayAndTomorrow.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    className="inicio-list-item"
                    onClick={() => onEditTask(task)}
                  >
                    <div className="inicio-list-when">
                      <span className="inicio-list-when-day">
                        {task.date === today ? "Hoy" : "Mañana"}
                      </span>
                      {task.startTime && (
                        <span className="inicio-list-when-time">{task.startTime}</span>
                      )}
                    </div>
                    <div className="inicio-list-main">
                      <strong className="inicio-list-title">{task.title || "Sin título"}</strong>
                      <span className="inicio-list-sub">
                        {getClientName(task.clientId, clients) || "—"}
                        {task.type && (
                          <>
                            <span className="inicio-list-sep">·</span>
                            {TASK_TYPES[task.type]?.label || task.type}
                          </>
                        )}
                        {peopleFromIds(task.technicianIds, technicians) && (
                          <>
                            <span className="inicio-list-sep">·</span>
                            {peopleFromIds(task.technicianIds, technicians)}
                          </>
                        )}
                      </span>
                    </div>
                    <span
                      className={`inicio-list-status status-${statusSlug(task.status)}`}
                      title={task.status}
                      aria-label={task.status}
                    />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </article>

        <article className="inicio-panel">
          <header className="inicio-panel-header">
            <h2>Próximos 7 días</h2>
            <span>{next7.length} {next7.length === 1 ? "tarea" : "tareas"}</span>
          </header>
          {next7.length === 0 ? (
            <EmptyState
              compact
              icon="inbox"
              title="Semana vacía"
              description="No hay tareas planificadas en los próximos 7 días."
              action={
                canManage && openNewTask
                  ? { label: "+ Planificar tarea", variant: "primary", onClick: openNewTask }
                  : undefined
              }
            />
          ) : (
            <ol className="inicio-list">
              {next7.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    className="inicio-list-item"
                    onClick={() => onEditTask(task)}
                  >
                    <div className="inicio-list-when">
                      <span className="inicio-list-when-day">
                        {formatShortDate(task.date)}
                      </span>
                      {task.startTime && (
                        <span className="inicio-list-when-time">{task.startTime}</span>
                      )}
                    </div>
                    <div className="inicio-list-main">
                      <strong className="inicio-list-title">{task.title || "Sin título"}</strong>
                      <span className="inicio-list-sub">
                        {getClientName(task.clientId, clients) || "—"}
                        {task.type && (
                          <>
                            <span className="inicio-list-sep">·</span>
                            {TASK_TYPES[task.type]?.label || task.type}
                          </>
                        )}
                      </span>
                    </div>
                    <span
                      className={`inicio-list-priority ${getPriorityClass(task.priority)}`}
                      title={task.priority}
                    >
                      {task.priority}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </article>
      </section>

      {/* ─── GRID 2: Carga por técnico | Urgente/Bloqueado ─ */}
      <section className="inicio-grid">
        <article className="inicio-panel">
          <header className="inicio-panel-header">
            <h2>Carga por técnico</h2>
            <span>{technicians.length} {technicians.length === 1 ? "técnico" : "técnicos"}</span>
          </header>
          {techLoad.length === 0 ? (
            <EmptyState
              compact
              icon="users"
              title="Sin carga registrada"
              description="Los técnicos no tienen tareas asignadas todavía."
            />
          ) : (
            <ol className="tech-rank">
              {techLoad.map((tech, i) => {
                const pct = Math.round((tech.total / maxLoad) * 100);
                return (
                  <li key={tech.id}>
                    <span className="tech-rank-num">{String(i + 1).padStart(2, "0")}</span>
                    <span
                      className="tech-rank-avatar"
                      style={{ background: TECH_AVATAR_COLORS[i % TECH_AVATAR_COLORS.length] }}
                      aria-hidden="true"
                    >
                      {tech.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="tech-rank-info">
                      <strong>{tech.name}</strong>
                      <span>
                        {tech.active > 0 ? `${tech.active} activas` : "sin tareas activas"}
                      </span>
                    </div>
                    <div className="tech-rank-bar" aria-hidden="true">
                      <div
                        className="tech-rank-bar-fill"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="tech-rank-value">
                      <span className="tech-rank-value-active">{tech.active}</span>
                      <span className="tech-rank-value-sep">/</span>
                      <span className="tech-rank-value-total">{tech.total}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </article>

        <article className="inicio-panel">
          <header className="inicio-panel-header">
            <h2>Urgente / Bloqueado</h2>
            <span>{urgentOrBlocked.length}</span>
          </header>
          {urgentOrBlocked.length === 0 ? (
            <EmptyState
              compact
              icon="check"
              title="Todo bajo control"
              description="No hay tareas urgentes ni bloqueadas."
            />
          ) : (
            <ol className="inicio-list">
              {urgentOrBlocked.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    className="inicio-list-item"
                    onClick={() => onEditTask(task)}
                  >
                    <div className="inicio-list-when">
                      <span className="inicio-list-when-day">
                        {formatShortDate(task.date)}
                      </span>
                    </div>
                    <div className="inicio-list-main">
                      <strong className="inicio-list-title">{task.title || "Sin título"}</strong>
                      <span className="inicio-list-sub">
                        {getClientName(task.clientId, clients) || "—"}
                        {peopleFromIds(task.technicianIds, technicians) && (
                          <>
                            <span className="inicio-list-sep">·</span>
                            {peopleFromIds(task.technicianIds, technicians)}
                          </>
                        )}
                      </span>
                    </div>
                    <span
                      className={`inicio-list-status status-${statusSlug(task.status)}`}
                      title={task.status}
                      aria-label={task.status}
                    />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </article>
      </section>
    </div>
  );
}
