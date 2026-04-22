import { useEffect, useMemo, useState, useCallback } from "react";

import { supabase } from "./lib/supabase";
import { useAuth } from "./hooks/useAuth";
import { taskFromDb, taskToDb } from "./utils/taskMapper";
import { todayISO, getCalendarGrid } from "./utils/date";
import { emptyTask, normalizeTask, taskHaystack } from "./utils/task";
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

  // ── Carga de datos desde Supabase ────────────────────────
  const loadTasks = useCallback(async () => {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: true });
    if (data) setTasks(data.map(taskFromDb));
  }, []);

  const loadClients = useCallback(async () => {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .order("name", { ascending: true });
    if (data) setClients(data);
  }, []);

  const loadTechnicians = useCallback(async () => {
    const { data } = await supabase
      .from("technicians")
      .select("*")
      .order("name", { ascending: true });
    if (data) setTechnicians(data);
  }, []);

  useEffect(() => {
    async function init() {
      await Promise.all([loadTasks(), loadClients(), loadTechnicians()]);
      setLoading(false);
    }
    init();

    // Suscripciones en tiempo real — cualquier cambio recarga la tabla afectada
    const channel = supabase
      .channel("crm-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" },        loadTasks)
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" },      loadClients)
      .on("postgres_changes", { event: "*", schema: "public", table: "technicians" },  loadTechnicians)
      .subscribe();

    return () => supabase.removeChannel(channel);
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
    const row = taskToDb(taskToSave, user.id);
    if (taskToSave.id) {
      await supabase.from("tasks").update(row).eq("id", taskToSave.id);
    } else {
      await supabase.from("tasks").insert({ ...row, created_by: user.id });
    }
    setSelectedDate(taskToSave.date);
    setIsModalOpen(false);
    setDraft(emptyTask(taskToSave.date));
  }

  async function deleteTask() {
    if (!draft.id) return;
    await supabase.from("tasks").delete().eq("id", draft.id);
    setIsModalOpen(false);
    setDraft(emptyTask(selectedDate));
  }

  async function handleDropOnDate(date) {
    if (!draggedTaskId) return;
    await supabase.from("tasks")
      .update({ date, updated_by: user.id })
      .eq("id", draggedTaskId);
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
    const { data } = await supabase
      .from("clients")
      .insert({ name, created_by: user.id })
      .select()
      .single();
    if (data) setDraft({ ...draft, clientId: data.id });
    setNewClientName("");
  }

  async function handleAddClient(name) {
    await supabase.from("clients").insert({ name, created_by: user.id });
  }

  async function handleUpdateClient(id, name) {
    await supabase.from("clients").update({ name }).eq("id", id);
  }

  async function handleDeleteClient(id) {
    await supabase.from("clients").delete().eq("id", id);
  }

  // ── CRUD — Técnicos ──────────────────────────────────────
  async function handleAddTechnician(name) {
    await supabase.from("technicians").insert({ name, phone: "", specialty: "" });
  }

  async function handleUpdateTechnician(id, name) {
    await supabase.from("technicians").update({ name }).eq("id", id);
  }

  async function handleDeleteTechnician(id) {
    await supabase.from("technicians").delete().eq("id", id);
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
