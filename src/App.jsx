import { useMemo, useState } from "react";

import {
  STORAGE_KEY,
  CLIENTS_STORAGE_KEY,
  UI_STORAGE_KEY,
  TECHNICIANS_STORAGE_KEY,
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  CATEGORY_OPTIONS,
} from "./data/constants";
import {
  DEFAULT_CLIENTS,
  DEFAULT_TECHNICIANS,
  initialTasks,
} from "./data/initialData";
import {
  toISO,
  todayISO,
  formatMonthYear,
  formatShortDate,
  getCalendarGrid,
} from "./utils/date";
import { getClientName, peopleFromIds } from "./utils/id";
import { statusSlug, getStatusClass, getPriorityClass } from "./utils/status";
import { migrateTasksToIds } from "./utils/migration";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import TaskModal from "./components/TaskModal";
import ClientsView from "./components/views/ClientsView";
import TechniciansView from "./components/views/TechniciansView";
import InicioView from "./components/views/InicioView";
import MiTrabajoView from "./components/views/MiTrabajoView";

const DEFAULT_UI = {
  activeView: "Calendario",
  search: "",
  personFilter: "Todos",
  statusFilter: "Todos",
  priorityFilter: "Todas",
  categoryFilter: "Todas",
};

function taskHaystack(task, clients, technicians) {
  return [
    task.title,
    getClientName(task.clientId, clients),
    task.phone,
    peopleFromIds(task.technicianIds, technicians),
    task.category,
    task.notes,
    task.materials,
    task.estimatedTime,
    task.vehicle,
    ...(task.attachments || []).map((f) => f.name),
  ]
    .join(" ")
    .toLowerCase();
}

function emptyTask(date) {
  return {
    id: null,
    title: "",
    clientId: "",
    phone: "",
    category: "Visita",
    date,
    technicianIds: [],
    status: "No iniciado",
    priority: "Media",
    notes: "",
    materials: "",
    estimatedTime: "",
    vehicle: "",
    attachments: [],
  };
}

function normalizeTask(task) {
  return {
    ...task,
    technicianIds: Array.isArray(task.technicianIds) ? task.technicianIds : [],
    attachments: Array.isArray(task.attachments) ? task.attachments : [],
  };
}

