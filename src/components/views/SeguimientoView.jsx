import { useEffect, useMemo, useRef, useState } from "react";

import { TASK_TYPES } from "../../data/taskTypes";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "../../data/constants";
import {
  toISO,
  todayISO,
  formatMonthYear,
  formatShortDate,
  formatWeekRange,
  formatLongDate,
} from "../../utils/date";
import { getClientName, peopleFromIds } from "../../utils/id";
import { statusSlug, getStatusClass, getPriorityClass } from "../../utils/status";
import { useUI } from "../../hooks/useUI";
import { usePermissions } from "../../hooks/usePermissions";
import { useTouchDrag } from "../../hooks/useTouchDrag";
import EmptyState from "../EmptyState";

const WEEKDAY_LABELS = ["lun.", "mar.", "mié.", "jue.", "vie.", "sáb.", "dom."];

function TaskTooltip({ task, clients, technicians }) {
  return (
    <div className="task-tooltip">
      <div><strong>{task.title}</strong></div>
      <div><strong>Cliente:</strong> {getClientName(task.clientId, clients) || "-"}</div>
      <div><strong>Tipo:</strong> {TASK_TYPES[task.type]?.label || "-"}</div>
      <div><strong>Técnicos:</strong> {peopleFromIds(task.technicianIds, technicians) || "-"}</div>
      <div><strong>Estado:</strong> {task.status}</div>
      <div><strong>Prioridad:</strong> {task.priority}</div>
      <div><strong>Tiempo:</strong> {task.estimatedTime || "-"}</div>
      <div><strong>Vehículo:</strong> {task.vehicle || "-"}</div>
    </div>
  );
}

function TaskPill({
  task,
  canManage,
  setDraggedTaskId,
  handleDropOnDate,
  onEditTask,
  clients,
  technicians,
  showTooltip = true,
}) {
  // Estado local "esta pill se está arrastrando ahora mismo". Se usa
  // tanto en desktop (HTML5 drag) como en touch para aplicar el look
  // & feel de "estoy en modo drag" — opacidad, escala, etc.
  const [isDragging, setIsDragging] = useState(false);

  // Hook de drag por touch (móvil/tablet). En desktop el HTML5 nativo
  // se encarga; este hook NO interfiere porque sólo escucha eventos
  // touch*, no mouse*.
  const touchRef = useTouchDrag({
    enabled: canManage,
    onStart: () => {
      setIsDragging(true);
      setDraggedTaskId(task.id);
    },
    onDrop: (date) => {
      setIsDragging(false);
      // El draggedTaskId se gestiona en App; lo pasamos por
      // handleDropOnDate que ya lo recoge y resetea.
      handleDropOnDate?.(date);
    },
    onCancel: () => {
      setIsDragging(false);
      setDraggedTaskId(null);
    },
  });

  return (
    <div
      ref={touchRef}
      className={`task-pill ${getStatusClass(task.status)} ${getPriorityClass(task.priority)} ${isDragging ? "is-dragging" : ""}`}
      data-type={task.type}
      draggable={canManage}
      onDragStart={canManage ? () => {
        setIsDragging(true);
        setDraggedTaskId(task.id);
      } : undefined}
      onDragEnd={canManage ? () => {
        setIsDragging(false);
      } : undefined}
      onClick={(e) => {
        e.stopPropagation();
        // Si veníamos de un drag, no abrimos el modal por error.
        if (isDragging) return;
        onEditTask(task);
      }}
    >
      <div className="task-pill-content">
        {task.startTime && (
          <span className="task-pill-time">{task.startTime}</span>
        )}
        <span className="task-pill-text">{task.title}</span>
      </div>
      {showTooltip && <TaskTooltip task={task} clients={clients} technicians={technicians} />}
    </div>
  );
}

