import { useEffect } from "react";

import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "../data/constants";
import { TASK_TYPES, TASK_TYPE_KEYS } from "../data/taskTypes";
import { useUI } from "../hooks/useUI";
import { usePermissions } from "../hooks/usePermissions";
import { useTheme } from "../hooks/useTheme";

const TITLES = {
  inicio: "Inicio",
  mitrabajo: "Mi trabajo",
  instalaciones: "Seguimiento de intervenciones",
  clientes: "Clientes",
  usuarios: "Equipo",
  informes: "Informes",
};

const SUBTITLES = {
  inicio: "Resumen operativo",
  mitrabajo: "Gestión y atención prioritaria",
  instalaciones: "Visitas · Instalaciones · Mantenimiento · Incidencias",
  clientes: "Gestión del catálogo de clientes",
  usuarios: "Equipo, accesos y responsabilidades",
  informes: "Histórico, estadísticas y rendimiento",
};

export default function Topbar({ stats, technicians, openNewTask, onOpenPalette }) {
  const { canManage } = usePermissions();
  const { theme, toggleTheme } = useTheme();

  // La paleta de comandos puede pedir cambiar el tema vía evento
  // (porque el toggle real vive aquí en useTheme y el palette no lo
  // tiene a mano). Escuchamos y delegamos.
  useEffect(() => {
    const handler = () => toggleTheme();
    window.addEventListener("crm:toggle-theme", handler);
    return () => window.removeEventListener("crm:toggle-theme", handler);
  }, [toggleTheme]);
  const {
    section,
    activeView,
    search,
    personFilter,
    statusFilter,
    priorityFilter,
    categoryFilter,
    setActiveView,
    setSearch,
    setPersonFilter,
    setStatusFilter,
    setPriorityFilter,
    setCategoryFilter,
    resetFilters,
    openCounterModal,
    setDrawerOpen,
  } = useUI();

  return (
    <header className="topbar compact-topbar">
      <div className="top-title-row">
        {/* Hamburger mobile: abre el drawer del sidebar. CSS lo oculta en desktop. */}
        <button
          type="button"
          className="topbar-burger"
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir menú de navegación"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>

        <div className="top-title-block">
          <h1>{TITLES[section]}</h1>
          <p>{SUBTITLES[section]}</p>
        </div>

        <div className="top-actions">
          {section === "instalaciones" && (
            <div className="top-header-counters">
              <button type="button" className="stat-pill stat-total" onClick={() => openCounterModal("Total")}>
                <span className="stat-dot"></span>
                <strong>{stats.total}</strong>
                <span className="stat-label">Total</span>
              </button>
              <button type="button" className="stat-pill stat-pending" onClick={() => openCounterModal("No iniciado")}>
                <span className="stat-dot"></span>
                <strong>{stats.pending}</strong>
                <span className="stat-label">Pendiente</span>
              </button>
              <button type="button" className="stat-pill stat-progress" onClick={() => openCounterModal("En curso")}>
                <span className="stat-dot"></span>
                <strong>{stats.progress}</strong>
                <span className="stat-label">En curso</span>
              </button>
              <button type="button" className="stat-pill stat-done" onClick={() => openCounterModal("Listo")}>
                <span className="stat-dot"></span>
                <strong>{stats.done}</strong>
                <span className="stat-label">Listo</span>
              </button>
            </div>
          )}

          {/* Botón "atajo" que abre el command palette. La etiqueta
              `Buscar · ⌘K` lo hace descubrible para usuarios que no
              conocen el atajo de teclado. En mobile, sólo se ve la
              lupa (CSS @media (max-width: 720px)). */}
          {onOpenPalette && (
            <button
              type="button"
              className="topbar-cmd-btn"
              onClick={onOpenPalette}
              aria-label="Abrir buscador y comandos (Ctrl+K)"
              title="Buscar y comandos (Ctrl+K)"
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none"
                   stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="9" cy="9" r="6"/>
                <path d="M13.5 13.5L17 17" strokeLinecap="round"/>
              </svg>
              <span className="topbar-cmd-btn-text">Buscar</span>
              <kbd className="topbar-cmd-btn-kbd">⌘K</kbd>
            </button>
          )}

          {/* Toggle de tema. Aria-label dinámico para que el lector de pantalla
              anuncie el estado destino, no el actual ("activar modo oscuro"). */}
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"}
            title={theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"}
          >
            {theme === "dark" ? (
              /* Sol — vamos a claro */
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            ) : (
              /* Luna — vamos a oscuro */
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {section === "instalaciones" && (
        <div className="toolbar toolbar-installations toolbar-top-row">
          <div className="toolbar-left toolbar-search-tabs">
            <div className="inline-view-tabs">
              <button
                className={`view-tab ${activeView === "Tabla principal" ? "active" : ""}`}
                onClick={() => setActiveView("Tabla principal")}
              >
                <svg className="view-tab-svg" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="3" width="14" height="2" rx="1" fill="currentColor"/>
                  <rect x="1" y="7" width="14" height="2" rx="1" fill="currentColor" opacity=".7"/>
                  <rect x="1" y="11" width="14" height="2" rx="1" fill="currentColor" opacity=".5"/>
                </svg>
                <span>Tabla</span>
              </button>
              <button
                className={`view-tab ${activeView === "Calendario" ? "active" : ""}`}
                onClick={() => setActiveView("Calendario")}
              >
                <svg className="view-tab-svg" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M1 6h14" stroke="currentColor" strokeWidth="1.5"/>
                  <rect x="5" y="1" width="1.5" height="4" rx=".75" fill="currentColor"/>
                  <rect x="9.5" y="1" width="1.5" height="4" rx=".75" fill="currentColor"/>
                </svg>
                <span>Calendario</span>
              </button>
            </div>

            <div className="search-wrapper">
              <input
                className="search-input"
                type="text"
                placeholder="Busca tarea, cliente, técnico, vehículo…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="toolbar-filters">
            <select
              className="toolbar-filter-select"
              value={personFilter}
              onChange={(e) => setPersonFilter(e.target.value)}
            >
              <option value="Todos">Técnico</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <select
              className="toolbar-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="Todos">Estado</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              className="toolbar-filter-select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="Todas">Prioridad</option>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <select
              className="toolbar-filter-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="Todas">Tipo</option>
              {TASK_TYPE_KEYS.map((k) => (
                <option key={k} value={k}>{TASK_TYPES[k].label}</option>
              ))}
            </select>
          </div>

          <div className="toolbar-right quick-actions">
            <button className="btn-secondary quick-btn" onClick={resetFilters}>
              Limpiar
            </button>
            {canManage && (
              <button className="btn-primary quick-btn" onClick={openNewTask}>
                + Nueva tarea
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
