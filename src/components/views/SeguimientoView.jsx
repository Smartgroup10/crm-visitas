import { toISO, todayISO, formatMonthYear, formatShortDate } from "../../utils/date";
import { getClientName, peopleFromIds } from "../../utils/id";
import { statusSlug, getStatusClass, getPriorityClass } from "../../utils/status";

export default function SeguimientoView({
  activeView,
  monthCells,
  currentMonth,
  tasksByDate,
  selectedDate,
  setSelectedDate,
  setDraggedTaskId,
  handleDropOnDate,
  goToday,
  changeMonth,
  filteredTasks,
  selectedTasks,
  clients,
  technicians,
  onEditTask,
}) {
  return (
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
                            onEditTask(task);
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
                      <tr key={task.id} onClick={() => onEditTask(task)}>
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
  );
}