export default function App() {
  migrateTasksToIds();

  const [section, setSection] = useState("inicio");

  const [clients, setClients] = useLocalStorage(CLIENTS_STORAGE_KEY, DEFAULT_CLIENTS, {
    parser: (parsed, fallback) => {
      if (!Array.isArray(parsed) || !parsed.length) return fallback;
      return parsed.map((c) =>
        typeof c === "string" ? { id: crypto.randomUUID(), name: c } : c
      );
    },
  });

  const [technicians, setTechnicians] = useLocalStorage(
    TECHNICIANS_STORAGE_KEY,
    DEFAULT_TECHNICIANS,
    {
      parser: (parsed, fallback) =>
        Array.isArray(parsed) && parsed.length ? parsed : fallback,
    }
  );

  const [tasks, setTasks] = useLocalStorage(STORAGE_KEY, initialTasks, {
    parser: (parsed, fallback) => {
      if (!Array.isArray(parsed) || !parsed.length) return fallback;
      return parsed.map(normalizeTask);
    },
  });

  const [ui, setUi] = useLocalStorage(UI_STORAGE_KEY, DEFAULT_UI, {
    parser: (parsed, fallback) =>
      parsed && typeof parsed === "object" ? { ...fallback, ...parsed } : fallback,
  });
  const { activeView, search, personFilter, statusFilter, priorityFilter, categoryFilter } = ui;
  const setActiveView = (v) => setUi((u) => ({ ...u, activeView: v }));
  const setSearch = (v) => setUi((u) => ({ ...u, search: v }));
  const setPersonFilter = (v) => setUi((u) => ({ ...u, personFilter: v }));
  const setStatusFilter = (v) => setUi((u) => ({ ...u, statusFilter: v }));
  const setPriorityFilter = (v) => setUi((u) => ({ ...u, priorityFilter: v }));
  const setCategoryFilter = (v) => setUi((u) => ({ ...u, categoryFilter: v }));

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [draft, setDraft] = useState(emptyTask(todayISO()));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [newClientName, setNewClientName] = useState("");

  const [counterModalOpen, setCounterModalOpen] = useState(false);
  const [counterFilter, setCounterFilter] = useState("Total");
  const [counterSearch, setCounterSearch] = useState("");

  const monthCells = useMemo(() => getCalendarGrid(currentMonth), [currentMonth]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch = taskHaystack(task, clients, technicians).includes(search.toLowerCase());
      const matchesPerson =
        personFilter === "Todos" || task.technicianIds.includes(personFilter);
      const matchesStatus = statusFilter === "Todos" || task.status === statusFilter;
      const matchesPriority =
        priorityFilter === "Todas" || task.priority === priorityFilter;
      const matchesCategory =
        categoryFilter === "Todas" || task.category === categoryFilter;

      return (
        matchesSearch &&
        matchesPerson &&
        matchesStatus &&
        matchesPriority &&
        matchesCategory
      );
    });
  }, [tasks, clients, technicians, search, personFilter, statusFilter, priorityFilter, categoryFilter]);

  const tasksByDate = useMemo(() => {
    const grouped = {};
    for (const task of filteredTasks) {
      if (!grouped[task.date]) grouped[task.date] = [];
      grouped[task.date].push(task);
    }
    return grouped;
  }, [filteredTasks]);

  const selectedTasks = useMemo(() => {
    return (tasksByDate[selectedDate] || []).slice().sort((a, b) => {
      return a.title.localeCompare(b.title, "es");
    });
  }, [tasksByDate, selectedDate]);

  const stats = useMemo(() => {
    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === "No iniciado").length,
      progress: tasks.filter((t) => t.status === "En curso").length,
      done: tasks.filter((t) => t.status === "Listo").length,
    };
  }, [tasks]);

  function openCounterModal(filterName) {
    setCounterFilter(filterName);
    setCounterSearch("");
    setCounterModalOpen(true);
  }

  const counterTasks = useMemo(() => {
    let filtered;

    switch (counterFilter) {
      case "No iniciado":
        filtered = tasks.filter((task) => task.status === "No iniciado");
        break;
      case "En curso":
        filtered = tasks.filter((task) => task.status === "En curso");
        break;
      case "Listo":
        filtered = tasks.filter((task) => task.status === "Listo");
        break;
      default:
        filtered = tasks;
        break;
    }

    const searchText = counterSearch.trim().toLowerCase();

    if (!searchText) return filtered;

    return filtered.filter((task) => taskHaystack(task, clients, technicians).includes(searchText));
  }, [tasks, clients, technicians, counterFilter, counterSearch]);

  const groupedCounterTasks = useMemo(() => {
    const grouped = {};

    counterTasks
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((task) => {
        if (!grouped[task.date]) grouped[task.date] = [];
        grouped[task.date].push(task);
      });

    return grouped;
  }, [counterTasks]);

  function addClientFromModal() {
    const name = newClientName.trim();
    if (!name) return;
    const existing = clients.find((c) => c.name === name);
    if (existing) {
      setDraft({ ...draft, clientId: existing.id });
      setNewClientName("");
      return;
    }
    const created = { id: crypto.randomUUID(), name };
    setClients((prev) =>
      [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "es"))
    );
    setDraft({ ...draft, clientId: created.id });
    setNewClientName("");
  }

  function resetFilters() {
    setSearch("");
    setPersonFilter("Todos");
    setStatusFilter("Todos");
    setPriorityFilter("Todas");
    setCategoryFilter("Todas");
  }

  function openNewTask() {
    setDraft(emptyTask(selectedDate));
    setIsModalOpen(true);
  }

  function editTask(task) {
    setDraft({ ...task });
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
  }

  function deleteTask() {
    if (!draft.id) return;
    setTasks((prev) => prev.filter((task) => task.id !== draft.id));
    setIsModalOpen(false);
    setDraft(emptyTask(selectedDate));
  }

  function saveTask(e) {
    e.preventDefault();

    if (!draft.title.trim()) {
      alert("El título es obligatorio.");
      return;
    }

    if (!draft.clientId) {
      alert("El cliente es obligatorio.");
      return;
    }

    if (!draft.technicianIds.length) {
      alert("Debes seleccionar al menos un técnico.");
      return;
    }

    if (draft.id) {
      setTasks((prev) => prev.map((task) => (task.id === draft.id ? draft : task)));
    } else {
      setTasks((prev) => [...prev, { ...draft, id: crypto.randomUUID() }]);
    }

    setSelectedDate(draft.date);
    setIsModalOpen(false);
    setDraft(emptyTask(draft.date));
  }

  function goToday() {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(todayISO());
  }

  function changeMonth(offset) {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  }

  function handleDropOnDate(date) {
    if (!draggedTaskId) return;
    setTasks((prev) =>
      prev.map((task) =>
        task.id === draggedTaskId ? { ...task, date } : task
      )
    );
    setDraggedTaskId(null);
    setSelectedDate(date);
  }

  useKeyboardShortcuts({
    onNew: openNewTask,
    onSearchFocus: () => {
      const searchEl = document.querySelector(".search-input");
      if (searchEl) searchEl.focus();
    },
    onEscape: () => {
      if (isModalOpen || counterModalOpen) {
        setIsModalOpen(false);
        setCounterModalOpen(false);
      }
    },
  });

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-badge">S</div>
          <div>
            <div className="brand-title">SMARTGROUP</div>
            <div className="brand-subtitle">Operaciones</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Principal</div>
          <button
            className={`nav-item ${section === "inicio" ? "active" : ""}`}
            onClick={() => setSection("inicio")}
          >
            <span className="nav-icon">🏠</span>
            <span className="nav-label">Inicio</span>
          </button>
          <button
            className={`nav-item ${section === "mitrabajo" ? "active" : ""}`}
            onClick={() => setSection("mitrabajo")}
          >
            <span className="nav-icon">✔</span>
            <span className="nav-label">Mi trabajo</span>
          </button>

          <div className="nav-section-label">Operaciones</div>
          <button
            className={`nav-item ${section === "instalaciones" ? "active" : ""}`}
            onClick={() => setSection("instalaciones")}
          >
            <span className="nav-icon">📋</span>
            <span className="nav-label">Seguimiento</span>
          </button>
          <button
            className={`nav-item ${section === "clientes" ? "active" : ""}`}
            onClick={() => setSection("clientes")}
          >
            <span className="nav-icon">👥</span>
            <span className="nav-label">Clientes</span>
          </button>
          <button
            className={`nav-item ${section === "tecnicos" ? "active" : ""}`}
            onClick={() => setSection("tecnicos")}
          >
            <span className="nav-icon">🔧</span>
            <span className="nav-label">Técnicos</span>
          </button>

          <div className="nav-section-label">Análisis</div>
          <button className="nav-item nav-soon">
            <span className="nav-icon">📊</span>
            <span className="nav-label">Informes</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">JV</div>
            <div className="user-info">
              <div className="user-name">Jaime Vallejo</div>
              <div className="user-role">Administrador</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar compact-topbar">
          <div className="top-title-row">
            <div className="top-title-block">
              <h1>
                {section === "instalaciones" ? "Seguimiento de intervenciones"
                  : section === "tecnicos"   ? "Técnicos"
                  : section === "inicio"     ? "Inicio"
                  : section === "mitrabajo"  ? "Mi trabajo"
                  : "Clientes"}
              </h1>
              <p>
                {section === "instalaciones" ? "Visitas · Instalaciones · Mantenimiento · Incidencias"
                  : section === "tecnicos"   ? "Gestión del equipo técnico"
                  : section === "inicio"     ? "Resumen operativo"
                  : section === "mitrabajo"  ? "Gestión y atención prioritaria"
                  : "Gestión del catálogo de clientes"}
              </p>
            </div>

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
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="toolbar-right quick-actions">
                <button className="btn-secondary quick-btn" onClick={resetFilters}>
                  Limpiar
                </button>
                <button className="btn-primary quick-btn" onClick={openNewTask}>
                  + Nueva tarea
                </button>
              </div>
            </div>
          )}


        </header>

        <div className="content-grid integrated-layout">
          {section === "instalaciones" ? (
            <>
              <section className="main-panel top-aligned-panel">
                {activeView === "Calendario" ? (
                  <>
                    <div className="calendar-topbar">
                      <div className="calendar-topbar-spacer"></div>
                      <div className="calendar-topbar-controls">
                        <button className="ghost-btn" onClick={goToday}>
                          Hoy
                        </button>
                        <button className="ghost-icon" onClick={() => changeMonth(-1)}>
                          ‹
                        </button>
                        <button className="ghost-icon" onClick={() => changeMonth(1)}>
                          ›
                        </button>
                        <div className="month-label">{formatMonthYear(currentMonth)}</div>
                      </div>
                    </div>

                    <div className="calendar-weekdays">
                      <div>lun.</div>
                      <div>mar.</div>
                      <div>mié.</div>
                      <div>jue.</div>
                      <div>vie.</div>
                      <div>sáb.</div>
                      <div>dom.</div>
                    </div>

                    <div className="calendar-grid">
                      {monthCells.map((date) => {
                        const iso = toISO(date);
                        const dayTasks = tasksByDate[iso] || [];
                        const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                        const isSelected = iso === selectedDate;
                        const isToday = iso === todayISO();

                        return (
                          <button
                            key={iso}
                            className={`calendar-cell ${!isCurrentMonth ? "outside" : ""} ${
                              isSelected ? "selected" : ""
                            }`}
                            onClick={() => setSelectedDate(iso)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleDropOnDate(iso)}
                          >
                            <div className="cell-header">
                              <span className={`cell-day ${isToday ? "today" : ""}`}>
                                {String(date.getDate()).padStart(2, "0")}
                              </span>
                            </div>

                            <div className="cell-tasks">
                              {dayTasks.slice(0, 4).map((task) => (
                                <div
                                  key={task.id}
                                  className={`task-pill ${getStatusClass(task.status)} ${getPriorityClass(task.priority)}`}
                                  data-category={task.category}
                                  draggable
                                  onDragStart={() => setDraggedTaskId(task.id)}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    editTask(task);
                                  }}
                                >
                                  <div className="task-pill-content">
                                    <span className="task-pill-text">
                                      {task.title}
                                    </span>
                                  </div>

                                  <div className="task-tooltip">
                                    <div><strong>{task.title}</strong></div>
                                    <div><strong>Cliente:</strong> {getClientName(task.clientId, clients) || "-"}</div>
                                    <div><strong>Tipo:</strong> {task.category}</div>
                                    <div><strong>Técnicos:</strong> {peopleFromIds(task.technicianIds, technicians) || "-"}</div>
                                    <div><strong>Estado:</strong> {task.status}</div>
                                    <div><strong>Prioridad:</strong> {task.priority}</div>
                                    <div><strong>Tiempo:</strong> {task.estimatedTime || "-"}</div>
                                    <div><strong>Vehículo:</strong> {task.vehicle || "-"}</div>
                                  </div>
                                </div>
                              ))}
                              {dayTasks.length > 4 && (
                                <div className="more-label">+{dayTasks.length - 4} más</div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="table-wrapper">
                    <table className="tasks-table">
                      <thead>
                        <tr>
                          <th>Título</th>
                          <th>Cliente</th>
                          <th>Teléfono</th>
                          <th>Tipo</th>
                          <th>Fecha</th>
                          <th>Técnicos</th>
                          <th>Estado</th>
                          <th>Prioridad</th>
                          <th>Tiempo estimado</th>
                          <th>Vehículo</th>
                          <th>Adjuntos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTasks.length === 0 ? (
                          <tr>
                            <td colSpan="11" className="table-empty">
                              No hay tareas que coincidan con los filtros.
                            </td>
                          </tr>
                        ) : (
                          filteredTasks
                            .slice()
                            .sort((a, b) => a.date.localeCompare(b.date))
                            .map((task) => (
                              <tr key={task.id} onClick={() => editTask(task)}>
                                <td>{task.title}</td>
                                <td>{getClientName(task.clientId, clients)}</td>
                                <td>{task.phone || "-"}</td>
                                <td>{task.category}</td>
                                <td>{formatShortDate(task.date)}</td>
                                <td>{peopleFromIds(task.technicianIds, technicians)}</td>
                                <td>
                                  <span className={`mini-status ${statusSlug(task.status)}`}>
                                    {task.status}
                                  </span>
                                </td>
                                <td>
                                  <span className={`mini-priority ${getPriorityClass(task.priority)}`}>
                                    {task.priority}
                                  </span>
                                </td>
                                <td>{task.estimatedTime || "-"}</td>
                                <td>{task.vehicle || "-"}</td>
                                <td>{task.attachments?.length || 0}</td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <aside className="right-panel stacked-controls-panel">
                <div className="panel-block day-panel">
                  <div className="panel-block-header">
                    <h2>Tareas del día</h2>
                    <span>{formatShortDate(selectedDate)}</span>
                  </div>

                  {selectedTasks.length === 0 ? (
                    <div className="empty-state">No hay tareas para este día.</div>
                  ) : (
                    <div className="day-task-list">
                      {selectedTasks.map((task) => (
                        <button
                          key={task.id}
                          className="day-task-card"
                          onClick={() => editTask(task)}
                        >
                          <div className="day-task-top">
                            <strong>{task.title}</strong>
                            <span className={`mini-status ${statusSlug(task.status)}`}>
                              {task.status}
                            </span>
                          </div>
                          <div className="day-task-meta">{getClientName(task.clientId, clients)}</div>
                          <div className="day-task-meta">{peopleFromIds(task.technicianIds, technicians)}</div>
                          <div className="day-task-meta">
                            {task.category} · {task.priority}
                          </div>
                          <div className="day-task-meta">
                            Adjuntos: {task.attachments?.length || 0}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </aside>
            </>
          ) : section === "tecnicos" ? (
            <section className="main-panel clients-main-panel full-width-panel">
              <TechniciansView technicians={technicians} setTechnicians={setTechnicians} tasks={tasks} />
            </section>
          ) : section === "inicio" ? (
            <section className="main-panel clients-main-panel full-width-panel">
              <InicioView tasks={tasks} clients={clients} technicians={technicians} onEditTask={editTask} />
            </section>
          ) : section === "mitrabajo" ? (
            <section className="main-panel clients-main-panel full-width-panel">
              <MiTrabajoView tasks={tasks} clients={clients} technicians={technicians} onEditTask={editTask} />
            </section>
          ) : (
            <section className="main-panel clients-main-panel full-width-panel">
              <ClientsView clients={clients} setClients={setClients} tasks={tasks} />
            </section>
          )}
        </div>
      </div>

      <TaskModal
        open={isModalOpen}
        draft={draft}
        setDraft={setDraft}
        onClose={closeModal}
        onSave={saveTask}
        onDelete={deleteTask}
        isEditing={Boolean(draft.id)}
        clients={clients}
        technicians={technicians}
        newClientName={newClientName}
        setNewClientName={setNewClientName}
        addClient={addClientFromModal}
      />

      {counterModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setCounterModalOpen(false)}
        >
          <div
            className="counter-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>Tareas: {counterFilter}</h2>
                <p>
                  {counterFilter === "Total"
                    ? "Listado completo de tareas"
                    : `Listado de tareas en estado "${counterFilter}"`}
                </p>
              </div>

              <button
                className="icon-close"
                onClick={() => setCounterModalOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="counter-modal-search">
              <input
                type="text"
                value={counterSearch}
                onChange={(e) => setCounterSearch(e.target.value)}
                placeholder="Buscar dentro de este listado..."
              />
            </div>

            <div className="counter-modal-list">
              {counterTasks.length === 0 ? (
                <div className="empty-state">
                  No hay tareas para este contador.
                </div>
              ) : (
                Object.entries(groupedCounterTasks).map(([date, tasksForDate]) => (
                  <div key={date} className="counter-date-group">
                    <div className="counter-date-heading">{date}</div>

                    <div className="counter-date-items">
                      {tasksForDate.map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          className="counter-task-card"
                          onClick={() => {
                            setCounterModalOpen(false);
                            editTask(task);
                          }}
                        >
                          <div className="counter-task-top">
                            <strong>{task.title}</strong>
                            <span
                              className={`mini-status ${task.status
                                .toLowerCase()
                                .replaceAll(" ", "-")}`}
                            >
                              {task.status}
                            </span>
                          </div>

                          <div className="counter-task-meta">
                            <strong>Cliente:</strong> {getClientName(task.clientId, clients) || "-"}
                          </div>
                          <div className="counter-task-meta">
                            <strong>Técnicos:</strong> {peopleFromIds(task.technicianIds, technicians) || "-"}
                          </div>
                          <div className="counter-task-meta">
                            <strong>Tipo:</strong> {task.category}
                          </div>
                          <div className="counter-task-meta">
                            <strong>Prioridad:</strong> {task.priority}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}