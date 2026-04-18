import { useRef } from "react";

import {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  CATEGORY_OPTIONS,
} from "../data/constants";

function formatFileSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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

  if (!open) return null;

  function toggleTechnician(techId) {
    const exists = draft.technicianIds.includes(techId);
    if (exists) {
      setDraft({ ...draft, technicianIds: draft.technicianIds.filter((id) => id !== techId) });
    } else {
      setDraft({ ...draft, technicianIds: [...draft.technicianIds, techId] });
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
