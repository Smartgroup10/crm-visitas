import { useEffect, useMemo, useState, useCallback } from "react";

import { api } from "./lib/api";
import { connectSocket, disconnectSocket } from "./lib/socket";
import { useAuth } from "./hooks/useAuth";
import { taskFromDb, taskToDb } from "./utils/taskMapper";
import { todayISO, getCalendarGrid } from "./utils/date";
import { emptyTask, taskHaystack } from "./utils/task";
import { TASK_TYPE_KEYS } from "./data/taskTypes";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useUI } from "./hooks/useUI";
import TaskModal from "./components/TaskModal";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import CounterModal from "./components/CounterModal";
import ClientsView from "./components/views/ClientsView";
import TechniciansView from "./components/views/TechniciansView";
import InicioView from "./components/views/InicioView";
import MiTrabajoView from "./components/views/MiTrabajoView";
import SeguimientoView from "./components/views/SeguimientoView";

export default function App() {
  const { user } = useAuth();

  const {
    section,
    search,
    personFilter,
    statusFilter,
    priorityFilter,
    categoryFilter,
    setUi,
    counterModalOpen,
    setCounterModalOpen,
  } = useUI();

  // ── Estado de datos ───────────────────────────────────────
  const [clients, setClients]         = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [tasks, setTasks]             = useState([]);
  const [loading, setLoading]         = useState(true);

  // ── Estado de UI ─────────────────────────────────────────
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [draft, setDraft]               = useState(emptyTask(todayISO()));
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [newClientName, setNewClientName] = useState("");

  // ── Carga inicial desde el backend ───────────────────────
  const loadTasks = useCallback(async () => {
    const rows = await api.get("/tasks");
    setTasks((rows || []).map(taskFromDb));
  }, []);

  const loadClients = useCallback(async () => {
    const rows = await api.get("/clients");
    setClients(rows || []);
  }, []);

  const loadTechnicians = useCallback(async () => {
    const rows = await api.get("/technicians");
    setTechnicians(rows || []);
  }, []);

  // ── Arranque: carga inicial + conexión de socket ────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await Promise.all([loadTasks(), loadClients(), loadTechnicians()]);
      } catch (err) {
        console.error("Error cargando datos iniciales:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();

    // Tiempo real: el backend emite *:change; recargamos la tabla afectada.
    // Recargar todo el listado (en lugar de aplicar el delta) mantiene la lógica
    // simple y garantiza orden y consistencia.
    const socket = connectSocket();
    const onTasks       = () => loadTasks();
    const onClients     = () => loadClients();
    const onTechnicians = () => loadTechnicians();

    socket.on("tasks:change",       onTasks);
    socket.on("clients:change",     onClients);
    socket.on("technicians:change", onTechnicians);

    return () => {
      cancelled = true;
      socket.off("tasks:change",       onTasks);
      socket.off("clients:change",     onClients);
      socket.off("technicians:change", onTechnicians);
      disconnectSocket();
    };
  }, [loadTasks, loadClients, loadTechnicians]);

  // ── Sincronización de filtros ────────────────────────────
  useEffect(() => {
    if (personFilter !== "Todos" && !technicians.some((t) => t.id === personFilter)) {
      setUi((u) => ({ ...u, personFilter: "Todos" }));
    }
  }, [technicians, personFilter, setUi]);

  useEffect(() => {
    if (categoryFilter !== "Todas" && !TASK_TYPE_KEYS.includes(categoryFilter)) {
      setUi((u) => ({ ...u, categoryFilter: "Todas" }));
    }
  }, [categoryFilter, setUi]);

  // ── Datos derivados ──────────────────────────────────────
  const monthCells = useMemo(() => getCalendarGrid(currentMonth), [currentMonth]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch   = taskHaystack(task, clients, technicians).includes(search.toLowerCase());
      const matchesPerson   = personFilter === "Todos" || task.technicianIds.includes(personFilter);
      const matchesStatus   = statusFilter === "Todos" || task.status === statusFilter;
      const matchesPriority = priorityFilter === "Todas" || task.priority === priorityFilter;
      const matchesCategory = categoryFilter === "Todas" || task.type === categoryFilter;
      return matchesSearch && matchesPerson && matchesStatus && matchesPriority && matchesCategory;
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
    return (tasksByDate[selectedDate] || []).slice().sort((a, b) =>
      a.title.localeCompare(b.title, "es")
    );
  }, [tasksByDate, selectedDate]);

  const stats = useMemo(() => ({
    total:   tasks.length,
    pending: tasks.filter((t) => t.status === "No iniciado").length,
    progress:tasks.filter((t) => t.status === "En curso").length,
    done:    tasks.filter((t) => t.status === "Listo").length,
  }), [tasks]);

  // ── CRUD — Tareas ────────────────────────────────────────
  async function saveTask(taskToSave) {
    const row = taskToDb(taskToSave, user?.id);
    if (taskToSave.id) {
      await api.put(`/tasks/${taskToSave.id}`, row);
    } else {
      await api.post("/tasks", row);
    }
    setSelectedDate(taskToSave.date);
    setIsModalOpen(false);
    setDraft(emptyTask(taskToSave.date));
  }

  async function deleteTask() {
    if (!draft.id) return;
    await api.delete(`/tasks/${draft.id}`);
    setIsModalOpen(false);
    setDraft(emptyTask(selectedDate));
  }

  async function handleDropOnDate(date) {
    if (!draggedTaskId) return;
    await api.patch(`/tasks/${draggedTaskId}`, { date });
    setDraggedTaskId(null);
    setSelectedDate(date);
  }

  // ── CRUD — Clientes ──────────────────────────────────────
  async function addClientFromModal() {
    const name = newClientName.trim();
    if (!name) return;
    const existing = clients.find((c) => c.name === name);
    if (existing) {
      setDraft({ ...draft, clientId: existing.id });
      setNewClientName("");
      return;
    }
    const created = await api.post("/clients", { name });
    if (created) setDraft({ ...draft, clientId: created.id });
    setNewClientName("");
  }

  async function handleAddClient(name) {
    await api.post("/clients", { name });
  }

  async function handleUpdateClient(id, name) {
    await api.put(`/clients/${id}`, { name });
  }

  async function handleDeleteClient(id) {
    await api.delete(`/clients/${id}`);
  }

  // ── CRUD — Técnicos ──────────────────────────────────────
  async function handleAddTechnician(name) {
    await api.post("/technicians", { name, phone: "", specialty: "" });
  }

  async function handleUpdateTechnician(id, name) {
    await api.put(`/technicians/${id}`, { name });
  }

  async function handleDeleteTechnician(id) {
    await api.delete(`/technicians/${id}`);
  }

  // ── Modal ────────────────────────────────────────────────
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

  // ── Calendario ───────────────────────────────────────────
  function goToday() {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(todayISO());
  }

  function changeMonth(offset) {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  }

  // ── Atajos de teclado ─────────────────────────────────────
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

  // ── Loading ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <p>Cargando datos…</p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="app-shell">
      <Sidebar />

      <div className="main-shell">
        <Topbar stats={stats} technicians={technicians} openNewTask={openNewTask} />

        <div className="content-grid integrated-layout">
          {section === "instalaciones" ? (
            <SeguimientoView
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
              <TechniciansView
                technicians={technicians}
                tasks={tasks}
                onAdd={handleAddTechnician}
                onUpdate={handleUpdateTechnician}
                onDelete={handleDeleteTechnician}
              />
            </section>
          ) : section === "inicio" ? (
            <section className="main-panel clients-main-panel full-width-panel">
              <InicioView
                tasks={tasks}
                clients={clients}
                technicians={technicians}
                onEditTask={editTask}
              />
            </section>
          ) : section === "mitrabajo" ? (
            <section className="main-panel clients-main-panel full-width-panel">
              <MiTrabajoView
                tasks={tasks}
                clients={clients}
                technicians={technicians}
                onEditTask={editTask}
              />
            </section>
          ) : (
            <section className="main-panel clients-main-panel full-width-panel">
              <ClientsView
                clients={clients}
                tasks={tasks}
                onAdd={handleAddClient}
                onUpdate={handleUpdateClient}
                onDelete={handleDeleteClient}
              />
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

      <CounterModal
        tasks={tasks}
        clients={clients}
        technicians={technicians}
        onEditTask={editTask}
      />
    </div>
  );
}
