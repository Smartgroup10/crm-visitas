import { useState } from "react";

import { useToast } from "../../hooks/useToast";
import { useConfirm } from "../../hooks/useConfirm";

const ROLE_OPTIONS = [
  { value: "admin",      label: "Administrador" },
  { value: "supervisor", label: "Supervisor" },
  { value: "tecnico",    label: "Técnico" },
];

const ROLE_LABELS = ROLE_OPTIONS.reduce((acc, r) => {
  acc[r.value] = r.label;
  return acc;
}, {});

function roleBadgeClass(role) {
  return `role-badge role-${role}`;
}

export default function UsersView({
  users,
  currentUserId,
  onCreate,
  onUpdate,
  onResetPassword,
  onDelete,
}) {
  const toast = useToast();
  const confirm = useConfirm();

  // Formulario de alta
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "tecnico" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);

  // Edición inline de nombre + rol
  const [editingId, setEditingId]       = useState(null);
  const [editingName, setEditingName]   = useState("");
  const [editingRole, setEditingRole]   = useState("tecnico");
  const [editingBusy, setEditingBusy]   = useState(false);

  // Reset password inline
  const [resetId, setResetId]         = useState(null);
  const [resetPwd, setResetPwd]       = useState("");
  const [resetBusy, setResetBusy]     = useState(false);
  const [resetError, setResetError]   = useState("");

  // Baja en curso (para deshabilitar botones durante el borrado)
  const [deletingId, setDeletingId] = useState(null);

  async function submitNew() {
    setFieldErrors({});
    const email    = form.email.trim().toLowerCase();
    const name     = form.name.trim();
    const password = form.password;
    const role     = form.role;

    // Validación cliente ligera; el backend (zod) validará la definitiva.
    const localErrors = {};
    if (!email)              localErrors.email = "El email es obligatorio";
    if (password.length < 8) localErrors.password = "Mínimo 8 caracteres";
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      return;
    }

    setBusy(true);
    try {
      await onCreate({ email, name, password, role });
      setForm({ email: "", name: "", password: "", role: "tecnico" });
    } catch (err) {
      if (err?.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
        setFieldErrors(err.fieldErrors);
      } else {
        toast.error(err?.message || "No se pudo crear el usuario.");
      }
    } finally {
      setBusy(false);
    }
  }

  function startEdit(user) {
    setEditingId(user.id);
    setEditingName(user.name || "");
    setEditingRole(user.role);
    setResetId(null);
  }

  async function saveEdit() {
    if (editingBusy) return;
    setEditingBusy(true);
    try {
      await onUpdate(editingId, { name: editingName.trim(), role: editingRole });
      setEditingId(null);
    } catch (err) {
      toast.error(err?.message || "No se pudo actualizar el usuario.");
    } finally {
      setEditingBusy(false);
    }
  }

  function startResetPassword(user) {
    setResetId(user.id);
    setResetPwd("");
    setResetError("");
    setEditingId(null);
  }

  async function submitResetPassword(user) {
    if (resetPwd.length < 8) {
      setResetError("Mínimo 8 caracteres");
      return;
    }
    setResetBusy(true);
    setResetError("");
    try {
      await onResetPassword(user.id, resetPwd);
      setResetId(null);
      setResetPwd("");
    } catch (err) {
      if (err?.fieldErrors?.password) {
        setResetError(err.fieldErrors.password);
      } else {
        toast.error(err?.message || "No se pudo cambiar la contraseña.");
      }
    } finally {
      setResetBusy(false);
    }
  }

  async function deleteUser(user) {
    if (user.id === currentUserId) {
      toast.error("No puedes borrarte a ti mismo.");
      return;
    }
    const ok = await confirm({
      title: "Borrar usuario",
      message: `¿Seguro que quieres borrar a ${user.email}? Esta acción no se puede deshacer.`,
      variant: "danger",
      confirmLabel: "Borrar",
    });
    if (!ok) return;
    setDeletingId(user.id);
    try {
      await onDelete(user.id);
    } catch (err) {
      toast.error(err?.message || "No se pudo borrar el usuario.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="clients-view users-view">
      <div className="clients-header">
        <div>
          <h2>Usuarios</h2>
          <p>Crea, edita y gestiona los usuarios con acceso a la aplicación.</p>
        </div>
      </div>

      {/* ─── Alta de usuario ─────────────────────────────── */}
      <div className="clients-create-card">
        <div className="users-form-grid">
          <input
            type="email"
            className={fieldErrors.email ? "has-error" : ""}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="email@ejemplo.com"
            autoComplete="off"
          />
          <input
            type="text"
            className={fieldErrors.name ? "has-error" : ""}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nombre completo"
          />
          <input
            type="text"
            className={fieldErrors.password ? "has-error" : ""}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Contraseña (mín. 8)"
            autoComplete="new-password"
          />
          <select
            className={fieldErrors.role ? "has-error" : ""}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button
            className="btn-primary"
            onClick={submitNew}
            disabled={busy}
          >
            {busy ? (
              <>
                <span className="btn-spinner" aria-hidden="true" />
                Creando…
              </>
            ) : (
              "Crear usuario"
            )}
          </button>
        </div>
        {Object.keys(fieldErrors).length > 0 && (
          <ul className="users-form-errors">
            {Object.entries(fieldErrors).map(([k, msg]) => (
              <li key={k}><strong>{k}:</strong> {msg}</li>
            ))}
          </ul>
        )}
      </div>

      {/* ─── Listado ─────────────────────────────────────── */}
      <div className="clients-list-card">
        {users.length === 0 ? (
          <div className="empty-state">No hay usuarios.</div>
        ) : (
          <div className="clients-list">
            {users.map((u) => {
              const isEditing  = editingId === u.id;
              const isResetting = resetId === u.id;
              const isSelf     = u.id === currentUserId;
              const isDeleting = deletingId === u.id;
              return (
                <div key={u.id} className="client-row">
                  <div className="client-main">
                    {isEditing ? (
                      <div className="users-edit-row">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          placeholder="Nombre"
                          autoFocus
                        />
                        <select
                          value={editingRole}
                          onChange={(e) => setEditingRole(e.target.value)}
                          disabled={isSelf /* no permitimos cambiarte el rol a ti mismo */}
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <div className="client-name">
                          {u.name || <em style={{ opacity: 0.6 }}>(sin nombre)</em>}
                          {isSelf && <span className="users-self-tag"> · tú</span>}
                        </div>
                        <div className="client-meta">
                          {u.email} · <span className={roleBadgeClass(u.role)}>{ROLE_LABELS[u.role] || u.role}</span>
                        </div>
                        {isResetting && (
                          <div className="users-reset-row">
                            <input
                              type="text"
                              className={resetError ? "has-error" : ""}
                              value={resetPwd}
                              onChange={(e) => setResetPwd(e.target.value)}
                              placeholder="Nueva contraseña (mín. 8)"
                              autoComplete="new-password"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  submitResetPassword(u);
                                }
                              }}
                            />
                            <button
                              className="btn-primary small-btn"
                              onClick={() => submitResetPassword(u)}
                              disabled={resetBusy}
                            >
                              {resetBusy ? "Guardando…" : "Cambiar"}
                            </button>
                            <button
                              className="btn-secondary small-btn"
                              onClick={() => setResetId(null)}
                              disabled={resetBusy}
                            >
                              Cancelar
                            </button>
                            {resetError && (
                              <div className="field-error">{resetError}</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="client-actions">
                    {isEditing ? (
                      <>
                        <button
                          className="btn-primary small-btn"
                          onClick={saveEdit}
                          disabled={editingBusy}
                        >
                          {editingBusy ? "Guardando…" : "Guardar"}
                        </button>
                        <button
                          className="btn-secondary small-btn"
                          onClick={() => setEditingId(null)}
                          disabled={editingBusy}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn-secondary small-btn"
                          onClick={() => startEdit(u)}
                          disabled={isResetting || isDeleting}
                        >
                          Editar
                        </button>
                        <button
                          className="btn-secondary small-btn"
                          onClick={() => startResetPassword(u)}
                          disabled={isResetting || isDeleting}
                        >
                          Cambiar contraseña
                        </button>
                        <button
                          className="btn-danger small-btn"
                          onClick={() => deleteUser(u)}
                          disabled={isSelf || isDeleting || isResetting}
                          title={isSelf ? "No puedes borrarte a ti mismo" : "Borrar usuario"}
                        >
                          {isDeleting ? "Borrando…" : "Borrar"}
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
