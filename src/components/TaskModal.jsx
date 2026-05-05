import { useEffect, useMemo, useState } from "react";

import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "../data/constants";
import {
  TASK_TYPES,
  TASK_TYPE_KEYS,
  COMMON_TASK_FIELDS,
  defaultsForType,
} from "../data/taskTypes";
import { validateTask } from "../utils/validation";
import { findTaskConflicts } from "../utils/task";
import { peopleFromIds } from "../utils/id";
import { hasAddress, formatAddress, getMapsUrl } from "../utils/address";
import { usePermissions } from "../hooks/usePermissions";
import { IconAlert } from "./Icon";
import ClientCombobox from "./ClientCombobox";
import TaskActivityTimeline from "./TaskActivityTimeline";
import TaskCommentsThread from "./TaskCommentsThread";
import { useTaskTemplates } from "../hooks/useTaskTemplates";

/**
 * Construye el objeto que se enviará al backend al guardar. Conservamos los
 * campos comunes editados en el formulario y rellenamos con defaults los
 * campos específicos del tipo (no se editan en la UI, pero mantenemos la
 * estructura en la BBDD para no romper datos ya guardados).
 */
function sanitizeForType(draft) {
  const out = {};
  for (const k of COMMON_TASK_FIELDS) {
    if (k in draft) out[k] = draft[k];
  }
  const typeDefaults = defaultsForType(draft.type);
  for (const [key, def] of Object.entries(typeDefaults)) {
    out[key] = key in draft ? draft[key] : def;
  }
  return out;
}

