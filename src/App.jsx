import { useMemo, useState } from "react";

import {
  STORAGE_KEY,
  CLIENTS_STORAGE_KEY,
  UI_STORAGE_KEY,
  TECHNICIANS_STORAGE_KEY,
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  CATEGORY_OPTIONS,
  VALID_SECTIONS,
} from "./data/constants";
import {
  DEFAULT_CLIENTS,
  DEFAULT_TECHNICIANS,
  initialTasks,
} from "./data/initialData";
import { todayISO, getCalendarGrid } from "./utils/date";
import { getClientName, peopleFromIds } from "./utils/id";
import { statusSlug } from "./utils/status";
import { emptyTask, normalizeTask, taskHaystack } from "./utils/task";
import { migrateTasksToIds } from "./utils/migration";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import TaskModal from "./components/TaskModal";
import Sidebar from "./components/Sidebar";
import ClientsView from "./components/views/ClientsView";
import TechniciansView from "./components/views/TechniciansView";
import InicioView from "./components/views/InicioView";
import MiTrabajoView from "./components/views/MiTrabajoView";
import SeguimientoView from "./components/views/SeguimientoView";

const DEFAULT_UI = {
  section: "inicio",
  activeView: "Calendario",
  search: "",
  personFilter: "Todos",
  statusFilter: "Todos",
  priorityFilter: "Todas",
  categoryFilter: "Todas",
};

export default function App() {
  migrateTasksToIds();

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
    parser: (parsed, fallback) => {
      if (!parsed || typeof parsed !== "object") return fallback;
      const merged = { ...fallback, ...parsed };
      if (!VALID_SECTIONS.includes(merged.section)) {
        merged.section = fallback.section;
      }
      return merged;
    },
  });
  const { section, activeView, search, personFilter, statusFilter, priorityFilter, categoryFilter } = ui;
  const setSection = (v) => setUi((u) => ({ ...u, section: v }));
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
      <Sidebar section={section} setSection={setSection} />

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
            <SeguimientoView
              activeView={activeView}
              monthCells={monthCells}
              currentMonth={currentMonth}
              tasksByDate={tasksByDate}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              setDraggedTaskId={setDraggedTaskId}
              handleDropOnDate={handleDropOnDate}
              goToday={goToday}
              changeMonth={changeMonth}
              filteredTasks={filteredTasks}
              selectedTasks={selectedTasks}
              clients={clients}
              technicians={technicians}
              onEditTask={editTask}
            />
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
                            <span className={`mini-status ${statusSlug(task.status)}`}>
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