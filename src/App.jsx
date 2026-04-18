import { useEffect, useMemo, useState } from "react";

import {
  STORAGE_KEY,
  CLIENTS_STORAGE_KEY,
  TECHNICIANS_STORAGE_KEY,
} from "./data/constants";
import {
  DEFAULT_CLIENTS,
  DEFAULT_TECHNICIANS,
  initialTasks,
} from "./data/initialData";
import { todayISO, getCalendarGrid } from "./utils/date";
import { emptyTask, normalizeTask, taskHaystack } from "./utils/task";
import { migrateTasksToIds, migrateTasksToTypedSchema } from "./utils/migration";
import { useLocalStorage } from "./hooks/useLocalStorage";
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
  migrateTasksToIds();
  migrateTasksToTypedSchema();

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

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [draft, setDraft] = useState(emptyTask(todayISO()));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [newClientName, setNewClientName] = useState("");

  useEffect(() => {
    if (personFilter !== "Todos" && !technicians.some((t) => t.id === personFilter)) {
      setUi((u) => ({ ...u, personFilter: "Todos" }));
    }
  }, [technicians, personFilter, setUi]);

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

      <CounterModal
        tasks={tasks}
        clients={clients}
        technicians={technicians}
        onEditTask={editTask}
      />
    </div>
  );
}