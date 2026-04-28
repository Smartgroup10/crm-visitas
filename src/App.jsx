import { useEffect, useMemo, useState, useCallback } from "react";

import { api } from "./lib/api";
import { connectSocket, disconnectSocket } from "./lib/socket";
import { useAuth } from "./hooks/useAuth";
import { taskFromDb, taskToDb } from "./utils/taskMapper";
import { todayISO, getCalendarGrid, getWeekGrid, addDays, shiftMonthIso } from "./utils/date";
import { emptyTask, taskHaystack } from "./utils/task";
import { TASK_TYPE_KEYS } from "./data/taskTypes";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useUI } from "./hooks/useUI";
import { useToast } from "./hooks/useToast";
import { useConfirm } from "./hooks/useConfirm";
import TaskModal from "./components/TaskModal";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import CounterModal from "./components/CounterModal";
import ShortcutsHelp from "./components/ShortcutsHelp";
import AppSkeleton from "./components/AppSkeleton";
import NotificationOrchestrator from "./components/NotificationOrchestrator";
import ClientsView from "./components/views/ClientsView";
import InicioView from "./components/views/InicioView";
import MiTrabajoView from "./components/views/MiTrabajoView";
import SeguimientoView from "./components/views/SeguimientoView";
import UsersView from "./components/views/UsersView";
import InformesView from "./components/views/InformesView";

