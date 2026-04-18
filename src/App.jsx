import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "smartgroup_ops_v7";
const CLIENTS_STORAGE_KEY = "smartgroup_ops_clients_v3";
const UI_STORAGE_KEY = "smartgroup_ops_ui_v1";
const TECHNICIANS_STORAGE_KEY = "smartgroup_ops_technicians_v1";

const DEFAULT_CLIENTS = [
  { id: "c1", name: "Clínica Norte" },
  { id: "c2", name: "Coworking 4 Caminos" },
  { id: "c3", name: "Hotel Centro" },
  { id: "c4", name: "Asesoría Delta" },
  { id: "c5", name: "Oficinas Smartgroup" },
];

const DEFAULT_TECHNICIANS = [
  { id: "t1", name: "Carlos",   phone: "", specialty: "Telefonía" },
  { id: "t2", name: "Marta",    phone: "", specialty: "Redes" },
  { id: "t3", name: "Fernando", phone: "", specialty: "Instalaciones" },
  { id: "t4", name: "Laura",    phone: "", specialty: "Soporte" },
  { id: "t5", name: "Andrés",   phone: "", specialty: "Mantenimiento" },
  { id: "t6", name: "Luis",     phone: "", specialty: "Infraestructura" },
];

const STATUS_OPTIONS = ["No iniciado", "En curso", "Listo", "Bloqueado"];
const PRIORITY_OPTIONS = ["Baja", "Media", "Alta", "Urgente"];
const CATEGORY_OPTIONS = ["Visita", "Instalación", "Mantenimiento", "Incidencia"];

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayISO() {
  return toISO(new Date());
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

function formatMonthYear(date) {
  return new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatShortDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(`${dateStr}T00:00:00`);
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getCalendarGrid(baseDate) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const firstWeekDay = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - firstWeekDay);

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }
  return cells;
}

function peopleToText(people) {
  return Array.isArray(people) ? people.join(", ") : "";
}

function taskHaystack(task) {
  return [
    task.title,
    task.client,
    task.phone,
    peopleToText(task.people),
    task.category,
    task.notes,
    task.materials,
    task.estimatedTime,
    task.vehicle,
    ...(task.attachments || []).map((f) => f.name),
  ]
    .join(" ")
    .toLowerCase();
}

function statusSlug(status) {
  return status.toLowerCase().replaceAll(" ", "-");
}

function formatFileSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function emptyTask(date) {
  return {
    id: null,
    title: "",
    client: "",
    phone: "",
    category: "Visita",
    date,
    people: [],
    status: "No iniciado",
    priority: "Media",
    notes: "",
    materials: "",
    estimatedTime: "",
    vehicle: "",
    attachments: [],
  };
}