export default function SeguimientoView({
  monthCells,
  weekCells,
  currentMonth,
  tasksByDate,
  selectedDate,
  setSelectedDate,
  setDraggedTaskId,
  handleDropOnDate,
  goToday,
  changePeriod,
  filteredTasks,
  selectedTasks,
  clients,
  technicians,
  onEditTask,
  openNewTask,
  bulkUpdateTasks,
  bulkDeleteTasks,
}) {
  const {
    activeView, calendarMode, setCalendarMode,
    search, personFilter, statusFilter, priorityFilter, categoryFilter,
    resetFilters,
  } = useUI();
  const { canManage } = usePermissions();

  // ¿Hay filtros activos? Si los hay, el empty state ofrece "Limpiar filtros".
  // Si no, ofrece "Crear nueva tarea" (cuando el usuario puede gestionar).
  const hasActiveFilters =
    !!search ||
    personFilter   !== "Todos" ||
    statusFilter   !== "Todos" ||
    priorityFilter !== "Todas" ||
    categoryFilter !== "Todas";

  const isCalendar = activeView === "Calendario";
  const isDayMode  = isCalendar && calendarMode === "dia";

  let periodLabel = "";
  if (isCalendar) {
    if (calendarMode === "semana")    periodLabel = formatWeekRange(selectedDate);
    else if (calendarMode === "dia")  periodLabel = formatLongDate(selectedDate);
    else                              periodLabel = formatMonthYear(currentMonth);
  }

  return (
    <>
      <section
        className={`main-panel top-aligned-panel ${isDayMode ? "calendar-day-mode" : ""}`}
      >
        {isCalendar ? (
          <>
            <div className="calendar-topbar">
              <div className="calendar-mode-tabs" role="tablist" aria-label="Modo del calendario">
                <button
                  type="button"
                  role="tab"
                  aria-selected={calendarMode === "mes"}
                  className={`calendar-mode-tab ${calendarMode === "mes" ? "active" : ""}`}
                  onClick={() => setCalendarMode("mes")}
                >
                  Mes
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={calendarMode === "semana"}
                  className={`calendar-mode-tab ${calendarMode === "semana" ? "active" : ""}`}
                  onClick={() => setCalendarMode("semana")}
                >
                  Semana
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={calendarMode === "dia"}
                  className={`calendar-mode-tab ${calendarMode === "dia" ? "active" : ""}`}
                  onClick={() => setCalendarMode("dia")}
                >
                  Día
                </button>
              </div>

              <div className="calendar-topbar-controls">
                <button className="ghost-btn" onClick={goToday}>
                  Hoy
                </button>
                <button
                  className="ghost-icon"
                  onClick={() => changePeriod(-1)}
                  aria-label="Periodo anterior"
                >
                  ‹
                </button>
                <button
                  className="ghost-icon"
                  onClick={() => changePeriod(1)}
                  aria-label="Periodo siguiente"
                >
                  ›
                </button>
                <div className="month-label">{periodLabel}</div>
              </div>
            </div>

            {calendarMode === "mes" && (
              <MonthView
                monthCells={monthCells}
                currentMonth={currentMonth}
                tasksByDate={tasksByDate}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                canManage={canManage}
                setDraggedTaskId={setDraggedTaskId}
                handleDropOnDate={handleDropOnDate}
                onEditTask={onEditTask}
                clients={clients}
                technicians={technicians}
              />
            )}

            {calendarMode === "semana" && (
              <WeekView
                weekCells={weekCells}
                tasksByDate={tasksByDate}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                canManage={canManage}
                setDraggedTaskId={setDraggedTaskId}
                handleDropOnDate={handleDropOnDate}
                onEditTask={onEditTask}
                clients={clients}
                technicians={technicians}
              />
            )}

            {calendarMode === "dia" && (
              <DayView
                selectedDate={selectedDate}
                tasksByDate={tasksByDate}
                onEditTask={onEditTask}
                clients={clients}
                canManage={canManage}
                openNewTask={openNewTask}
                technicians={technicians}
              />
            )}
          </>
        ) : (
          <TableView
            filteredTasks={filteredTasks}
            clients={clients}
            technicians={technicians}
            onEditTask={onEditTask}
            canManage={canManage}
            hasActiveFilters={hasActiveFilters}
            resetFilters={resetFilters}
            openNewTask={openNewTask}
            bulkUpdateTasks={bulkUpdateTasks}
            bulkDeleteTasks={bulkDeleteTasks}
          />
        )}
      </section>

      {!isDayMode && (
        <aside className="right-panel stacked-controls-panel">
          <div className="panel-block day-panel">
            <div className="panel-block-header">
              <h2>Tareas del día</h2>
              <span>{formatShortDate(selectedDate)}</span>
            </div>

            {selectedTasks.length === 0 ? (
              <EmptyState
                compact
                icon="check"
                title="Día sin tareas"
                description="Pulsa sobre otro día del calendario o crea una nueva tarea."
                action={
                  canManage && openNewTask
                    ? { label: "+ Nueva tarea", variant: "primary", onClick: openNewTask }
                    : undefined
                }
              />
            ) : (
              <div className="day-task-list">
                {selectedTasks.map((task) => (
                  <button
                    key={task.id}
                    className="day-task-card"
                    onClick={() => onEditTask(task)}
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
                      {TASK_TYPES[task.type]?.label || task.type} · {task.priority}
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
      )}
    </>
  );
}

// ─── Vista MES ───────────────────────────────────────────────
function MonthView({
  monthCells,
  currentMonth,
  tasksByDate,
  selectedDate,
  setSelectedDate,
  canManage,
  setDraggedTaskId,
  handleDropOnDate,
  onEditTask,
  clients,
  technicians,
}) {
  return (
    <>
      <div className="calendar-weekdays">
        {WEEKDAY_LABELS.map((l) => <div key={l}>{l}</div>)}
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
              className={`calendar-cell ${!isCurrentMonth ? "outside" : ""} ${isSelected ? "selected" : ""}`}
              onClick={() => setSelectedDate(iso)}
              onDragOver={canManage ? (e) => {
                e.preventDefault();
                e.currentTarget.classList.add("drop-target-active");
              } : undefined}
              onDragLeave={canManage ? (e) => {
                e.currentTarget.classList.remove("drop-target-active");
              } : undefined}
              onDrop={canManage ? (e) => {
                e.currentTarget.classList.remove("drop-target-active");
                handleDropOnDate(iso);
              } : undefined}
              data-drop-date={iso}
            >
              <div className="cell-header">
                <span className={`cell-day ${isToday ? "today" : ""}`}>
                  {String(date.getDate()).padStart(2, "0")}
                </span>
              </div>

              <div className="cell-tasks">
                {dayTasks.slice(0, 4).map((task) => (
                  <TaskPill
                    key={task.id}
                    task={task}
                    canManage={canManage}
                    setDraggedTaskId={setDraggedTaskId}
                    handleDropOnDate={handleDropOnDate}
                    onEditTask={onEditTask}
                    clients={clients}
                    technicians={technicians}
                  />
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
  );
}

// ─── Vista SEMANA ────────────────────────────────────────────
function WeekView({
  weekCells,
  tasksByDate,
  selectedDate,
  setSelectedDate,
  canManage,
  setDraggedTaskId,
  handleDropOnDate,
  onEditTask,
  clients,
  technicians,
}) {
  return (
    <div className="week-grid">
      {weekCells.map((date, idx) => {
        const iso = toISO(date);
        const dayTasks = tasksByDate[iso] || [];
        const isSelected = iso === selectedDate;
        const isToday = iso === todayISO();

        return (
          <div
            key={iso}
            className={`week-column ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}`}
            onDragOver={canManage ? (e) => {
              e.preventDefault();
              e.currentTarget.classList.add("drop-target-active");
            } : undefined}
            onDragLeave={canManage ? (e) => {
              e.currentTarget.classList.remove("drop-target-active");
            } : undefined}
            onDrop={canManage ? (e) => {
              e.currentTarget.classList.remove("drop-target-active");
              handleDropOnDate(iso);
            } : undefined}
            data-drop-date={iso}
          >
            <button
              type="button"
              className="week-column-header"
              onClick={() => setSelectedDate(iso)}
            >
              <span className="week-column-dow">{WEEKDAY_LABELS[idx]}</span>
              <span className={`week-column-num ${isToday ? "today" : ""}`}>
                {String(date.getDate()).padStart(2, "0")}
              </span>
            </button>

            <div className="week-column-body">
              {dayTasks.length === 0 ? (
                <div className="week-empty">—</div>
              ) : (
                dayTasks.map((task) => (
                  <TaskPill
                    key={task.id}
                    task={task}
                    canManage={canManage}
                    setDraggedTaskId={setDraggedTaskId}
                    handleDropOnDate={handleDropOnDate}
                    onEditTask={onEditTask}
                    clients={clients}
                    technicians={technicians}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Vista DÍA ───────────────────────────────────────────────
function DayView({ selectedDate, tasksByDate, onEditTask, clients, technicians, canManage, openNewTask }) {
  const dayTasks = useMemo(
    () =>
      (tasksByDate[selectedDate] || [])
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title, "es")),
    [tasksByDate, selectedDate]
  );

  return (
    <div className="day-view">
      <div className="day-view-summary">
        <span className="day-view-count">{dayTasks.length}</span>
        <span className="day-view-count-label">
          {dayTasks.length === 1 ? "intervención" : "intervenciones"}
        </span>
      </div>

      {dayTasks.length === 0 ? (
        <EmptyState
          icon="check"
          title="Día libre"
          description="No hay intervenciones programadas para este día."
          action={
            canManage && openNewTask
              ? { label: "+ Crear tarea", variant: "primary", onClick: openNewTask }
              : undefined
          }
        />
      ) : (
        <div className="day-view-list">
          {dayTasks.map((task) => (
            <button
              type="button"
              key={task.id}
              className="day-view-card"
              onClick={() => onEditTask(task)}
            >
              <div className="day-view-card-top">
                {task.startTime && (
                  <span className="day-view-card-time">{task.startTime}</span>
                )}
                <strong className="day-view-card-title">{task.title}</strong>
                <span className={`mini-status ${statusSlug(task.status)}`}>
                  {task.status}
                </span>
                <span className={`mini-priority ${getPriorityClass(task.priority)}`}>
                  {task.priority}
                </span>
              </div>

              <div className="day-view-card-grid">
                <div>
                  <div className="day-view-card-label">Cliente</div>
                  <div>{getClientName(task.clientId, clients) || "—"}</div>
                </div>
                <div>
                  <div className="day-view-card-label">Tipo</div>
                  <div>{TASK_TYPES[task.type]?.label || task.type || "—"}</div>
                </div>
                <div>
                  <div className="day-view-card-label">Técnicos</div>
                  <div>{peopleFromIds(task.technicianIds, technicians) || "—"}</div>
                </div>
                <div>
                  <div className="day-view-card-label">Tiempo</div>
                  <div>{task.estimatedTime || "—"}</div>
                </div>
                <div>
                  <div className="day-view-card-label">Vehículo</div>
                  <div>{task.vehicle || "—"}</div>
                </div>
                <div>
                  <div className="day-view-card-label">Adjuntos</div>
                  <div>{task.attachments?.length || 0}</div>
                </div>
              </div>

              {task.materials && (
                <div className="day-view-card-row">
                  <span className="day-view-card-label">Material: </span>
                  <span>{task.materials}</span>
                </div>
              )}

              {task.notes && (
                <div className="day-view-card-notes">{task.notes}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Vista TABLA ─────────────────────────────────────────────
//
// Tabla con multiselección. Al marcar 1+ filas, aparece una bulk-action
// bar sticky en la parte superior con acciones masivas:
//   - Cambiar estado / prioridad (selects directos, aplican al cambiar)
//   - Mover a fecha (input date inline)
//   - Eliminar (con confirm)
//   - Limpiar selección
//
// La selección se prunea automáticamente cuando los filtros cambian
// (un id que ya no aparece en filteredTasks deja de estar seleccionado),
// para evitar acciones sobre filas que el usuario no está viendo.
function TableView({
  filteredTasks, clients, technicians, onEditTask,
  canManage, hasActiveFilters, resetFilters, openNewTask,
  bulkUpdateTasks, bulkDeleteTasks,
}) {
  // Las filas se ordenan por fecha (asc) y memoizamos: sin esto, cada
  // re-render de App (socket, keystroke en search, etc.) re-sortea la
  // lista entera aunque nada haya cambiado.
  const sortedTasks = useMemo(
    () => filteredTasks.slice().sort((a, b) => a.date.localeCompare(b.date)),
    [filteredTasks]
  );

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [busy, setBusy] = useState(false);

  // Selección efectiva: ids seleccionados ∩ visibles bajo los filtros
  // actuales. Lo derivamos en render en lugar de sincronizar con un
  // useEffect (anti-pattern en React 19 + activa la regla
  // react-hooks/set-state-in-effect). Beneficio extra: si el usuario
  // cambia un filtro y luego lo revierte, las selecciones "ocultas"
  // reaparecen sin tener que re-clickarlas.
  const visibleSelectedIds = useMemo(() => {
    if (selectedIds.size === 0) return selectedIds;
    const visibleIds = new Set(sortedTasks.map((t) => t.id));
    const result = new Set();
    for (const id of selectedIds) if (visibleIds.has(id)) result.add(id);
    // Si todos los seleccionados siguen visibles, devolvemos la
    // referencia original — preserva la identidad para consumidores
    // que comparen por referencia.
    return result.size === selectedIds.size ? selectedIds : result;
  }, [selectedIds, sortedTasks]);

  function toggleOne(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else              next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (visibleSelectedIds.size === sortedTasks.length && sortedTasks.length > 0) {
      // "Todas visibles ya seleccionadas" → deseleccionamos sólo las visibles
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const t of sortedTasks) next.delete(t.id);
        return next;
      });
    } else {
      // Seleccionamos todas las visibles (preservando otras posibles
      // seleccionadas que estén fuera del filtro)
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const t of sortedTasks) next.add(t.id);
        return next;
      });
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  const selectedCount = visibleSelectedIds.size;
  const allSelected   = sortedTasks.length > 0 && selectedCount === sortedTasks.length;
  const someSelected  = selectedCount > 0 && !allSelected;

  // Wrapper común para las tres acciones de update masivo. `busy` gatea
  // doble-click durante el await — clearSelection sólo desmonta el bar
  // *después* de resolverse la red, así que el flag tiene su ventana.
  // Operamos sobre visibleSelectedIds (no selectedIds) para no afectar
  // a filas que el usuario no tiene a la vista bajo los filtros actuales.
  async function applyPartial(partial) {
    if (busy) return;
    setBusy(true);
    await bulkUpdateTasks(Array.from(visibleSelectedIds), partial);
    setBusy(false);
    clearSelection();
  }
  async function applyDelete() {
    if (busy) return;
    setBusy(true);
    await bulkDeleteTasks(Array.from(visibleSelectedIds));
    setBusy(false);
    clearSelection();
  }

  // CTA contextual: si hay filtros aplicados, lo lógico es ofrecer
  // limpiarlos. Si no hay tareas en absoluto, ofrecer crear una.
  const emptyAction = hasActiveFilters
    ? { label: "Limpiar filtros", variant: "primary", onClick: resetFilters }
    : (canManage && openNewTask
        ? { label: "+ Crear primera tarea", variant: "primary", onClick: openNewTask }
        : undefined);

  return (
    <>
      {/* Bulk-bar fuera del table-wrapper a propósito: si la tabla
          desborda horizontalmente (>= 960px), el bar se mantiene fijo
          en la franja visible en lugar de scrollear con la tabla. */}
      {selectedCount > 0 && canManage && (
        <BulkActionBar
          count={selectedCount}
          busy={busy}
          onApply={applyPartial}
          onDelete={applyDelete}
          onClear={clearSelection}
        />
      )}

      <div className="table-wrapper">
      {filteredTasks.length === 0 ? (
        <EmptyState
          icon={hasActiveFilters ? "search" : "inbox"}
          title={hasActiveFilters ? "Sin resultados" : "Aún no hay tareas"}
          description={
            hasActiveFilters
              ? "Ninguna tarea coincide con los filtros actuales. Prueba a cambiar o limpiar los filtros."
              : "Crea tu primera intervención para empezar a planificar el trabajo del equipo."
          }
          action={emptyAction}
        />
      ) : (
      <table className="tasks-table tasks-table--selectable">
        <thead>
          <tr>
            {canManage && (
              <th className="th-select">
                <RowCheckbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={toggleAll}
                  label={
                    someSelected
                      ? `${selectedCount} de ${sortedTasks.length} seleccionadas. Click para seleccionar todas.`
                      : allSelected
                      ? "Todas seleccionadas. Click para deseleccionar."
                      : "Seleccionar todas las filas visibles."
                  }
                />
              </th>
            )}
            <th>Título</th>
            <th>Cliente</th>
            <th>Teléfono</th>
            <th>Tipo</th>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Técnicos</th>
            <th>Estado</th>
            <th>Prioridad</th>
            <th>Tiempo estimado</th>
            <th>Vehículo</th>
            <th>Adjuntos</th>
          </tr>
        </thead>
        <tbody>
          {sortedTasks.map((task) => {
            const isSelected = selectedIds.has(task.id);
            return (
              <tr
                key={task.id}
                className={isSelected ? "is-selected" : ""}
                onClick={() => onEditTask(task)}
              >
                {canManage && (
                  <td
                    className="td-select"
                    onClick={(e) => {
                      // No queremos que un click en la celda del checkbox abra
                      // el modal de la fila — el checkbox tiene su propio toggle.
                      e.stopPropagation();
                    }}
                  >
                    <RowCheckbox
                      checked={isSelected}
                      onChange={() => toggleOne(task.id)}
                      label={`Seleccionar "${task.title}"`}
                    />
                  </td>
                )}
                <td>{task.title}</td>
                <td>{getClientName(task.clientId, clients)}</td>
                <td>{task.phone || "-"}</td>
                <td>{TASK_TYPES[task.type]?.label || task.type}</td>
                <td>{formatShortDate(task.date)}</td>
                <td>{task.startTime || "-"}</td>
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
            );
          })}
        </tbody>
      </table>
      )}
      </div>
    </>
  );
}

/**
 * Checkbox compartido para fila y header. Si se pasa `indeterminate`
 * = true, se aplica al DOM via ref (no es un atributo HTML — sólo
 * propiedad). Sin `indeterminate` se comporta como checkbox normal. */
function RowCheckbox({ checked, indeterminate, onChange, label }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);
  return (
    <label className="row-check" title={label}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-label={label}
      />
      <span className="row-check-box" aria-hidden="true" />
    </label>
  );
}

/**
 * Bulk action bar que aparece encima de la tabla cuando hay 1+ filas
 * seleccionadas. Selects directos para estado y prioridad, input date
 * para mover, botón rojo para eliminar y X para limpiar selección.
 * `onApply(partial)` recibe `{ status }`, `{ priority }` o `{ date }`. */
function BulkActionBar({ count, busy, onApply, onDelete, onClear }) {
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveDate, setMoveDate] = useState("");

  function handleApplyDate() {
    if (!moveDate) return;
    onApply({ date: moveDate });
    setMoveDate("");
    setMoveOpen(false);
  }

  return (
    <div className="bulk-bar" role="region" aria-label="Acciones masivas">
      <div className="bulk-bar-count">
        <span className="bulk-bar-count-num">{count}</span>
        <span className="bulk-bar-count-label">
          {count === 1 ? "seleccionada" : "seleccionadas"}
        </span>
      </div>

      <div className="bulk-bar-divider" aria-hidden="true" />

      <div className="bulk-bar-actions">
        <label className="bulk-bar-action">
          <span className="bulk-bar-action-label">Estado</span>
          <select
            className="bulk-bar-select"
            value=""
            disabled={busy}
            onChange={(e) => e.target.value && onApply({ status: e.target.value })}
          >
            <option value="" disabled>—</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <label className="bulk-bar-action">
          <span className="bulk-bar-action-label">Prioridad</span>
          <select
            className="bulk-bar-select"
            value=""
            disabled={busy}
            onChange={(e) => e.target.value && onApply({ priority: e.target.value })}
          >
            <option value="" disabled>—</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>

        <div className="bulk-bar-action bulk-bar-action-date">
          <span className="bulk-bar-action-label">Mover a</span>
          {moveOpen ? (
            <div className="bulk-bar-date-pop">
              <input
                type="date"
                value={moveDate}
                onChange={(e) => setMoveDate(e.target.value)}
                disabled={busy}
                autoFocus
              />
              <button
                type="button"
                className="bulk-bar-btn bulk-bar-btn-primary"
                onClick={handleApplyDate}
                disabled={busy || !moveDate}
              >
                Mover
              </button>
              <button
                type="button"
                className="bulk-bar-btn"
                onClick={() => { setMoveOpen(false); setMoveDate(""); }}
                disabled={busy}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="bulk-bar-btn"
              onClick={() => setMoveOpen(true)}
              disabled={busy}
            >
              Elegir fecha…
            </button>
          )}
        </div>

        <button
          type="button"
          className="bulk-bar-btn bulk-bar-btn-danger"
          onClick={onDelete}
          disabled={busy}
          aria-label={`Eliminar ${count} ${count === 1 ? "tarea" : "tareas"}`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
          Eliminar
        </button>
      </div>

      <button
        type="button"
        className="bulk-bar-clear"
        onClick={onClear}
        disabled={busy}
        aria-label="Limpiar selección"
        title="Limpiar selección (Esc)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
