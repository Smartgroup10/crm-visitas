import { useEffect, useState } from "react";

import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "../data/constants";
import {
  TASK_TYPES,
  TASK_TYPE_KEYS,
  COMMON_TASK_FIELDS,
  defaultsForType,
} from "../data/taskTypes";
import { validateTask } from "../utils/validation";
import { usePermissions } from "../hooks/usePermissions";

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
  newClientName,
  setNewClientName,
  addClient,
}) {
  const [errors, setErrors] = useState({});
  const [showNewClient, setShowNewClient] = useState(false);
  const { canManage } = usePermissions();
  const readOnly = !canManage;

  // Al cerrar el modal, plegamos el alta inline para que no quede abierto la
  // próxima vez que se abra.
  useEffect(() => {
    if (!open) {
      setShowNewClient(false);
      setErrors({});
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

  function handleSubmit(e) {
    e.preventDefault();
    const sanitized = sanitizeForType(draft);
    const result = validateTask(sanitized);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    onSave(sanitized);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="task-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{isEditing ? (readOnly ? "Detalle de la tarea" : "Editar tarea") : "Nueva tarea"}</h2>
            <p>
              {readOnly
                ? "Vista de solo lectura. Para cambios, contacta con un supervisor o administrador."
                : "Rellena los datos de la intervención."}
            </p>
          </div>
          <button className="icon-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form className="task-form" onSubmit={handleSubmit}>
          <fieldset
            disabled={readOnly}
            style={{ border: 0, padding: 0, margin: 0, display: "contents" }}
          >
            <div className="form-row full">
              <label>Título</label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Ej.: Instalación centralita"
              />
              {errors.title && <div className="field-error">{errors.title}</div>}
            </div>

            <div className="form-row">
              <label>Tipo</label>
              <select value={draft.type} onChange={(e) => handleTypeChange(e.target.value)}>
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
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </div>

            <div className="form-row full">
              <label>Cliente</label>
              <div className="client-field">
                <select
                  value={draft.clientId}
                  onChange={(e) => setDraft({ ...draft, clientId: e.target.value })}
                >
                  <option value="">Selecciona cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="client-field-toggle"
                  onClick={() => setShowNewClient((v) => !v)}
                  aria-expanded={showNewClient}
                  title={showNewClient ? "Cancelar" : "Añadir nuevo cliente"}
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
              <label>Técnicos</label>
              <div className="chips-wrap">
                {technicians.map((tech) => (
                  <button
                    type="button"
                    key={tech.id}
                    className={`chip ${draft.technicianIds.includes(tech.id) ? "chip-active" : ""}`}
                    onClick={() => toggleTechnician(tech.id)}
                  >
                    {tech.name}
                  </button>
                ))}
              </div>
              {errors.technicianIds && <div className="field-error">{errors.technicianIds}</div>}
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
                onChange={(e) => setDraft({ ...draft, estimatedTime: e.target.value })}
                placeholder="Ej.: 2 horas"
              />
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
          </fieldset>

          <div className="form-actions">
            {!readOnly && (
              <>
                <button type="submit" className="btn-primary">
                  Guardar tarea
                </button>
                {isEditing && (
                  <button type="button" className="btn-danger" onClick={onDelete}>
                    Eliminar
                  </button>
                )}
              </>
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