function normalizeTask(task) {
  return {
    ...task,
    people: Array.isArray(task.people)
      ? task.people
      : String(task.people || "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
    attachments: Array.isArray(task.attachments) ? task.attachments : [],
  };
}

function getStatusClass(status) {
  switch (status) {
    case "Listo":
      return "status-done";
    case "En curso":
      return "status-progress";
    case "Bloqueado":
      return "status-blocked";
    default:
      return "status-pending";
  }
}

function getPriorityClass(priority) {
  switch (priority) {
    case "Urgente":
      return "priority-urgent";
    case "Alta":
      return "priority-high";
    case "Media":
      return "priority-medium";
    default:
      return "priority-low";
  }
}

const initialTasks = [
  {
    id: crypto.randomUUID(),
    title: "Instalación centralita VoIP",
    client: "Clínica Norte",
    phone: "912345678",
    category: "Instalación",
    date: todayISO(),
    people: ["Carlos", "Marta"],
    status: "No iniciado",
    priority: "Urgente",
    notes: "Comprobar extensiones, desvíos y llamadas entrantes.",
    materials: "3 teléfonos IP, switch PoE, latiguillos",
    estimatedTime: "3 horas",
    vehicle: "Furgón 1",
    attachments: [
      {
        id: crypto.randomUUID(),
        name: "checklist_voip.pdf",
        size: 182340,
        type: "application/pdf",
      },
    ],
  },
  {
    id: crypto.randomUUID(),
    title: "Visita técnica de revisión",
    client: "Coworking 4 Caminos",
    phone: "911223344",
    category: "Visita",
    date: addDays(todayISO(), 1),
    people: ["Fernando"],
    status: "En curso",
    priority: "Alta",
    notes: "Analizar cableado y cobertura WiFi.",
    materials: "Tester de red, portátil",
    estimatedTime: "2 horas",
    vehicle: "Coche 2",
    attachments: [],
  },
  {
    id: crypto.randomUUID(),
    title: "Mantenimiento preventivo",
    client: "Hotel Centro",
    phone: "917778899",
    category: "Mantenimiento",
    date: addDays(todayISO(), 2),
    people: ["Laura", "Andrés"],
    status: "Listo",
    priority: "Media",
    notes: "Revisión general de red y telefonía.",
    materials: "Checklist mantenimiento",
    estimatedTime: "1,5 horas",
    vehicle: "Furgón 2",
    attachments: [],
  },
];

function TaskModal({
  open,
  draft,
  setDraft,
  onClose,
  onSave,
  onDelete,
  isEditing,
  clients,
  technicianNames,
  newClientName,
  setNewClientName,
  addClient,
}) {
  const fileInputRef = useRef(null);

  if (!open) return null;

  function toggleTechnician(name) {
    const exists = draft.people.includes(name);
    if (exists) {
      setDraft({ ...draft, people: draft.people.filter((p) => p !== name) });
    } else {
      setDraft({ ...draft, people: [...draft.people, name] });
    }
  }

  function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    const normalized = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type || "desconocido",
    }));

    setDraft({
      ...draft,
      attachments: [...draft.attachments, ...normalized],
    });

    e.target.value = "";
  }

  function removeAttachment(id) {
    setDraft({
      ...draft,
      attachments: draft.attachments.filter((file) => file.id !== id),
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="task-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{isEditing ? "Editar tarea" : "Nueva tarea"}</h2>
            <p>Gestiona la intervención con formato tipo panel.</p>
          </div>
          <button className="icon-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form className="task-form" onSubmit={onSave}>
          <div className="form-row full">
            <label>Título</label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Ej.: Instalación centralita"
            />
          </div>

          <div className="form-row">
            <label>Cliente</label>
            <select
              value={draft.client}
              onChange={(e) => setDraft({ ...draft, client: e.target.value })}
            >
              <option value="">Selecciona cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.name}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Nuevo cliente</label>
            <div className="inline-action">
              <input
                type="text"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Añadir cliente"
              />
              <button type="button" className="btn-secondary" onClick={addClient}>
                Añadir
              </button>
            </div>
          </div>

          <div className="form-row">
            <label>Teléfono cliente</label>
            <input
              type="text"
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              placeholder="Ej.: 912345678"
            />
          </div>

          <div className="form-row">
            <label>Tipo de trabajo</label>
            <select
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Fecha</label>
            <input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            />
          </div>

          <div className="form-row full">
            <label>Técnicos</label>
            <div className="chips-wrap">
              {technicianNames.map((tech) => (
                <button
                  type="button"
                  key={tech}
                  className={`chip ${draft.people.includes(tech) ? "chip-active" : ""}`}
                  onClick={() => toggleTechnician(tech)}
                >
                  {tech}
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <label>Estado</label>
            <select
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value })}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Prioridad</label>
            <select
              value={draft.priority}
              onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Tiempo estimado</label>
            <input
              type="text"
              value={draft.estimatedTime}
              onChange={(e) =>
                setDraft({ ...draft, estimatedTime: e.target.value })
              }
              placeholder="Ej.: 2 horas"
            />
          </div>

          <div className="form-row">
            <label>Vehículo asignado</label>
            <input
              type="text"
              value={draft.vehicle}
              onChange={(e) => setDraft({ ...draft, vehicle: e.target.value })}
              placeholder="Ej.: Furgón 1"
            />
          </div>

          <div className="form-row full">
            <label>Material necesario</label>
            <input
              type="text"
              value={draft.materials}
              onChange={(e) => setDraft({ ...draft, materials: e.target.value })}
              placeholder="Ej.: teléfonos IP, switch, tester..."
            />
          </div>

          <div className="form-row full">
            <label>Adjuntos</label>
            <div className="attachments-box">
              <div className="attachments-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Seleccionar archivos
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden-input"
                  onChange={handleFilesSelected}
                />
              </div>

              {draft.attachments.length === 0 ? (
                <div className="attachments-empty">No hay adjuntos.</div>
              ) : (
                <div className="attachments-list">
                  {draft.attachments.map((file) => (
                    <div key={file.id} className="attachment-item">
                      <div>
                        <div className="attachment-name">{file.name}</div>
                        <div className="attachment-meta">
                          {formatFileSize(file.size)} · {file.type}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-danger small-btn"
                        onClick={() => removeAttachment(file.id)}
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="form-row full">
            <label>Notas</label>
            <textarea
              rows="4"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="Observaciones, incidencias, comprobaciones..."
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary">
              Guardar tarea
            </button>
            {isEditing && (
              <button type="button" className="btn-danger" onClick={onDelete}>
                Eliminar
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ClientsView({ clients, setClients, tasks }) {
  const [newClient, setNewClient] = useState("");
  const [editingClientId, setEditingClientId] = useState(null);
  const [editingValue, setEditingValue] = useState("");

  function addClient() {
    const value = newClient.trim();
    if (!value) return;
    if (clients.some((c) => c.name === value)) return;
    setClients((prev) =>
      [...prev, { id: crypto.randomUUID(), name: value }].sort((a, b) =>
        a.name.localeCompare(b.name, "es")
      )
    );
    setNewClient("");
  }

  function startEdit(client) {
    setEditingClientId(client.id);
    setEditingValue(client.name);
  }

  function saveEdit() {
    const value = editingValue.trim();
    if (!value) return;
    if (clients.some((c) => c.name === value && c.id !== editingClientId)) return;

    setClients((prev) =>
      prev
        .map((c) => (c.id === editingClientId ? { ...c, name: value } : c))
        .sort((a, b) => a.name.localeCompare(b.name, "es"))
    );

    setEditingClientId(null);
    setEditingValue("");
  }

  function deleteClient(client) {
    const isUsed = tasks.some((task) => task.client === client.name);
    if (isUsed) {
      alert("No puedes borrar este cliente porque está asignado a una o más tareas.");
      return;
    }
    setClients((prev) => prev.filter((c) => c.id !== client.id));
  }

  return (
    <div className="clients-view">
      <div className="clients-header">
        <div>
          <h2>Clientes</h2>
          <p>Gestiona el listado de clientes disponibles para asignar a tareas.</p>
        </div>
      </div>

      <div className="clients-create-card">
        <div className="inline-action">
          <input
            type="text"
            value={newClient}
            onChange={(e) => setNewClient(e.target.value)}
            placeholder="Nombre del cliente"
          />
          <button className="btn-primary" onClick={addClient}>
            Crear cliente
          </button>
        </div>
      </div>

      <div className="clients-list-card">
        {clients.length === 0 ? (
          <div className="empty-state">No hay clientes creados.</div>
        ) : (
          <div className="clients-list">
            {clients.map((client) => {
              const usageCount = tasks.filter((task) => task.client === client.name).length;
              const isEditing = editingClientId === client.id;

              return (
                <div key={client.id} className="client-row">
                  <div className="client-main">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                      />
                    ) : (
                      <div>
                        <div className="client-name">{client.name}</div>
                        <div className="client-meta">
                          Tareas asociadas: {usageCount}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="client-actions">
                    {isEditing ? (
                      <>
                        <button className="btn-primary small-btn" onClick={saveEdit}>
                          Guardar
                        </button>
                        <button
                          className="btn-secondary small-btn"
                          onClick={() => {
                            setEditingClientId(null);
                            setEditingValue("");
                          }}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn-secondary small-btn"
                          onClick={() => startEdit(client)}
                        >
                          Editar
                        </button>
                        <button
                          className="btn-danger small-btn"
                          onClick={() => deleteClient(client)}
                        >
                          Borrar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const TECH_AVATAR_COLORS = ["#0073ea","#e2445c","#00c875","#fdab3d","#a358d0","#037f4c","#0086c0","#d83a52"];

function InicioView({ tasks, technicians, onEditTask }) {
  const today = todayISO();
  const tomorrow = addDays(today, 1);
  const in7 = addDays(today, 7);

  const kpiPending  = tasks.filter((t) => t.status === "No iniciado");
  const kpiProgress = tasks.filter((t) => t.status === "En curso");
  const kpiBlocked  = tasks.filter((t) => t.status === "Bloqueado");
  const kpiToday    = tasks.filter((t) => t.date === today);
  const kpiDoneRate = tasks.length
    ? Math.round((tasks.filter((t) => t.status === "Listo").length / tasks.length) * 100)
    : 0;

  const urgentOrBlocked = tasks
    .filter((t) => t.status === "Bloqueado" || (t.priority === "Urgente" && t.status !== "Listo"))
    .sort((a, b) => {
      if (a.status === "Bloqueado" && b.status !== "Bloqueado") return -1;
      if (b.status === "Bloqueado" && a.status !== "Bloqueado") return 1;
      return a.date.localeCompare(b.date);
    })
    .slice(0, 8);

  const todayAndTomorrow = tasks
    .filter((t) => t.date === today || t.date === tomorrow)
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "es"));

  const next7 = tasks
    .filter((t) => t.date > tomorrow && t.date <= in7)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  const techLoad = technicians.map((tech) => {
    const tt = tasks.filter((t) => t.people.includes(tech.name));
    return {
      ...tech,
      active:  tt.filter((t) => t.status === "En curso").length,
      total:   tt.length,
    };
  }).sort((a, b) => b.active - a.active || b.total - a.total);

  const maxLoad = Math.max(...techLoad.map((t) => t.total), 1);

  return (
    <div className="inicio-view">
      <div className="inicio-header">
        <h2>Inicio</h2>
        <p>Resumen operativo · {formatShortDate(today)}</p>
      </div>

      <div className="kpi-row">
        <div className="kpi-card kpi-pending">
          <span className="kpi-num">{kpiPending.length}</span>
          <span className="kpi-label">Pendientes</span>
        </div>
        <div className="kpi-card kpi-progress">
          <span className="kpi-num">{kpiProgress.length}</span>
          <span className="kpi-label">En curso</span>
        </div>
        <div className="kpi-card kpi-blocked">
          <span className="kpi-num">{kpiBlocked.length}</span>
          <span className="kpi-label">Bloqueadas</span>
        </div>
        <div className="kpi-card kpi-today">
          <span className="kpi-num">{kpiToday.length}</span>
          <span className="kpi-label">Hoy</span>
        </div>
        <div className="kpi-card kpi-rate">
          <span className="kpi-num">{kpiDoneRate}%</span>
          <span className="kpi-label">Completadas</span>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="panel-block">
          <div className="panel-block-header">
            <h2>Urgente / Bloqueado</h2>
            <span>{urgentOrBlocked.length}</span>
          </div>
          {urgentOrBlocked.length === 0 ? (
            <div className="empty-state">Sin tareas urgentes ni bloqueadas.</div>
          ) : (
            <div className="day-task-list">
              {urgentOrBlocked.map((task) => (
                <button key={task.id} className="day-task-card" onClick={() => onEditTask(task)}>
                  <div className="day-task-top">
                    <strong>{task.title}</strong>
                    <span className={`mini-status ${statusSlug(task.status)}`}>{task.status}</span>
                  </div>
                  <div className="day-task-meta">{task.client} · {formatShortDate(task.date)}</div>
                  <div className="day-task-meta">
                    <span className={`mini-priority ${getPriorityClass(task.priority)}`}>{task.priority}</span>
                    {" "}{peopleToText(task.people)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="panel-block">
          <div className="panel-block-header">
            <h2>Hoy y mañana</h2>
            <span>{todayAndTomorrow.length}</span>
          </div>
          {todayAndTomorrow.length === 0 ? (
            <div className="empty-state">No hay tareas para hoy ni mañana.</div>
          ) : (
            <div className="day-task-list">
              {todayAndTomorrow.map((task) => (
                <button key={task.id} className="day-task-card" onClick={() => onEditTask(task)}>
                  <div className="day-task-top">
                    <strong>{task.title}</strong>
                    <span className={`mini-status ${statusSlug(task.status)}`}>{task.status}</span>
                  </div>
                  <div className="day-task-meta">
                    {task.date === today ? "Hoy" : "Mañana"} · {task.client}
                  </div>
                  <div className="day-task-meta">{task.category} · {peopleToText(task.people)}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="panel-block">
          <div className="panel-block-header">
            <h2>Carga por técnico</h2>
            <span>{technicians.length} técnicos</span>
          </div>
          <div className="tech-load-list">
            {techLoad.map((tech, i) => (
              <div key={tech.id} className="tech-load-row">
                <div className="tech-avatar tech-avatar-sm" style={{ background: TECH_AVATAR_COLORS[i % TECH_AVATAR_COLORS.length] }}>
                  {tech.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="tech-load-name">{tech.name}</div>
                <div className="tech-load-bar-wrap">
                  <div className="tech-load-bar" style={{ width: `${Math.min((tech.total / maxLoad) * 100, 100)}%` }} />
                </div>
                <div className="tech-load-nums">
                  <span style={{ color: "var(--c-progress)" }}>{tech.active}</span>
                  {" / "}
                  <span style={{ color: "var(--text-soft)" }}>{tech.total}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel-block">
          <div className="panel-block-header">
            <h2>Próximos 7 días</h2>
            <span>{next7.length} tareas</span>
          </div>
          {next7.length === 0 ? (
            <div className="empty-state">No hay tareas planificadas esta semana.</div>
          ) : (
            <div className="day-task-list">
              {next7.map((task) => (
                <button key={task.id} className="day-task-card" onClick={() => onEditTask(task)}>
                  <div className="day-task-top">
                    <strong>{task.title}</strong>
                    <span className={`mini-priority ${getPriorityClass(task.priority)}`}>{task.priority}</span>
                  </div>
                  <div className="day-task-meta">{formatShortDate(task.date)} · {task.client}</div>
                  <div className="day-task-meta">{task.category} · {peopleToText(task.people)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MiTrabajoView({ tasks, onEditTask }) {
  const today = todayISO();

  const requiresAction = tasks
    .filter((t) => t.status === "Bloqueado" || (t.priority === "Urgente" && t.status === "No iniciado"))
    .sort((a, b) => {
      if (a.status === "Bloqueado" && b.status !== "Bloqueado") return -1;
      if (b.status === "Bloqueado" && a.status !== "Bloqueado") return 1;
      return a.date.localeCompare(b.date);
    });

  const agendaHoy = tasks
    .filter((t) => t.date === today)
    .sort((a, b) => a.category.localeCompare(b.category, "es") || a.title.localeCompare(b.title, "es"));

  const vehiclesOut = [...new Set(agendaHoy.map((t) => t.vehicle).filter(Boolean))];

  const incomplete = tasks
    .filter((t) => t.people.length === 0 || !t.date)
    .sort((a, b) => {
      if (!a.date && b.date) return 1;
      if (a.date && !b.date) return -1;
      return a.date.localeCompare(b.date);
    });

  return (
    <div className="mitrabajo-view">
      <div className="mitrabajo-header">
        <h2>Mi trabajo</h2>
        <p>Vista de gestión · {formatShortDate(today)}</p>
      </div>

      {requiresAction.length > 0 && (
        <div className="mt-alert-banner">
          <span className="mt-alert-icon">⚠</span>
          <span>
            {requiresAction.length} {requiresAction.length === 1 ? "tarea requiere" : "tareas requieren"} atención inmediata
          </span>
        </div>
      )}

      <div className="dashboard-grid">
        <div className="panel-block">
          <div className="panel-block-header">
            <h2>Requieren acción</h2>
            <span>{requiresAction.length}</span>
          </div>
          {requiresAction.length === 0 ? (
            <div className="empty-state">Sin elementos que requieran atención inmediata.</div>
          ) : (
            <div className="day-task-list">
              {requiresAction.map((task) => (
                <button key={task.id} className="day-task-card" onClick={() => onEditTask(task)}>
                  <div className="day-task-top">
                    <strong>{task.title}</strong>
                    <span className={`mini-status ${statusSlug(task.status)}`}>{task.status}</span>
                  </div>
                  <div className="day-task-meta">{task.client} · {formatShortDate(task.date)}</div>
                  <div className="day-task-meta">
                    <span className={`mini-priority ${getPriorityClass(task.priority)}`}>{task.priority}</span>
                    {" "}{peopleToText(task.people) || <em>Sin técnico</em>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="panel-block">
          <div className="panel-block-header">
            <h2>Agenda de hoy</h2>
            <span>{agendaHoy.length} intervenciones</span>
          </div>
          {vehiclesOut.length > 0 && (
            <div className="mt-vehicles-row">
              <span className="mt-vehicles-label">Vehículos: </span>
              {vehiclesOut.map((v) => (
                <span key={v} className="mt-vehicle-chip">{v}</span>
              ))}
            </div>
          )}
          {agendaHoy.length === 0 ? (
            <div className="empty-state">No hay intervenciones programadas para hoy.</div>
          ) : (
            <div className="day-task-list">
              {agendaHoy.map((task) => (
                <button key={task.id} className="day-task-card" onClick={() => onEditTask(task)}>
                  <div className="day-task-top">
                    <strong>{task.title}</strong>
                    <span className={`mini-status ${statusSlug(task.status)}`}>{task.status}</span>
                  </div>
                  <div className="day-task-meta">{task.category} · {task.client}</div>
                  <div className="day-task-meta">
                    {peopleToText(task.people)}{task.vehicle ? ` · ${task.vehicle}` : ""}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="panel-block dashboard-full">
          <div className="panel-block-header">
            <h2>Tareas incompletas</h2>
            <span>{incomplete.length} sin técnico o sin fecha</span>
          </div>
          {incomplete.length === 0 ? (
            <div className="empty-state">Todas las tareas tienen técnico y fecha asignados.</div>
          ) : (
            <div className="incomplete-grid">
              {incomplete.map((task) => (
                <button key={task.id} className="day-task-card" onClick={() => onEditTask(task)}>
                  <div className="day-task-top">
                    <strong>{task.title}</strong>
                    <span className={`mini-priority ${getPriorityClass(task.priority)}`}>{task.priority}</span>
                  </div>
                  <div className="day-task-meta">
                    {task.client || "—"} · {task.date ? formatShortDate(task.date) : "Sin fecha"}
                  </div>
                  <div className="day-task-meta" style={{ color: "var(--c-blocked)" }}>
                    {task.people.length === 0 ? "⚠ Sin técnico asignado" : ""}
                    {!task.date ? "⚠ Sin fecha" : ""}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TechniciansView({ technicians, setTechnicians, tasks }) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");

  function addTechnician() {
    const name = newName.trim();
    if (!name) return;
    if (technicians.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      alert(`El técnico "${name}" ya existe.`);
      return;
    }
    setTechnicians((prev) =>
      [...prev, { id: crypto.randomUUID(), name, phone: "", specialty: "" }]
        .sort((a, b) => a.name.localeCompare(b.name, "es"))
    );
    setNewName("");
  }

  function startEdit(tech) {
    setEditingId(tech.id);
    setEditName(tech.name);
  }

  function saveEdit() {
    const name = editName.trim();
    if (!name) return;
    setTechnicians((prev) =>
      prev
        .map((t) => t.id === editingId ? { ...t, name } : t)
        .sort((a, b) => a.name.localeCompare(b.name, "es"))
    );
    setEditingId(null);
  }

  function deleteTechnician(tech) {
    if (tasks.some((task) => task.people.includes(tech.name))) {
      alert("No puedes borrar este técnico porque está asignado a una o más tareas.");
      return;
    }
    setTechnicians((prev) => prev.filter((t) => t.id !== tech.id));
  }

  function getTechStats(name) {
    const tt = tasks.filter((t) => t.people.includes(name));
    return {
      total: tt.length,
      progress: tt.filter((t) => t.status === "En curso").length,
      done: tt.filter((t) => t.status === "Listo").length,
    };
  }

  return (
    <div className="technicians-view">
      <div className="tech-header">
        <h2>Técnicos</h2>
        <p>Gestiona el equipo técnico y su carga de trabajo.</p>
      </div>

      <div className="tech-create-card">
        <div className="tech-create-form">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTechnician()}
            placeholder="Nombre del técnico"
            autoFocus
          />
          <button
            type="button"
            className="btn-primary"
            onClick={addTechnician}
            disabled={!newName.trim()}
          >
            Añadir técnico
          </button>
        </div>
      </div>

      {technicians.length === 0 ? (
        <div className="empty-state">No hay técnicos registrados.</div>
      ) : (
        <div className="tech-grid">
          {technicians.map((tech, i) => {
            const stats = getTechStats(tech.name);
            const color = TECH_AVATAR_COLORS[i % TECH_AVATAR_COLORS.length];
            const isEditing = editingId === tech.id;

            return (
              <div key={tech.id} className="tech-card">
                <div className="tech-card-top">
                  <div className="tech-avatar" style={{ background: color }}>
                    {tech.name.slice(0, 2).toUpperCase()}
                  </div>
                  {isEditing ? (
                    <div className="tech-edit-fields">
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nombre" onKeyDown={(e) => e.key === "Enter" && saveEdit()} />
                    </div>
                  ) : (
                    <div className="tech-info">
                      <div className="tech-name">{tech.name}</div>
                    </div>
                  )}
                </div>

                <div className="tech-stats">
                  <div className="tech-stat">
                    <span className="tech-stat-num">{stats.total}</span>
                    <span className="tech-stat-label">Tareas</span>
                  </div>
                  <div className="tech-stat">
                    <span className="tech-stat-num" style={{ color: "var(--c-progress)" }}>{stats.progress}</span>
                    <span className="tech-stat-label">En curso</span>
                  </div>
                  <div className="tech-stat">
                    <span className="tech-stat-num" style={{ color: "var(--c-done)" }}>{stats.done}</span>
                    <span className="tech-stat-label">Listas</span>
                  </div>
                </div>

                <div className="tech-card-actions">
                  {isEditing ? (
                    <>
                      <button className="btn-primary small-btn" onClick={saveEdit}>Guardar</button>
                      <button className="btn-secondary small-btn" onClick={() => setEditingId(null)}>Cancelar</button>
                    </>
                  ) : (
                    <>
                      <button className="btn-secondary small-btn" onClick={() => startEdit(tech)}>Editar</button>
                      <button className="btn-danger small-btn" onClick={() => deleteTechnician(tech)}>Borrar</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const savedUi = useMemo(() => {
    try {
      const raw = localStorage.getItem(UI_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const [section, setSection] = useState("inicio");

  const [clients, setClients] = useState(() => {
    const saved = localStorage.getItem(CLIENTS_STORAGE_KEY);
    if (!saved) return DEFAULT_CLIENTS;
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_CLIENTS;
      return parsed.map((c) =>
        typeof c === "string" ? { id: crypto.randomUUID(), name: c } : c
      );
    } catch {
      return DEFAULT_CLIENTS;
    }
  });

  const [technicians, setTechnicians] = useState(() => {
    const saved = localStorage.getItem(TECHNICIANS_STORAGE_KEY);
    if (!saved) return DEFAULT_TECHNICIANS;
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_TECHNICIANS;
    } catch {
      return DEFAULT_TECHNICIANS;
    }
  });

  const technicianNames = useMemo(() => technicians.map((t) => t.name), [technicians]);

  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return initialTasks;
    try {
      const parsed = JSON.parse(saved).map(normalizeTask);
      return Array.isArray(parsed) && parsed.length ? parsed : initialTasks;
    } catch {
      return initialTasks;
    }
  });

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [activeView, setActiveView] = useState(savedUi?.activeView || "Calendario");
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [draft, setDraft] = useState(emptyTask(todayISO()));
  const [search, setSearch] = useState(savedUi?.search || "");
  const [personFilter, setPersonFilter] = useState(savedUi?.personFilter || "Todos");
  const [statusFilter, setStatusFilter] = useState(savedUi?.statusFilter || "Todos");
  const [priorityFilter, setPriorityFilter] = useState(savedUi?.priorityFilter || "Todas");
  const [categoryFilter, setCategoryFilter] = useState(savedUi?.categoryFilter || "Todas");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [newClientName, setNewClientName] = useState("");

  const [counterModalOpen, setCounterModalOpen] = useState(false);
  const [counterFilter, setCounterFilter] = useState("Total");
  const [counterSearch, setCounterSearch] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem(TECHNICIANS_STORAGE_KEY, JSON.stringify(technicians));
  }, [technicians]);

  useEffect(() => {
    localStorage.setItem(
      UI_STORAGE_KEY,
      JSON.stringify({
        activeView,
        search,
        personFilter,
        statusFilter,
        priorityFilter,
        categoryFilter,
      })
    );
  }, [activeView, search, personFilter, statusFilter, priorityFilter, categoryFilter]);

  const monthCells = useMemo(() => getCalendarGrid(currentMonth), [currentMonth]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch = taskHaystack(task).includes(search.toLowerCase());
      const matchesPerson =
        personFilter === "Todos" || task.people.includes(personFilter);
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
  }, [tasks, search, personFilter, statusFilter, priorityFilter, categoryFilter]);

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

    return filtered.filter((task) => taskHaystack(task).includes(searchText));
  }, [tasks, counterFilter, counterSearch]);

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
    if (clients.some((c) => c.name === name)) {
      setDraft({ ...draft, client: name });
      setNewClientName("");
      return;
    }
    setClients((prev) =>
      [...prev, { id: crypto.randomUUID(), name }].sort((a, b) =>
        a.name.localeCompare(b.name, "es")
      )
    );
    setDraft({ ...draft, client: name });
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

    if (!draft.client.trim()) {
      alert("El cliente es obligatorio.");
      return;
    }

    if (!draft.people.length) {
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

  useEffect(() => {
    function onKeyDown(e) {
      const tag = e.target?.tagName;
      const isTypingTarget =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target?.isContentEditable;

      if (e.key === "Escape" && (isModalOpen || counterModalOpen)) {
        setIsModalOpen(false);
        setCounterModalOpen(false);
        return;
      }

      if (isTypingTarget) return;

      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        openNewTask();
      }

      if (e.key === "/") {
        e.preventDefault();
        const searchEl = document.querySelector(".search-input");
        if (searchEl) searchEl.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isModalOpen, counterModalOpen]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-badge">S</div>
          <div>
            <div className="brand-title">SMARTGROUP</div>
            <div className="brand-subtitle">Operaciones</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Principal</div>
          <button
            className={`nav-item ${section === "inicio" ? "active" : ""}`}
            onClick={() => setSection("inicio")}
          >
            <span className="nav-icon">🏠</span>
            <span className="nav-label">Inicio</span>
          </button>
          <button
            className={`nav-item ${section === "mitrabajo" ? "active" : ""}`}
            onClick={() => setSection("mitrabajo")}
          >
            <span className="nav-icon">✔</span>
            <span className="nav-label">Mi trabajo</span>
          </button>

          <div className="nav-section-label">Operaciones</div>
          <button
            className={`nav-item ${section === "instalaciones" ? "active" : ""}`}
            onClick={() => setSection("instalaciones")}
          >
            <span className="nav-icon">📋</span>
            <span className="nav-label">Seguimiento</span>
          </button>
          <button
            className={`nav-item ${section === "clientes" ? "active" : ""}`}
            onClick={() => setSection("clientes")}
          >
            <span className="nav-icon">👥</span>
            <span className="nav-label">Clientes</span>
          </button>
          <button
            className={`nav-item ${section === "tecnicos" ? "active" : ""}`}
            onClick={() => setSection("tecnicos")}
          >
            <span className="nav-icon">🔧</span>
            <span className="nav-label">Técnicos</span>
          </button>

          <div className="nav-section-label">Análisis</div>
          <button className="nav-item nav-soon">
            <span className="nav-icon">📊</span>
            <span className="nav-label">Informes</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">JV</div>
            <div className="user-info">
              <div className="user-name">Jaime Vallejo</div>
              <div className="user-role">Administrador</div>
            </div>
          </div>
        </div>
      </aside>

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
                  {technicianNames.map((person) => (
                    <option key={person} value={person}>{person}</option>
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
                                    editTask(task);
                                  }}
                                >
                                  <div className="task-pill-content">
                                    <span className="task-pill-text">
                                      {task.title}
                                    </span>
                                  </div>

                                  <div className="task-tooltip">
                                    <div><strong>{task.title}</strong></div>
                                    <div><strong>Cliente:</strong> {task.client || "-"}</div>
                                    <div><strong>Tipo:</strong> {task.category}</div>
                                    <div><strong>Técnicos:</strong> {peopleToText(task.people) || "-"}</div>
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
                              <tr key={task.id} onClick={() => editTask(task)}>
                                <td>{task.title}</td>
                                <td>{task.client}</td>
                                <td>{task.phone || "-"}</td>
                                <td>{task.category}</td>
                                <td>{formatShortDate(task.date)}</td>
                                <td>{peopleToText(task.people)}</td>
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
                          onClick={() => editTask(task)}
                        >
                          <div className="day-task-top">
                            <strong>{task.title}</strong>
                            <span className={`mini-status ${statusSlug(task.status)}`}>
                              {task.status}
                            </span>
                          </div>
                          <div className="day-task-meta">{task.client}</div>
                          <div className="day-task-meta">{peopleToText(task.people)}</div>
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
          ) : section === "tecnicos" ? (
            <section className="main-panel clients-main-panel full-width-panel">
              <TechniciansView technicians={technicians} setTechnicians={setTechnicians} tasks={tasks} />
            </section>
          ) : section === "inicio" ? (
            <section className="main-panel clients-main-panel full-width-panel">
              <InicioView tasks={tasks} technicians={technicians} onEditTask={editTask} />
            </section>
          ) : section === "mitrabajo" ? (
            <section className="main-panel clients-main-panel full-width-panel">
              <MiTrabajoView tasks={tasks} onEditTask={editTask} />
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
        technicianNames={technicianNames}
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
                            <span
                              className={`mini-status ${task.status
                                .toLowerCase()
                                .replaceAll(" ", "-")}`}
                            >
                              {task.status}
                            </span>
                          </div>

                          <div className="counter-task-meta">
                            <strong>Cliente:</strong> {task.client || "-"}
                          </div>
                          <div className="counter-task-meta">
                            <strong>Técnicos:</strong> {peopleToText(task.people) || "-"}
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