export default function App() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const {
    section,
    calendarMode,
    search,
    personFilter,
    statusFilter,
    priorityFilter,
    categoryFilter,
    setUi,
    setCalendarMode,
    counterModalOpen,
    setCounterModalOpen,
  } = useUI();

  const isAdmin = user?.role === "admin";

  // ── Estado de datos ───────────────────────────────────────
  // Nota: `technicians` no existe como tabla separada desde la fusión con
  // `users`. Cualquier usuario (admin / supervisor / tecnico) puede ser
  // asignado a una tarea, así que las vistas reciben `users` como la lista
  // de personas asignables (expuesto abajo como alias `technicians`).
  const [clients, setClients] = useState([]);
  const [tasks, setTasks]     = useState([]);
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);

  // Alias semántico: las vistas históricas piden `technicians` como la
  // lista de personas asignables a una tarea. Tras la fusión, esa lista
  // ES la de usuarios. Debe ir DESPUÉS del useState que declara `users`
  // (si no, explota con ReferenceError por TDZ al montar).
  const technicians = users;

  // ── Estado de UI ─────────────────────────────────────────
  // La fecha seleccionada es la única ancla temporal del calendario:
  // el mes y la semana visibles se derivan de ella, y las vistas de
  // "semana" / "día" la usan directamente.
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [draft, setDraft]               = useState(emptyTask(todayISO()));
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [newClientName, setNewClientName] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  // ── Carga inicial desde el backend ───────────────────────
  const loadTasks = useCallback(async () => {
    const rows = await api.get("/tasks");
    setTasks((rows || []).map(taskFromDb));
  }, []);

  const loadClients = useCallback(async () => {
    const rows = await api.get("/clients");
    setClients(rows || []);
  }, []);

  // Listado de equipo accesible a cualquier usuario autenticado:
  // lo usamos para selectores de técnico, filtros por persona y
  // las vistas de Equipo / Informes. El backend restringe las escrituras.
  const loadUsers = useCallback(async () => {
    try {
      const rows = await api.get("/users");
      setUsers(rows || []);
    } catch (err) {
      console.error("Error cargando usuarios:", err);
      toast.error(err?.message || "No se pudo cargar el equipo.");
    }
  }, [toast]);

  // ── Arranque: carga inicial + conexión de socket ────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await Promise.all([loadTasks(), loadClients(), loadUsers()]);
      } catch (err) {
        console.error("Error cargando datos iniciales:", err);
        toast.error(err?.message || "Error cargando datos iniciales.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();

    // Tiempo real: el backend emite *:change; recargamos la tabla afectada.
    // Recargar todo el listado (en lugar de aplicar el delta) mantiene la lógica
    // simple y garantiza orden y consistencia.
    const socket = connectSocket();
    const onTasks   = () => loadTasks();
    const onClients = () => loadClients();
    const onUsers   = () => loadUsers();

    socket.on("tasks:change",   onTasks);
    socket.on("clients:change", onClients);
    socket.on("users:change",   onUsers);

    return () => {
      cancelled = true;
      socket.off("tasks:change",   onTasks);
      socket.off("clients:change", onClients);
      socket.off("users:change",   onUsers);
      disconnectSocket();
    };
  }, [loadTasks, loadClients, loadUsers, toast]);

  // ── Apertura por evento (clic en Notification del navegador) ──
  // El NotificationOrchestrator emite `crm:open-task` cuando el usuario
  // hace clic en una notificación de tarea. Lo escuchamos aquí para
  // abrir el TaskModal sin recargar la página.
  useEffect(() => {
    function onOpenTask(e) {
      const id = e?.detail?.id;
      if (!id) return;
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      setDraft({ ...task });
      setIsModalOpen(true);
      if (task.date) setSelectedDate(task.date);
    }
    window.addEventListener("crm:open-task", onOpenTask);
    return () => window.removeEventListener("crm:open-task", onOpenTask);
  }, [tasks]);

  // ── Deep link ?task=<id> ────────────────────────────────
  // Cuando un email contiene un enlace tipo `https://crm/?task=<uuid>`,
  // queremos abrir el modal con esa tarea cargada en cuanto se haya cargado
  // la lista. Limpiamos el query string para que un refresh no reabra el
  // modal y para que el botón "atrás" no entre en bucle.
  useEffect(() => {
    if (loading) return;
    const params = new URLSearchParams(window.location.search);
    const wantedId = params.get("task");
    if (!wantedId) return;
    const task = tasks.find((t) => t.id === wantedId);
    if (task) {
      setDraft({ ...task });
      setIsModalOpen(true);
      if (task.date) setSelectedDate(task.date);
    }
    // Quitar el parámetro tras procesarlo. No queremos recargar si la tarea
    // ya no existe: simplemente lo retiramos para que el usuario vea la app
    // normal en vez de un error en bucle.
    params.delete("task");
    const newUrl = `${window.location.pathname}${
      params.toString() ? `?${params.toString()}` : ""
    }${window.location.hash}`;
    window.history.replaceState({}, "", newUrl);
    // Solo en la primera carga: si más tareas llegan después por socket,
    // no queremos reabrir el modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

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
  const currentMonth = useMemo(() => {
    const d = new Date(`${selectedDate}T00:00:00`);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }, [selectedDate]);

  const monthCells = useMemo(() => getCalendarGrid(currentMonth), [currentMonth]);
  const weekCells  = useMemo(() => getWeekGrid(selectedDate), [selectedDate]);

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
  // saveTask NO atrapa el error: lo re-lanza para que TaskModal muestre
  // los errores por campo (p. ej. validación zod del backend). Solo
  // muestra toast si es éxito.
  async function saveTask(taskToSave) {
    const row = taskToDb(taskToSave, user?.id);
    const isNew = !taskToSave.id;
    try {
      if (!isNew) {
        await api.put(`/tasks/${taskToSave.id}`, row);
      } else {
        await api.post("/tasks", row);
      }
    } catch (err) {
      // Si es error de red (sin details), mostramos toast para que el usuario
      // sepa qué pasó; si tiene details (validación), TaskModal los pinta.
      if (!err?.details) {
        toast.error(err?.message || "No se pudo guardar la tarea.");
      }
      throw err;
    }
    toast.success(isNew ? "Tarea creada." : "Tarea actualizada.");
    setSelectedDate(taskToSave.date);
    setIsModalOpen(false);
    setDraft(emptyTask(taskToSave.date));
  }

  async function deleteTask() {
    if (!draft.id) return;
    const ok = await confirm({
      title: "Borrar tarea",
      message: `¿Seguro que quieres borrar "${draft.title || "esta tarea"}"? Esta acción no se puede deshacer.`,
      variant: "danger",
      confirmLabel: "Borrar",
    });
    if (!ok) return;
    try {
      await api.delete(`/tasks/${draft.id}`);
    } catch (err) {
      toast.error(err?.message || "No se pudo borrar la tarea.");
      throw err;
    }
    toast.success("Tarea borrada.");
    setIsModalOpen(false);
    setDraft(emptyTask(selectedDate));
  }

  async function handleDropOnDate(date) {
    if (!draggedTaskId) return;
    const taskId = draggedTaskId;
    setDraggedTaskId(null);

    // Optimistic update: actualizamos el estado local primero para
    // que la pill aparezca en la celda destino al instante. Si el
    // PATCH falla, hacemos rollback con el snapshot previo. Si la
    // tarea cae en el mismo día de antes (drop sin cambio real),
    // ahorramos el round-trip al backend.
    const prevTask = tasks.find((t) => t.id === taskId);
    if (!prevTask) return;
    if (prevTask.date === date) {
      setSelectedDate(date);
      return;
    }

    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, date } : t)));
    setSelectedDate(date);

    try {
      await api.patch(`/tasks/${taskId}`, { date });
      // El socket emitirá tasks:change con la fila actualizada (más
      // los cambios de updated_at, etc.) y el listener del estado
      // global la mergeará. El optimistic update de arriba ya nos da
      // la respuesta visual inmediata, así que aquí no hace falta
      // tocar nada más.
    } catch (err) {
      // Rollback: restauramos la fila original. El usuario ve la
      // pill volver a su sitio + un toast con el motivo.
      setTasks((prev) => prev.map((t) => (t.id === taskId ? prevTask : t)));
      toast.error(err?.message || "No se pudo mover la tarea.");
    }
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
    try {
      const created = await api.post("/clients", { name });
      if (created) setDraft({ ...draft, clientId: created.id });
      setNewClientName("");
      toast.success(`Cliente "${name}" creado.`);
    } catch (err) {
      toast.error(err?.message || "No se pudo crear el cliente.");
    }
  }

  async function handleAddClient(name) {
    try {
      await api.post("/clients", { name });
      toast.success(`Cliente "${name}" creado.`);
    } catch (err) {
      toast.error(err?.message || "No se pudo crear el cliente.");
      throw err;
    }
  }

  async function handleUpdateClient(id, name) {
    try {
      await api.put(`/clients/${id}`, { name });
      toast.success("Cliente actualizado.");
    } catch (err) {
      toast.error(err?.message || "No se pudo actualizar el cliente.");
      throw err;
    }
  }

  async function handleDeleteClient(id) {
    try {
      await api.delete(`/clients/${id}`);
      toast.success("Cliente borrado.");
    } catch (err) {
      toast.error(err?.message || "No se pudo borrar el cliente.");
      throw err;
    }
  }

  // ── CRUD — Equipo (solo admin) ───────────────────────────
  // Estos re-lanzan sin toast de error para que UsersView pueda mostrar
  // errores por campo (validación). El toast de éxito sí lo ponemos aquí.
  async function handleCreateUser(payload) {
    await api.post("/users", payload);
    toast.success(`Usuario "${payload?.email || ""}" creado.`);
  }

  async function handleUpdateUser(id, payload) {
    await api.put(`/users/${id}`, payload);
    toast.success("Usuario actualizado.");
  }

  async function handleResetUserPassword(id, password) {
    await api.patch(`/users/${id}/password`, { password });
    toast.success("Contraseña restablecida.");
  }

  async function handleDeleteUser(id) {
    await api.delete(`/users/${id}`);
    toast.success("Usuario borrado.");
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
    setSelectedDate(todayISO());
  }

  // Navega al período anterior/siguiente según el modo activo del calendario:
  //  - mes    → ±1 mes (manteniendo el día, clampado al último día del mes destino)
  //  - semana → ±7 días
  //  - día    → ±1 día
  function changePeriod(offset) {
    if (calendarMode === "semana") {
      setSelectedDate((prev) => addDays(prev, offset * 7));
    } else if (calendarMode === "dia") {
      setSelectedDate((prev) => addDays(prev, offset));
    } else {
      setSelectedDate((prev) => shiftMonthIso(prev, offset));
    }
  }

  // ── Atajos de teclado ─────────────────────────────────────
  useKeyboardShortcuts({
    onNew: openNewTask,
    onSearchFocus: () => {
      const searchEl = document.querySelector(".search-input");
      if (searchEl) searchEl.focus();
    },
    onGoToday: goToday,
    onCalendarMode: (mode) => {
      // Solo tiene sentido cambiar modo de calendario si estamos en la vista
      // de instalaciones (que es la que muestra el calendario).
      if (section === "instalaciones") setCalendarMode(mode);
    },
    onHelp: () => setHelpOpen(true),
    onEscape: () => {
      if (helpOpen) {
        setHelpOpen(false);
        return;
      }
      if (isModalOpen || counterModalOpen) {
        setIsModalOpen(false);
        setCounterModalOpen(false);
      }
    },
  });

  // ── Loading ──────────────────────────────────────────────
  if (loading) {
    return <AppSkeleton />;
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
              weekCells={weekCells}
              currentMonth={currentMonth}
              tasksByDate={tasksByDate}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              setDraggedTaskId={setDraggedTaskId}
              handleDropOnDate={handleDropOnDate}
              goToday={goToday}
              changePeriod={changePeriod}
              filteredTasks={filteredTasks}
              selectedTasks={selectedTasks}
              clients={clients}
              technicians={technicians}
              onEditTask={editTask}
              openNewTask={openNewTask}
            />
          ) : section === "inicio" ? (
            <section className="main-panel clients-main-panel full-width-panel">
              <InicioView
                tasks={tasks}
                clients={clients}
                technicians={technicians}
                onEditTask={editTask}
                openNewTask={openNewTask}
              />
            </section>
          ) : section === "mitrabajo" ? (
            <section className="main-panel clients-main-panel full-width-panel">
              <MiTrabajoView
                tasks={tasks}
                clients={clients}
                technicians={technicians}
                onEditTask={editTask}
                openNewTask={openNewTask}
              />
            </section>
          ) : section === "usuarios" ? (
            <section className="main-panel clients-main-panel full-width-panel">
              <UsersView
                users={users}
                tasks={tasks}
                currentUserId={user?.id}
                currentUserRole={user?.role}
                canManage={isAdmin}
                onCreate={handleCreateUser}
                onUpdate={handleUpdateUser}
                onResetPassword={handleResetUserPassword}
                onDelete={handleDeleteUser}
              />
            </section>
          ) : section === "informes" ? (
            <section className="main-panel clients-main-panel full-width-panel">
              <InformesView
                tasks={tasks}
                users={users}
                clients={clients}
                onEditTask={editTask}
              />
            </section>
          ) : (
            <section className="main-panel clients-main-panel full-width-panel">
              <ClientsView
                clients={clients}
                tasks={tasks}
                technicians={technicians}
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

      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/*
        Orquestador de notificaciones in-app. No renderiza UI: escucha
        el socket "notify" del backend y vigila localmente las tareas
        + recordatorios para disparar Notification del navegador y
        toast cuando llega el momento.
      */}
      {user?.id && (
        <NotificationOrchestrator
          userId={user.id}
          tasks={tasks}
          leadMinutes={user.notify_lead_minutes ?? 60}
        />
      )}
    </div>
  );
}
