import { useEffect, useMemo, useState } from "react";

import { getClientName, peopleFromIds } from "../utils/id";
import { statusSlug } from "../utils/status";
import { taskHaystack } from "../utils/task";
import { TASK_TYPES, TASK_TYPE_KEYS } from "../data/taskTypes";
import { useUI } from "../hooks/useUI";
import EmptyState from "./EmptyState";
import ClientCombobox from "./ClientCombobox";

// Helpers de fecha — todo lo trabajamos como string "YYYY-MM" para
// alinear con `task.date` que también es ISO date string.
function monthKeyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(monthKey) {
  // monthKey "2026-05" → "mayo 2026"
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

function shiftMonth(monthKey, offset) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return monthKeyOf(d);
}

const ALL_MONTHS = "all";

export default function CounterModal({ tasks, clients, technicians, onEditTask }) {
  const {
    counterModalOpen,
    counterFilter,
    counterSearch,
    setCounterModalOpen,
    setCounterSearch,
  } = useUI();

  // Mes actual recalculado al montar — si el usuario deja la app
  // abierta semanas, el valor se mantiene; al recargar se actualiza.
  const currentMonthKey = useMemo(() => monthKeyOf(new Date()), []);

  // Filtros locales del modal. Default: mes en curso para que
  // coincida con el conteo de la pill que abrió el modal.
  const [monthFilter, setMonthFilter] = useState(currentMonthKey);
  const [clientFilter, setClientFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // Reset de filtros cada vez que se abre el modal (con clave nueva
  // = clic en otra pill). El default vuelve a "este mes" para que el
  // count del modal coincida con el de la pill que el usuario acaba
  // de pulsar.
  useEffect(() => {
    if (counterModalOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMonthFilter(currentMonthKey);
      setClientFilter("");
      setTypeFilter("");
    }
  }, [counterModalOpen, currentMonthKey]);

  const counterTasks = useMemo(() => {
    let filtered;

    // 1) Status (lo que la pill abrió)
    switch (counterFilter) {
      case "No iniciado":
      case "En curso":
      case "Listo":
        filtered = tasks.filter((task) => task.status === counterFilter);
        break;
      default:
        filtered = tasks;
        break;
    }

    // 2) Mes
    if (monthFilter !== ALL_MONTHS) {
      filtered = filtered.filter(
        (t) => t.date && t.date.startsWith(monthFilter)
      );
    }

    // 3) Cliente
    if (clientFilter) {
      filtered = filtered.filter((t) => t.clientId === clientFilter);
    }

    // 4) Tipo
    if (typeFilter) {
      filtered = filtered.filter((t) => t.type === typeFilter);
    }

    // 5) Búsqueda libre
    const searchText = counterSearch.trim().toLowerCase();
    if (searchText) {
      filtered = filtered.filter((task) =>
        taskHaystack(task, clients, technicians).includes(searchText)
      );
    }

    return filtered;
  }, [tasks, clients, technicians, counterFilter, counterSearch, monthFilter, clientFilter, typeFilter]);

  const groupedCounterTasks = useMemo(() => {
    const grouped = {};
    counterTasks
      .slice()
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      .forEach((task) => {
        const key = task.date || "Sin fecha";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(task);
      });
    return grouped;
  }, [counterTasks]);

  const hasFilters =
    monthFilter !== ALL_MONTHS || clientFilter || typeFilter || counterSearch;

  function clearFilters() {
    setMonthFilter(ALL_MONTHS);
    setClientFilter("");
    setTypeFilter("");
    setCounterSearch("");
  }

  if (!counterModalOpen) return null;

  return (
    <div className="modal-overlay" onClick={() => setCounterModalOpen(false)}>
      <div className="counter-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-main">
            <div>
              <h2>Tareas: {counterFilter}</h2>
              <p>
                {monthFilter === ALL_MONTHS
                  ? "Todas las tareas históricas"
                  : `Filtrando por ${formatMonth(monthFilter)}`}
                {" · "}
                <strong>{counterTasks.length}</strong>{" "}
                {counterTasks.length === 1 ? "tarea" : "tareas"}
              </p>
            </div>
          </div>

          <button className="icon-close" onClick={() => setCounterModalOpen(false)}>
            ×
          </button>
        </div>

        {/* ─── Filtros del modal ──────────────────────────
            Mes (chips) en la primera fila — el caso más común:
            el supervisor llega aquí desde una pill y casi siempre
            quiere ver "este mes". Cliente + tipo en la segunda
            fila — útiles para volúmenes grandes. */}
        <div className="counter-filters">
          <div className="counter-filter-row counter-filter-months">
            <button
              type="button"
              className={`range-chip ${monthFilter === shiftMonth(currentMonthKey, -1) ? "active" : ""}`}
              onClick={() => setMonthFilter(shiftMonth(currentMonthKey, -1))}
            >
              Mes pasado
            </button>
            <button
              type="button"
              className={`range-chip ${monthFilter === currentMonthKey ? "active" : ""}`}
              onClick={() => setMonthFilter(currentMonthKey)}
            >
              Este mes
            </button>
            <button
              type="button"
              className={`range-chip ${monthFilter === shiftMonth(currentMonthKey, 1) ? "active" : ""}`}
              onClick={() => setMonthFilter(shiftMonth(currentMonthKey, 1))}
            >
              Próximo
            </button>
            <button
              type="button"
              className={`range-chip ${monthFilter === ALL_MONTHS ? "active" : ""}`}
              onClick={() => setMonthFilter(ALL_MONTHS)}
            >
              Todos
            </button>
          </div>

          <div className="counter-filter-row counter-filter-controls">
            <div className="counter-filter-control">
              <label className="counter-filter-label">Cliente</label>
              <ClientCombobox
                id="counter-client"
                value={clientFilter}
                onChange={setClientFilter}
                clients={clients}
                placeholder="Cualquiera"
              />
            </div>

            <div className="counter-filter-control">
              <label className="counter-filter-label">Tipo</label>
              <select
                className="counter-filter-select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">Cualquiera</option>
                {TASK_TYPE_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {TASK_TYPES[k].label}
                  </option>
                ))}
              </select>
            </div>

            {hasFilters && (
              <button
                type="button"
                className="btn-secondary small-btn counter-filter-clear"
                onClick={clearFilters}
              >
                Limpiar filtros
              </button>
            )}
          </div>
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
              icon={hasFilters ? "search" : "inbox"}
              title={hasFilters ? "Sin resultados" : "Sin tareas"}
              description={
                hasFilters
                  ? "Ninguna tarea coincide con estos filtros. Prueba a ampliar el rango."
                  : "No hay tareas que correspondan a este contador."
              }
              action={
                hasFilters
                  ? {
                      label: "Limpiar filtros",
                      variant: "primary",
                      onClick: clearFilters,
                    }
                  : undefined
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
