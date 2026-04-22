import { useRef, useState } from "react";
import { generateId } from "../utils/id";

import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "../data/constants";
import {
  TASK_TYPES,
  TASK_TYPE_KEYS,
  COMMON_TASK_FIELDS,
  defaultsForType,
  defaultValueForField,
} from "../data/taskTypes";
import { validateTask } from "../utils/validation";

function formatFileSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function sanitizeForType(draft) {
  const out = {};
  for (const k of COMMON_TASK_FIELDS) {
    if (k in draft) out[k] = draft[k];
  }
  const fields = TASK_TYPES[draft.type]?.specificFields || [];
  for (const f of fields) {
    out[f.name] = f.name in draft ? draft[f.name] : defaultValueForField(f);
  }
  return out;
}

function renderSpecificField(f, draft, setDraft) {
  const val = draft[f.name];

  if (f.type === "text") {
    return (
      <input
        type="text"
        value={val ?? ""}
        onChange={(e) => setDraft({ ...draft, [f.name]: e.target.value })}
      />
    );
  }

  if (f.type === "textarea") {
    return (
      <textarea
        rows="3"
        value={val ?? ""}
        onChange={(e) => setDraft({ ...draft, [f.name]: e.target.value })}
      />
    );
  }

  if (f.type === "boolean") {
    return (
      <label className="chip-checkbox">
        <input
          type="checkbox"
          checked={Boolean(val)}
          onChange={(e) => setDraft({ ...draft, [f.name]: e.target.checked })}
        />
        {" "}
        {f.label}
      </label>
    );
  }

  if (f.type === "select") {
    return (
      <select
        value={val ?? ""}
        onChange={(e) => setDraft({ ...draft, [f.name]: e.target.value })}
      >
        {!f.required && <option value="">—</option>}
        {f.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }

  if (f.type === "date") {
    return (
      <input
        type="date"
        value={val ?? ""}
        onChange={(e) => setDraft({ ...draft, [f.name]: e.target.value })}
      />
    );
  }

  return null;
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
  const fileInputRef = useRef(null);
  const [errors, setErrors] = useState({});

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
    const hasData = oldFields.some((f) => {
      const val = draft[f.name];
      const def = defaultValueForField(f);
      if (val === undefined || val === null || val === "") return false;
      return val !== def;
    });

    if (hasData) {
      const ok = window.confirm(
        "Cambiar el tipo borrará los datos específicos del tipo anterior. ¿Continuar?"
      );
      if (!ok) return;
    }

    const newDraft = { ...draft, type: newType };
    for (const f of oldFields) {
      delete newDraft[f.name];
    }
    Object.assign(newDraft, defaultsForType(newType));
    setDraft(newDraft);
    setErrors({});
  }

  function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    const normalized = files.map((file) => ({
      id: generateId(),
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

  const specificFields = TASK_TYPES[draft.type]?.specificFields || [];

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

        <form className="task-form" onSubmit={handleSubmit}>
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
            <label>Cliente</label>
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
            {errors.clientId && <div className="field-error">{errors.clientId}</div>}
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
            <label>Detalles del tipo</label>
          </div>
          {specificFields.map((f) => (
            <div
              key={f.name}
              className={
                f.type === "textarea" || f.type === "boolean" ? "form-row full" : "form-row"
              }
            >
              {f.type !== "boolean" && (
                <label>
                  {f.label}
                  {f.required ? " *" : ""}
                </label>
              )}
              {renderSpecificField(f, draft, setDraft)}
              {errors[f.name] && <div className="field-error">{errors[f.name]}</div>}
            </div>
          ))}

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
