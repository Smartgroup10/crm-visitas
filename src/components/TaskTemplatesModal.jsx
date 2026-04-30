import { useEffect, useState } from "react";

import { useTaskTemplates } from "../hooks/useTaskTemplates";
import { usePermissions } from "../hooks/usePermissions";
import { useToast } from "../hooks/useToast";
import { useConfirm } from "../hooks/useConfirm";
import { TASK_TYPES, TASK_TYPE_KEYS } from "../data/taskTypes";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "../data/constants";
import { ApiError } from "../lib/api";

/**
 * Modal para gestionar plantillas de tarea.
 *
 * Dos vistas coexistiendo en el mismo modal:
 *   - LIST: tabla con las plantillas existentes + botón "Nueva".
 *   - FORM: alta o edición de una plantilla.
 *
 * Tras guardar, vuelve automáticamente a LIST. La X cierra todo.
 * Esc cierra el form si estás dentro; si estás en lista, cierra el
 * modal entero.
 *
 * El form NO incluye fecha/hora ni adjuntos — esos son siempre
 * per-instancia, no propios del "tipo de trabajo".
 */

const EMPTY = {
  name: "",
  title: "",
  type: "",
  priority: "Media",
  status: "No iniciado",
  estimated_time: "",
  notes: "",
  materials: "",
  vehicle: "",
  phone: "",
  client_id: "",
  technician_ids: [],
};

