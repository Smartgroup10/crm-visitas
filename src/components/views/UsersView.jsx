import { useState } from "react";

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
  // Formulario de alta
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "tecnico" });
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  // Edición inline de nombre + rol
  const [editingId, setEditingId]       = useState(null);
  const [editingName, setEditingName]   = useState("");
  const [editingRole, setEditingRole]   = useState("tecnico");

  async function submitNew() {
    setFormError("");
    const email    = form.email.trim().toLowerCase();
    const name     = form.name.trim();
    const password = form.password;
    const role     = form.role;

    if (!email)              return setFormError("El email es obligatorio");
    if (password.length < 8) return setFormError("La contraseña debe tener al menos 8 caracteres");

    setBusy(true);
    try {
      await onCreate({ email, name, password, role });
      setForm({ email: "", name: "", password: "", role: "tecnico" });
    } catch (err) {
      setFormError(err?.message || "No se pudo crear el usuario");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(user) {
    setEditingId(user.id);
    setEditingName(user.name || "");
    setEditingRole(user.role);
  }

  async function saveEdit() {
    try {
      await onUpdate(editingId, { name: editingName.trim(), role: editingRole });
      setEditingId(null);
    } catch (err) {
      alert(err?.message || "No se pudo actualizar el usuario");
    }
  }

  async function resetPassword(user) {
    const pwd = window.prompt(
      `Nueva contraseña para ${user.email} (mínimo 8 caracteres):`
    );
    if (pwd === null) return;
    if (pwd.length < 8) {
      alert("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    try {
      await onResetPassword(user.id, pwd);
      alert("Contraseña actualizada");
    } catch (err) {
      alert(err?.message || "No se pudo cambiar la contraseña");
    }
  }

  async function deleteUser(user) {
    if (user.id === currentUserId) {
      alert("No puedes borrarte a ti mismo.");
      return;
    }
    const ok = window.confirm(
      `¿Seguro que quieres borrar a ${user.email}? Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    try {
      await onDelete(user.id);
    } catch (err) {
      alert(err?.message || "No se pudo borrar el usuario");
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
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="email@ejemplo.com"
            autoComplete="off"
          />
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nombre completo"
          />
          <input
            type="text"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Contraseña (mín. 8)"
            autoComplete="new-password"
          />
          <select
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
            {busy ? "Creando…" : "Crear usuario"}
          </button>
        </div>
        {formError && <div className="login-error" style={{ marginTop: 8 }}>{formError}</div>}
      </div>

      {/* ─── Listado ─────────────────────────────────────── */}
      <div className="clients-list-card">
        {users.length === 0 ? (
          <div className="empty-state">No hay usuarios.</div>
        ) : (
          <div className="clients-list">
            {users.map((u) => {
              const isEditing = editingId === u.id;
              const isSelf    = u.id === currentUserId;
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
                          onClick={() => setEditingId(null)}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn-secondary small-btn"
                          onClick={() => startEdit(u)}
                        >
                          Editar
                        </button>
                        <button
                          className="btn-secondary small-btn"
                          onClick={() => resetPassword(u)}
                        >
                          Cambiar contraseña
                        </button>
                        <button
                          className="btn-danger small-btn"
                          onClick={() => deleteUser(u)}
                          disabled={isSelf}
                          title={isSelf ? "No puedes borrarte a ti mismo" : "Borrar usuario"}
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
