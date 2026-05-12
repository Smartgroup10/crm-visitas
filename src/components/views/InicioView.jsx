import { useEffect, useMemo, useState } from "react";

import { TECH_AVATAR_COLORS } from "../../data/constants";
import { TASK_TYPES } from "../../data/taskTypes";
import { todayISO, addDays, formatShortDate } from "../../utils/date";
import { getClientName, peopleFromIds } from "../../utils/id";
import { statusSlug, getPriorityClass } from "../../utils/status";
import { usePermissions } from "../../hooks/usePermissions";
import EmptyState from "../EmptyState";

/**
 * Inicio (panel operativo) — Field Engineering aesthetic.
 *
 * Sin greeting personal, sin frase motivacional, sin tipografía
 * decorativa. La pantalla arranca con un status-bar tipo control
 * room: reloj vivo + fecha + semana ISO + datos crudos del día.
 * El usuario abre la app y ve operación, no una tarjeta de bienvenida.
 *
 * Estructura:
 *   1. Status-bar superior: clock vivo + datos del día.
 *   2. KPI tiles igualados (sin "feature tile" navy decorativa).
 *   3. Banner de bloqueadas (solo si hay).
 *   4. Grid 2-col: Hoy y mañana | Próximos 7 días.
 *   5. Grid 2-col: Carga por técnico | Urgente / Bloqueado.
 */

// ISO 8601: la semana que contiene el jueves manda. Mismo cálculo que
// usa Linear, GitHub, Outlook. No depende de zona horaria.
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function formatClock(d) {
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

function formatDateBar(d) {
  const dow = d.toLocaleDateString("es-ES", { weekday: "short" }).replace(/\./g, "");
  const day = String(d.getDate()).padStart(2, "0");
  const mon = d.toLocaleDateString("es-ES", { month: "short" }).replace(/\./g, "");
  const year = d.getFullYear();
  return `${dow.toUpperCase()} ${day} ${mon.toUpperCase()} ${year}`;
}

export default function InicioView({ tasks, clients, technicians, onEditTask, openNewTask }) {
  const { canCreateTasks } = usePermissions();
  const today = todayISO();
  const tomorrow = addDays(today, 1);
  const in7 = addDays(today, 7);

  // Reloj vivo. Tick cada segundo. Coste despreciable; el efecto
  // visual es lo que separa un dashboard "vivo" de uno "estático".
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ─── KPIs ──────────────────────────────────────
  const kpiPending  = tasks.filter((t) => t.status === "No iniciado");
  const kpiProgress = tasks.filter((t) => t.status === "En curso");
  const kpiBlocked  = tasks.filter((t) => t.status === "Bloqueado");
  const kpiToday    = tasks.filter((t) => t.date === today);
  const kpiDone     = tasks.filter((t) => t.status === "Listo");
  const kpiDoneRate = tasks.length ? Math.round((kpiDone.length / tasks.length) * 100) : 0;

  // ─── Listas derivadas (memoizadas para no re-sortear con el clock tick) ─
  const urgentOrBlocked = useMemo(() => tasks
    .filter((t) => t.status === "Bloqueado" || (t.priority === "Urgente" && t.status !== "Listo"))
    .sort((a, b) => {
      if (a.status === "Bloqueado" && b.status !== "Bloqueado") return -1;
      if (b.status === "Bloqueado" && a.status !== "Bloqueado") return 1;
      return a.date.localeCompare(b.date);
    })
    .slice(0, 8), [tasks]);

  const todayAndTomorrow = useMemo(() => tasks
    .filter((t) => t.date === today || t.date === tomorrow)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || "99").localeCompare(b.startTime || "99"))
    .slice(0, 6), [tasks, today, tomorrow]);

  const next7 = useMemo(() => tasks
    .filter((t) => t.date > tomorrow && t.date <= in7)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6), [tasks, tomorrow, in7]);

  // Total de la semana (próximos 7 incluyendo hoy y mañana) para el
  // contador del status-bar — distinto del slice(0, 6) que pinta la lista.
  const next7TotalCount = useMemo(
    () => tasks.filter((t) => t.date >= today && t.date <= in7).length,
    [tasks, today, in7]
  );

  const techLoad = useMemo(() => technicians.map((tech) => {
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
  .slice(0, 6), [technicians, tasks]);

  const maxLoad = Math.max(...techLoad.map((t) => t.total), 1);

  const hasBlocked = kpiBlocked.length > 0;
  const week = isoWeek(now);

  return (
    <div className="inicio-view-v2">
      {/* ─── STATUS BAR (no greeting, todo dato) ─────────── */}
      <header className="inicio-statusbar" aria-label="Estado operativo">
        <div className="inicio-statusbar-left">
          <span className="inicio-statusbar-pulse" aria-hidden="true" />
          <span className="inicio-statusbar-clock" title="Hora local">
            {formatClock(now)}
          </span>
          <span className="inicio-statusbar-sep" aria-hidden="true">·</span>
          <span className="inicio-statusbar-date">{formatDateBar(now)}</span>
          <span className="inicio-statusbar-sep" aria-hidden="true">·</span>
          <span className="inicio-statusbar-week" title="Semana ISO">
            S.{String(week).padStart(2, "0")}
          </span>
        </div>
        <div className="inicio-statusbar-right" aria-label="Resumen del día">
          {kpiBlocked.length > 0 && (
            <>
              <span className="inicio-statusbar-stat is-warn">
                <span className="inicio-statusbar-num">{kpiBlocked.length}</span>
                <span className="inicio-statusbar-stat-label">bloq</span>
              </span>
              <span className="inicio-statusbar-sep" aria-hidden="true">·</span>
            </>
          )}
          <span className="inicio-statusbar-stat">
            <span className="inicio-statusbar-num">{kpiToday.length}</span>
            <span className="inicio-statusbar-stat-label">hoy</span>
          </span>
          <span className="inicio-statusbar-sep" aria-hidden="true">·</span>
          <span className="inicio-statusbar-stat">
            <span className="inicio-statusbar-num">{next7TotalCount}</span>
            <span className="inicio-statusbar-stat-label">próx 7d</span>
          </span>
          <span className="inicio-statusbar-sep" aria-hidden="true">·</span>
          <span className="inicio-statusbar-stat">
            <span className="inicio-statusbar-num">{tasks.length}</span>
            <span className="inicio-statusbar-stat-label">total</span>
          </span>
        </div>
      </header>

      {/* ─── KPI TILES (igualadas, sin "feature tile" navy) ─ */}
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

        <div className="kpi-tile">
          <div className="kpi-tile-label">COMPLETADAS</div>
          <div className="kpi-tile-value">
            {kpiDoneRate}
            <span className="kpi-tile-value-unit">%</span>
          </div>
          <div className="kpi-tile-progress kpi-tile-progress-flat" aria-label={`${kpiDoneRate} por ciento`}>
            <div className="kpi-tile-progress-bar" style={{ width: `${kpiDoneRate}%` }} />
          </div>
          <div className="kpi-tile-meta">
            <span>{kpiDone.length} de {tasks.length}</span>
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
            <span>Necesitan acción para que el flujo avance.</span>
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
                canCreateTasks && openNewTask
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
                canCreateTasks && openNewTask
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