export default function TaskTemplatesModal({ open, onClose, clients, technicians }) {
  const { items, loading, error, create, update, remove } = useTaskTemplates();
  const { canManage } = usePermissions();
  const toast   = useToast();
  const confirm = useConfirm();

  // Modo: "list" | "form". Cuando entramos al form guardamos la
  // plantilla que estamos editando (o null si es alta nueva).
  const [mode, setMode]       = useState("list");
  const [draft, setDraft]     = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy]       = useState(false);
  const [errMsg, setErrMsg]   = useState(null);

  // Reset al abrir/cerrar.
  useEffect(() => {
    if (!open) return;
    setMode("list");
    setDraft(EMPTY);
    setEditingId(null);
    setErrMsg(null);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Esc cierra. Dentro del form vuelve a la lista; en la lista cierra modal.
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (mode === "form") {
          setMode("list");
        } else {
          onClose?.();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, mode, onClose]);

  if (!open) return null;

  function startCreate() {
    setDraft(EMPTY);
    setEditingId(null);
    setErrMsg(null);
    setMode("form");
  }

  function startEdit(template) {
    setDraft({
      name:           template.name || "",
      title:          template.title || "",
      type:           template.type || "",
      priority:       template.priority || "Media",
      status:         template.status || "No iniciado",
      estimated_time: template.estimated_time || "",
      notes:          template.notes || "",
      materials:      template.materials || "",
      vehicle:        template.vehicle || "",
      phone:          template.phone || "",
      client_id:      template.client_id || "",
      technician_ids: Array.isArray(template.technician_ids) ? template.technician_ids : [],
    });
    setEditingId(template.id);
    setErrMsg(null);
    setMode("form");
  }

  async function handleDelete(template) {
    const ok = await confirm({
      title: "Borrar plantilla",
      message: `¿Seguro que quieres borrar "${template.name}"? Las tareas ya creadas no se ven afectadas.`,
      variant: "danger",
      confirmLabel: "Borrar",
    });
    if (!ok) return;
    try {
      await remove(template.id);
      toast.success("Plantilla borrada.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo borrar.");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!draft.name.trim()) {
      setErrMsg("El nombre de la plantilla es obligatorio.");
      return;
    }
    setBusy(true);
    setErrMsg(null);
    const payload = {
      name:           draft.name.trim(),
      title:          draft.title || "",
      type:           draft.type || null,
      priority:       draft.priority || "Media",
      status:         draft.status || "No iniciado",
      estimated_time: draft.estimated_time || "",
      notes:          draft.notes || "",
      materials:      draft.materials || "",
      vehicle:        draft.vehicle || "",
      phone:          draft.phone || "",
      client_id:      draft.client_id || null,
      technician_ids: draft.technician_ids || [],
      type_fields:    {},
    };
    try {
      if (editingId) {
        await update(editingId, payload);
        toast.success("Plantilla actualizada.");
      } else {
        await create(payload);
        toast.success("Plantilla creada.");
      }
      setMode("list");
    } catch (err) {
      setErrMsg(err instanceof ApiError ? err.message : "Error guardando la plantilla.");
    } finally {
      setBusy(false);
    }
  }

  function toggleTech(id) {
    setDraft((d) => {
      const has = d.technician_ids.includes(id);
      return {
        ...d,
        technician_ids: has
          ? d.technician_ids.filter((x) => x !== id)
          : [...d.technician_ids, id],
      };
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="task-modal templates-modal"
        style={{ width: "min(720px, 100%)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="templates-title"
      >
        <div className="modal-header">
          <div className="modal-header-main">
            <div>
              <h2 id="templates-title">
                {mode === "form"
                  ? (editingId ? "Editar plantilla" : "Nueva plantilla")
                  : "Plantillas de tarea"}
              </h2>
              <p>
                {mode === "form"
                  ? "Define los valores por defecto. Al aplicar la plantilla, estos campos se rellenan automáticamente en la nueva tarea."
                  : "Acelera la creación de tareas repetitivas con valores pre-rellenos."}
              </p>
            </div>
          </div>
          <button type="button" className="icon-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        {/* ─── Vista LIST ───────────────────────────────── */}
        {mode === "list" && (
          <>
            <div className="templates-toolbar">
              {canManage && (
                <button type="button" className="btn-primary" onClick={startCreate}>
                  + Nueva plantilla
                </button>
              )}
              <span className="templates-count">
                {items.length} {items.length === 1 ? "plantilla" : "plantillas"}
              </span>
            </div>

            {error && <div className="task-comments-error" role="alert">{error}</div>}
            {loading && <div className="task-comments-empty">Cargando…</div>}
            {!loading && items.length === 0 && !error && (
              <div className="task-comments-empty">
                Aún no hay plantillas. {canManage && "Crea la primera para acelerar las tareas que repites con frecuencia."}
              </div>
            )}

            {!loading && items.length > 0 && (
              <ul className="templates-list">
                {items.map((tpl) => {
                  const cName = clients?.find((c) => c.id === tpl.client_id)?.name;
                  const techCount = (tpl.technician_ids || []).length;
                  return (
                    <li key={tpl.id} className="template-row">
                      <div className="template-main">
                        <div className="template-name">{tpl.name}</div>
                        <div className="template-meta">
                          {tpl.type && <span className="template-chip">{tpl.type}</span>}
                          {tpl.priority && <span className="template-chip">Prioridad: {tpl.priority}</span>}
                          {cName && <span className="template-chip">Cliente: {cName}</span>}
                          {techCount > 0 && (
                            <span className="template-chip">
                              {techCount} {techCount === 1 ? "técnico" : "técnicos"}
                            </span>
                          )}
                        </div>
                      </div>
                      {canManage && (
                        <div className="template-actions">
                          <button
                            type="button"
                            className="btn-secondary small-btn"
                            onClick={() => startEdit(tpl)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn-danger small-btn"
                            onClick={() => handleDelete(tpl)}
                          >
                            Borrar
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {/* ─── Vista FORM ───────────────────────────────── */}
        {mode === "form" && (
          <form onSubmit={handleSubmit} className="templates-form">
            {errMsg && <div className="task-comments-error" role="alert">{errMsg}</div>}

            <div className="form-section">
              <div className="form-section-grid">
                <div className="form-row full">
                  <label>Nombre de la plantilla *</label>
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Ej.: Mantenimiento mensual VOIP"
                    autoFocus
                  />
                </div>
                <div className="form-row full">
                  <label>Título por defecto de la tarea</label>
                  <input
                    type="text"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="Se usará como título cuando crees una tarea con esta plantilla"
                  />
                </div>
                <div className="form-row">
                  <label>Tipo</label>
                  <select
                    value={draft.type}
                    onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                  >
                    <option value="">— Sin tipo —</option>
                    {TASK_TYPE_KEYS.map((k) => (
                      <option key={k} value={k}>{TASK_TYPES[k].label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label>Prioridad</label>
                  <select
                    value={draft.priority}
                    onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
                  >
                    {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <label>Estado inicial</label>
                  <select
                    value={draft.status}
                    onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                  >
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <label>Tiempo estimado</label>
                  <input
                    type="text"
                    value={draft.estimated_time}
                    onChange={(e) => setDraft({ ...draft, estimated_time: e.target.value })}
                    placeholder="Ej.: 2 horas"
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-header">Cliente y equipo (opcional)</div>
              <div className="form-section-grid">
                <div className="form-row full">
                  <label>Cliente por defecto</label>
                  <select
                    value={draft.client_id}
                    onChange={(e) => setDraft({ ...draft, client_id: e.target.value })}
                  >
                    <option value="">— Ninguno —</option>
                    {clients?.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row full">
                  <label>Técnicos asignados por defecto</label>
                  <div className="chips-row">
                    {technicians?.map((tech) => (
                      <button
                        type="button"
                        key={tech.id}
                        className={`chip ${draft.technician_ids.includes(tech.id) ? "chip-active" : ""}`}
                        onClick={() => toggleTech(tech.id)}
                      >
                        {tech.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-row">
                  <label>Vehículo</label>
                  <input
                    type="text"
                    value={draft.vehicle}
                    onChange={(e) => setDraft({ ...draft, vehicle: e.target.value })}
                  />
                </div>
                <div className="form-row">
                  <label>Teléfono</label>
                  <input
                    type="text"
                    value={draft.phone}
                    onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-header">Notas y materiales</div>
              <div className="form-section-grid">
                <div className="form-row full">
                  <label>Notas / checklist por defecto</label>
                  <textarea
                    rows="4"
                    value={draft.notes}
                    onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                    placeholder="Pasos a seguir, comprobaciones típicas, observaciones recurrentes…"
                  />
                </div>
                <div className="form-row full">
                  <label>Materiales por defecto</label>
                  <textarea
                    rows="2"
                    value={draft.materials}
                    onChange={(e) => setDraft({ ...draft, materials: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setMode("list")}
                disabled={busy}
              >
                Cancelar
              </button>
              <div className="form-actions-spacer" />
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Guardando…" : (editingId ? "Guardar cambios" : "Crear plantilla")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
