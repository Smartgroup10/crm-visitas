import { TASK_TYPES } from "../../data/taskTypes";
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

function TaskPill({ task, canManage, setDraggedTaskId, onEditTask, clients, technicians, showTooltip = true }) {
  return (
    <div
      className={`task-pill ${getStatusClass(task.status)} ${getPriorityClass(task.priority)}`}
      data-type={task.type}
      draggable={canManage}
      onDragStart={canManage ? () => setDraggedTaskId(task.id) : undefined}
      onClick={(e) => {
        e.stopPropagation();
        onEditTask(task);
      }}
    >
      <div className="task-pill-content">
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
}) {
  const { activeView, calendarMode, setCalendarMode } = useUI();
  const { canManage } = usePermissions();

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
                description="Pulsa sobre otro día del calendario o crea una nueva tarea (N)."
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
              onDragOver={canManage ? (e) => e.preventDefault() : undefined}
              onDrop={canManage ? () => handleDropOnDate(iso) : undefined}
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
            onDragOver={canManage ? (e) => e.preventDefault() : undefined}
            onDrop={canManage ? () => handleDropOnDate(iso) : undefined}
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
function DayView({ selectedDate, tasksByDate, onEditTask, clients, technicians }) {
  const dayTasks = (tasksByDate[selectedDate] || [])
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title, "es"));

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
          description="No hay intervenciones programadas para este día. Pulsa N para crear una."
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
function TableView({ filteredTasks, clients, technicians, onEditTask }) {
  return (
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
                <tr key={task.id} onClick={() => onEditTask(task)}>
                  <td>{task.title}</td>
                  <td>{getClientName(task.clientId, clients)}</td>
                  <td>{task.phone || "-"}</td>
                  <td>{TASK_TYPES[task.type]?.label || task.type}</td>
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
  );
}
