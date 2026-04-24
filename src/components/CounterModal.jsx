import { useMemo } from "react";

import { getClientName, peopleFromIds } from "../utils/id";
import { statusSlug } from "../utils/status";
import { taskHaystack } from "../utils/task";
import { TASK_TYPES } from "../data/taskTypes";
import { useUI } from "../hooks/useUI";
import EmptyState from "./EmptyState";

export default function CounterModal({ tasks, clients, technicians, onEditTask }) {
  const {
    counterModalOpen,
    counterFilter,
    counterSearch,
    setCounterModalOpen,
    setCounterSearch,
  } = useUI();

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

  if (!counterModalOpen) return null;

  return (
    <div className="modal-overlay" onClick={() => setCounterModalOpen(false)}>
      <div className="counter-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Tareas: {counterFilter}</h2>
            <p>
              {counterFilter === "Total"
                ? "Listado completo de tareas"
                : `Listado de tareas en estado "${counterFilter}"`}
            </p>
          </div>

          <button className="icon-close" onClick={() => setCounterModalOpen(false)}>
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
            <EmptyState
              compact
              icon={counterSearch ? "search" : "inbox"}
              title={counterSearch ? "Sin resultados" : "Sin tareas"}
              description={
                counterSearch
                  ? "Prueba con otro texto de búsqueda."
                  : "No hay tareas que correspondan a este contador."
              }
            />
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
                        onEditTask(task);
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
                        <strong>Tipo:</strong> {TASK_TYPES[task.type]?.label || "-"}
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
  );
}