export default function TaskModal({
  open,
  draft,
  setDraft,
  onClose,
  onSave,
  onDelete,
  isEditing,
  clients,
  technicians,
  tasks,
  newClientName,
  setNewClientName,
  addClient,
  onOpenTemplates,
}) {
  // Sólo cargamos la lista de plantillas cuando estamos en modo
  // creación — al editar una tarea existente, no tiene sentido
  // sobrescribir sus campos con una plantilla. El hook se monta
  // condicionalmente vía short-circuit: si !shouldShowLoader, el
  // hook devuelve [] y no hace fetch.
  const shouldShowLoader = open && !isEditing;
  const { items: templates } = useTaskTemplates();

  /**
   * Aplica una plantilla al draft actual. Mergea sólo los campos
   * que la plantilla tiene rellenos — los que no, dejan al draft
   * intacto. Date / start_time / id / attachments NO se tocan
   * (son siempre per-instancia).
   */
  function applyTemplate(tplId) {
    if (!tplId) return;
    const tpl = templates.find((t) => t.id === tplId);
    if (!tpl) return;
    setDraft((prev) => ({
      ...prev,
      title:         tpl.title || prev.title,
      type:          tpl.type || prev.type,
      priority:      tpl.priority || prev.priority,
      status:        tpl.status || prev.status,
      estimatedTime: tpl.estimated_time || prev.estimatedTime,
      notes:         tpl.notes || prev.notes,
      materials:     tpl.materials || prev.materials,
      vehicle:       tpl.vehicle || prev.vehicle,
      phone:         tpl.phone || prev.phone,
      clientId:      tpl.client_id || prev.clientId,
      technicianIds: (tpl.technician_ids?.length ? tpl.technician_ids : prev.technicianIds) || [],
      // Campos específicos del tipo: expandimos al nivel raíz como
      // hace taskFromDb. Si el draft ya tenía valores propios, los
      // reescribimos (la plantilla manda).
      ...(tpl.type_fields || {}),
    }));
  }
  const [errors, setErrors] = useState({});
  const [showNewClient, setShowNewClient] = useState(false);
  const [busy, setBusy] = useState(false);
  const { canManage, canEditTask, canEditTaskField, isTecnico } = usePermissions();

  // Tres niveles de permiso sobre el draft:
  //   - readOnly        → ningún campo es editable (el usuario sólo mira)
  //   - techPartialEdit → técnico asignado: edita sólo el subset seguro
  //   - canManage       → admin/supervisor: edita cualquier campo
  // Cuando el draft es nuevo (sin id), canManage manda — sólo
  // admin/supervisor pueden crear tareas.
  const isNewTask = !draft?.id;
  const techPartialEdit =
    !canManage && !isNewTask && isTecnico && canEditTask(draft);
  const readOnly = !canManage && !techPartialEdit;
  const canEditField = (name) => {
    if (canManage) return true;
    if (techPartialEdit) return canEditTaskField(draft, name);
    return false;
  };

  // Detección de solapamiento: ¿hay otras tareas que comparten algún
  // técnico y caen en la misma franja horaria? El cálculo es barato
  // (filtro lineal con math simple) — recalculamos cuando cambian
  // fecha, hora, técnicos o duración estimada del draft.
  const conflicts = useMemo(
    () => findTaskConflicts(draft, tasks || []),
    [draft, tasks]
  );

  // Dirección rellena en el draft → el botón "Cómo llegar" puede
  // pintarse. La URL se compone solo si hay datos suficientes.
  const taskHasAddress = hasAddress(draft);
  const taskMapsUrl = taskHasAddress ? getMapsUrl(draft) : null;

  // Al cerrar el modal, plegamos el alta inline y reseteamos errores/busy.
  // Es un reset síncrono de estado local atado al ciclo de vida del modal,
  // no un efecto externo — por eso desactivamos set-state-in-effect.
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowNewClient(false);
      setErrors({});
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;

  function toggleTechnician(techId) {
    const exists = draft.technicianIds.includes(techId);
    if (exists) {
      setDraft({ ...draft, technicianIds: draft.technicianIds.filter((id) => id !== techId) });
    } else {
      setDraft({ ...draft, technicianIds: [...draft.technicianIds, techId] });
    }
  }

  function handleTypeChange(newType) {
    if (newType === draft.type) return;
    const oldFields = TASK_TYPES[draft.type]?.specificFields || [];
    const newDraft = { ...draft, type: newType };
    for (const f of oldFields) delete newDraft[f.name];
    Object.assign(newDraft, defaultsForType(newType));
    setDraft(newDraft);
    setErrors({});
  }

  async function handleAddClientInline() {
    if (!newClientName.trim()) return;
    await addClient();
    setShowNewClient(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    const sanitized = sanitizeForType(draft);
    const result = validateTask(sanitized);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await onSave(sanitized);
      // Si todo va bien, App cierra el modal; al cerrarse, el efecto
      // resetea busy. Por si acaso, lo dejamos explícito:
      setBusy(false);
    } catch (err) {
      setBusy(false);
      // Si el backend devolvió validación zod, pintamos errores por campo.
      // No mostramos toast aquí: App.jsx ya se encargó si era necesario.
      const fieldErrors = err?.fieldErrors;
      if (fieldErrors && Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
      }
    }
  }

  async function handleDeleteClick() {
    if (busy) return;
    setBusy(true);
    try {
      await onDelete();
      setBusy(false);
    } catch {
      setBusy(false);
    }
  }

  /**
   * Atajo "Marcar como finalizada": cambia status a Listo y guarda.
   * Útil para técnicos al cerrar la intervención sin tener que abrir
   * el dropdown de estado. Si hay errores de validación los muestra
   * igual que el guardado normal. */
  async function handleMarkAsDone() {
    if (busy) return;
    const updated = { ...draft, status: "Listo" };
    const sanitized = sanitizeForType(updated);
    const result = validateTask(sanitized);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    setDraft(updated);
    try {
      await onSave(sanitized);
      setBusy(false);
    } catch (err) {
      setBusy(false);
      const fieldErrors = err?.fieldErrors;
      if (fieldErrors && Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
      }
    }
  }

  const typeMeta = TASK_TYPES[draft.type] || TASK_TYPES[TASK_TYPE_KEYS[0]];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="task-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header: tipo como tag de color a la izquierda + título + cierre */}
        <div className="modal-header">
          <div className="modal-header-main">
            <span className={`task-type-tag task-type-${draft.type || "visita"}`}>
              {typeMeta?.label || "Tarea"}
            </span>
            <div>
              <h2>{isEditing ? (readOnly ? "Detalle de la tarea" : "Editar tarea") : "Nueva tarea"}</h2>
              <p>
                {readOnly
                  ? "Vista de solo lectura. Para cambios, contacta con un supervisor o administrador."
                  : techPartialEdit
                  ? "Esta tarea está asignada a ti. Puedes actualizar estado, notas, materiales, tiempo y adjuntos."
                  : "Rellena los datos de la intervención."}
              </p>
            </div>
          </div>
          <button className="icon-close" onClick={onClose} aria-label="Cerrar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form className="task-form" onSubmit={handleSubmit}>
          <fieldset
            disabled={readOnly}
            style={{ border: 0, padding: 0, margin: 0, display: "contents" }}
          >
            {/* ─── Información básica ─────────────── */}
            <div className="form-section">
              <div className="form-section-header">Información</div>
              <div className="form-section-grid">
                <div className="form-row full">
                  <label>Título</label>
                  <input
                    type="text"
                    className={errors.title ? "has-error" : ""}
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="Ej.: Instalación centralita"
                    disabled={!canEditField("title")}
                  />
                  {errors.title && <div className="field-error">{errors.title}</div>}
                </div>

                <div className="form-row">
                  <label>Tipo</label>
                  <select
                    className={errors.type ? "has-error" : ""}
                    value={draft.type}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    disabled={!canEditField("type")}
                  >
                    {TASK_TYPE_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {TASK_TYPES[key].label}
                      </option>
                    ))}
                  </select>
                  {errors.type && <div className="field-error">{errors.type}</div>}
                </div>

                <div className="form-row">
                  <label>Fecha</label>
                  <input
                    type="date"
                    className={errors.date ? "has-error" : ""}
                    value={draft.date}
                    onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                    disabled={!canEditField("date")}
                  />
                  {errors.date && <div className="field-error">{errors.date}</div>}
                </div>

                <div className="form-row">
                  <label>Hora de inicio</label>
                  {/*
                    Hora opcional ("" = sin hora). Si la tarea tiene fecha+hora,
                    el backend programa un email recordatorio según las
                    preferencias del técnico (notify_lead_minutes).
                  */}
                  <input
                    type="time"
                    className={errors.startTime ? "has-error" : ""}
                    value={draft.startTime || ""}
                    onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
                    step="300"
                    disabled={!canEditField("startTime")}
                  />
                  {errors.startTime && <div className="field-error">{errors.startTime}</div>}
                  <div className="time-presets">
                    {["09:00", "12:00", "16:00"].map((preset) => (
                      <button
                        type="button"
                        key={preset}
                        className={`chip ${draft.startTime === preset ? "chip-active" : ""}`}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            startTime: draft.startTime === preset ? "" : preset,
                          })
                        }
                        disabled={!canEditField("startTime")}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Cliente y equipo ─────────────── */}
            <div className="form-section">
              <div className="form-section-header">Cliente y equipo</div>
              <div className="form-section-grid">
                <div className="form-row full">
                  <label>Cliente</label>
                  <div className="client-field">
                    <ClientCombobox
                      id="task-client"
                      value={draft.clientId}
                      onChange={(id) => setDraft({ ...draft, clientId: id })}
                      clients={clients}
                      disabled={!canEditField("clientId")}
                      hasError={!!errors.clientId}
                    />
                    <button
                      type="button"
                      className="client-field-toggle"
                      onClick={() => setShowNewClient((v) => !v)}
                      aria-expanded={showNewClient}
                      title={showNewClient ? "Cancelar" : "Añadir nuevo cliente"}
                      disabled={!canEditField("clientId")}
                    >
                      {showNewClient ? "Cancelar" : "+ Nuevo"}
                    </button>
                  </div>
                  {errors.clientId && <div className="field-error">{errors.clientId}</div>}

                  {showNewClient && (
                    <div className="client-new-inline">
                      <input
                        type="text"
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        placeholder="Nombre del nuevo cliente"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddClientInline();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn-secondary small-btn"
                        onClick={handleAddClientInline}
                        disabled={!newClientName.trim()}
                      >
                        Añadir
                      </button>
                    </div>
                  )}
                </div>

                <div className="form-row full">
                  <label>Técnicos asignados</label>
                  <div className="chips-wrap">
                    {technicians.map((tech) => (
                      <button
                        type="button"
                        key={tech.id}
                        className={`chip ${draft.technicianIds.includes(tech.id) ? "chip-active" : ""}`}
                        onClick={() => toggleTechnician(tech.id)}
                        disabled={!canEditField("technicianIds")}
                      >
                        {tech.name}
                      </button>
                    ))}
                  </div>
                  {errors.technicianIds && <div className="field-error">{errors.technicianIds}</div>}
                </div>
              </div>

              {conflicts.length > 0 && (
                <TaskConflictWarning conflicts={conflicts} technicians={technicians} />
              )}
            </div>

            {/* ─── Ubicación ─────────────────────
                Dirección específica de esta tarea — vive en la propia
                tarea (no en el cliente) porque un cliente puede tener
                varias sedes/oficinas/restaurantes. El técnico que abre
                la tarea desde el móvil pulsa "Cómo llegar" y sale
                Maps con la ruta a la dirección exacta. */}
            <div className="form-section">
              <div className="form-section-header">
                Ubicación
                {taskMapsUrl && (
                  <a
                    className="task-location-cta"
                    href={taskMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Abrir ${formatAddress(draft)} en Maps`}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="2"
                         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                    Cómo llegar
                  </a>
                )}
              </div>
              <div className="form-section-grid">
                <div className="form-row full">
                  <label>Dirección</label>
                  <input
                    type="text"
                    value={draft.address || ""}
                    onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                    placeholder="Calle, número, piso, puerta…"
                    disabled={!canEditField("address")}
                  />
                </div>
                <div className="form-row">
                  <label>Código postal</label>
                  <input
                    type="text"
                    value={draft.postalCode || ""}
                    onChange={(e) => setDraft({ ...draft, postalCode: e.target.value })}
                    placeholder="28013"
                    disabled={!canEditField("postalCode")}
                  />
                </div>
                <div className="form-row">
                  <label>Ciudad</label>
                  <input
                    type="text"
                    value={draft.city || ""}
                    onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                    placeholder="Madrid"
                    disabled={!canEditField("city")}
                  />
                </div>
                <div className="form-row full">
                  <label>Notas de acceso</label>
                  <textarea
                    rows="2"
                    value={draft.locationNotes || ""}
                    onChange={(e) => setDraft({ ...draft, locationNotes: e.target.value })}
                    placeholder="Portero, código, parking, contacto en obra…"
                    disabled={!canEditField("locationNotes")}
                  />
                </div>
              </div>
            </div>

            {/* ─── Planificación ─────────────── */}
            <div className="form-section">
              <div className="form-section-header">Planificación</div>
              <div className="form-section-grid">
                <div className="form-row">
                  <label>Estado</label>
                  <select
                    value={draft.status}
                    onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                    disabled={!canEditField("status")}
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
                    disabled={!canEditField("priority")}
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
                    onChange={(e) => setDraft({ ...draft, estimatedTime: e.target.value })}
                    placeholder="Ej.: 2 horas"
                    disabled={!canEditField("estimatedTime")}
                  />
                </div>

                <div className="form-row full">
                  <label>Materiales</label>
                  <textarea
                    rows="2"
                    value={draft.materials || ""}
                    onChange={(e) => setDraft({ ...draft, materials: e.target.value })}
                    placeholder="Material utilizado, repuestos, etc."
                    disabled={!canEditField("materials")}
                  />
                </div>
              </div>
            </div>

            {/* ─── Notas ─────────────── */}
            <div className="form-section">
              <div className="form-section-header">Notas</div>
              <div className="form-section-grid">
                <div className="form-row full">
                  <label className="visually-hidden">Notas</label>
                  <textarea
                    rows="4"
                    value={draft.notes}
                    onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                    placeholder="Observaciones, incidencias, comprobaciones..."
                    disabled={!canEditField("notes")}
                  />
                </div>
              </div>
            </div>
          </fieldset>

          {/* Loader de plantillas — sólo al CREAR, no al editar.
              Si hay plantillas creadas y el usuario está empezando
              una tarea nueva, le ofrecemos cargar una con un click.
              También deja un acceso rápido a "Gestionar..." para
              crear/editar plantillas sin salir del flujo. */}
          {shouldShowLoader && (templates.length > 0 || onOpenTemplates) && (
            <div className="task-template-loader">
              <span className="task-template-loader-label">
                <span className="task-template-loader-label-icon" aria-hidden="true">📋</span>
                Cargar plantilla
              </span>
              {templates.length > 0 ? (
                <select
                  value=""
                  onChange={(e) => applyTemplate(e.target.value)}
                  aria-label="Seleccionar plantilla"
                >
                  <option value="">— Selecciona —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              ) : (
                <span style={{ flex: 1, color: "var(--text-soft)", fontSize: 12.5 }}>
                  No hay plantillas creadas todavía.
                </span>
              )}
              {onOpenTemplates && (
                <button
                  type="button"
                  className="task-template-loader-manage"
                  onClick={onOpenTemplates}
                >
                  Gestionar…
                </button>
              )}
            </div>
          )}

          {/* Comentarios + Timeline — sólo en edición (necesitamos un id
              para consultarlos). En "Nueva tarea" la tarea aún no
              existe, así que no hay nada que pintar. Comentarios va
              primero porque es un canal vivo (la gente escribe ahí);
              actividad va al final como referencia/auditoría. */}
          {isEditing && draft?.id && (
            <>
              <TaskCommentsThread taskId={draft.id} />
              <TaskActivityTimeline taskId={draft.id} />
            </>
          )}

          {/* Footer sticky con las acciones.
              - "Eliminar": solo admin/supervisor (canManage), tarea existente.
              - "Marcar como finalizada": cualquier usuario que pueda
                editar el campo `status` y la tarea no esté ya en Listo.
                Atajo de un click — pone status=Listo y guarda. */}
          <div className="form-actions">
            {canManage && isEditing && (
              <button
                type="button"
                className="btn-danger"
                onClick={handleDeleteClick}
                disabled={busy}
              >
                Eliminar
              </button>
            )}
            <div className="form-actions-spacer" />
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cerrar
            </button>
            {isEditing && draft.status !== "Listo" && canEditField("status") && (
              <button
                type="button"
                className="btn-finish"
                onClick={handleMarkAsDone}
                disabled={busy}
                title="Marca esta intervención como finalizada"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2.5"
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Marcar como finalizada
              </button>
            )}
            {!readOnly && (
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? (
                  <>
                    <span className="btn-spinner-inline" aria-hidden="true" />
                    Guardando…
                  </>
                ) : techPartialEdit ? (
                  "Guardar cambios"
                ) : (
                  "Guardar tarea"
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Aviso visible cuando el draft solapa con otras tareas existentes
 * que comparten algún técnico. No es bloqueante — el supervisor
 * puede seguir y guardar (a veces se solapa a propósito: una visita
 * corta + algo más, dos cosas en el mismo sitio…). Sólo informa.
 *
 * Lista compacta con hora + título + técnicos para que sea evidente
 * con quién y cuándo se está produciendo el cruce. */
function TaskConflictWarning({ conflicts, technicians }) {
  const visible = conflicts.slice(0, 5);
  const hidden = conflicts.length - visible.length;

  return (
    <div className="task-conflict" role="alert">
      <span className="task-conflict-icon" aria-hidden="true">
        <IconAlert />
      </span>
      <div className="task-conflict-body">
        <div className="task-conflict-headline">
          <strong>
            {conflicts.length === 1
              ? "Solapamiento de horario detectado"
              : `${conflicts.length} solapamientos de horario detectados`}
          </strong>
          <span className="task-conflict-sub">
            {conflicts.length === 1
              ? "Un técnico ya tiene otra tarea en esta franja. Puedes guardar igualmente."
              : "Algún técnico ya tiene otras tareas en esta franja. Puedes guardar igualmente."}
          </span>
        </div>
        <ul className="task-conflict-list">
          {visible.map((c) => (
            <li key={c.id} className="task-conflict-item">
              <span className="task-conflict-time">{c.startTime}</span>
              <span className="task-conflict-name" title={c.title || "Sin título"}>
                {c.title || "Sin título"}
              </span>
              <span className="task-conflict-techs">
                {peopleFromIds(c.technicianIds, technicians) || "—"}
              </span>
            </li>
          ))}
          {hidden > 0 && (
            <li className="task-conflict-more">+ {hidden} más</li>
          )}
        </ul>
      </div>
    </div>
  );
}
