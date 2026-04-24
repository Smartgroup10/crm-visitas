import { useMemo, useState } from "react";

import { TECH_AVATAR_COLORS } from "../../data/constants";
import { useToast } from "../../hooks/useToast";
import { useConfirm } from "../../hooks/useConfirm";
import EmptyState from "../EmptyState";

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

function initials(name, email) {
  const src = (name || email || "").trim();
  if (!src) return "??";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export default function UsersView({
  users,
  tasks = [],
  currentUserId,
  currentUserRole,
  canManage = false,
  onCreate,
  onUpdate,
  onResetPassword,
  onDelete,
}) {
  const toast = useToast();
  const confirm = useConfirm();

  // Estadísticas por miembro del equipo: nº de tareas asignadas y cuántas están
  // en curso / listas. Se calcula aquí en lugar de tocar cada fila para evitar
  // O(n·m) al renderizar.
  const statsByUser = useMemo(() => {
    const acc = {};
    for (const t of tasks) {
      for (const id of t.technicianIds || []) {
        if (!acc[id]) acc[id] = { total: 0, progress: 0, done: 0 };
        acc[id].total++;
        if (t.status === "En curso") acc[id].progress++;
        if (t.status === "Listo")    acc[id].done++;
      }
    }
    return acc;
  }, [tasks]);

  // Formulario de alta
  const [form, setForm] = useState({
    email:     "",
    name:      "",
    password:  "",
    role:      "tecnico",
    phone:     "",
    specialty: "",
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Edición inline
  const [editingId, setEditingId]         = useState(null);
  const [editingDraft, setEditingDraft]   = useState({ name: "", role: "tecnico", phone: "", specialty: "" });
  const [editingBusy, setEditingBusy]     = useState(false);

  // Reset password inline
  const [resetId, setResetId]         = useState(null);
  const [resetPwd, setResetPwd]       = useState("");
  const [resetBusy, setResetBusy]     = useState(false);
  const [resetError, setResetError]   = useState("");

  // Baja en curso
  const [deletingId, setDeletingId] = useState(null);

  async function submitNew() {
    setFieldErrors({});
    const email     = form.email.trim().toLowerCase();
    const name      = form.name.trim();
    const password  = form.password;
    const role      = form.role;
    const phone     = form.phone.trim();
    const specialty = form.specialty.trim();

    const localErrors = {};
    if (!email)              localErrors.email = "El email es obligatorio";
    if (password.length < 8) localErrors.password = "Mínimo 8 caracteres";
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      return;
    }

    setBusy(true);
    try {
      await onCreate({ email, name, password, role, phone, specialty });
      setForm({ email: "", name: "", password: "", role: "tecnico", phone: "", specialty: "" });
      setShowCreate(false);
    } catch (err) {
      if (err?.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
        setFieldErrors(err.fieldErrors);
      } else {
        toast.error(err?.message || "No se pudo crear el miembro del equipo.");
      }
    } finally {
      setBusy(false);
    }
  }

  function startEdit(user) {
    setEditingId(user.id);
    setEditingDraft({
      name:      user.name || "",
      role:      user.role,
      phone:     user.phone || "",
      specialty: user.specialty || "",
    });
    setResetId(null);
  }

  async function saveEdit() {
    if (editingBusy) return;
    setEditingBusy(true);
    try {
      await onUpdate(editingId, {
        name:      editingDraft.name.trim(),
        role:      editingDraft.role,
        phone:     editingDraft.phone.trim(),
        specialty: editingDraft.specialty.trim(),
      });
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
    if (tasks.some((t) => (t.technicianIds || []).includes(user.id))) {
      toast.error("No puedes borrar a este miembro: tiene tareas asignadas. Reasígnalas antes.");
      return;
    }
    const ok = await confirm({
      title: "Borrar miembro del equipo",
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
    <div className="clients-view users-view team-view">
      <div className="clients-header">
        <div>
          <h2>Equipo</h2>
          <p>
            {canManage
              ? "Crea, edita y gestiona los miembros del equipo. Los técnicos aparecen aquí como usuarios con rol “Técnico”."
              : "Directorio del equipo. Consulta el rol, la especialidad y el contacto de cada compañero."}
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? "Cancelar" : "+ Nuevo miembro"}
          </button>
        )}
      </div>

      {/* Aviso explícito si el usuario no tiene permiso de gestión, para que
          no parezca que los botones "no funcionan" cuando en realidad están
          ocultos por política. Incluye el rol actual para ayudar a diagnosticar
          promociones pendientes. */}
      {!canManage && (
        <div className="users-no-permissions">
          <strong>Solo los administradores pueden crear, editar o borrar
          miembros del equipo.</strong>{" "}
          Tu rol actual es{" "}
          <span className={roleBadgeClass(currentUserRole || "tecnico")}>
            {ROLE_LABELS[currentUserRole] || currentUserRole || "desconocido"}
          </span>.
          Si esto no es correcto, pídele a un administrador que actualice tu rol.
        </div>
      )}

      {/* ─── Alta ─────────────────────────────────────── */}
      {canManage && showCreate && (
        <div className="clients-create-card">
          <div className="users-form-grid team-form-grid">
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
            <input
              type="text"
              className={fieldErrors.phone ? "has-error" : ""}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Teléfono (opcional)"
            />
            <input
              type="text"
              className={fieldErrors.specialty ? "has-error" : ""}
              value={form.specialty}
              onChange={(e) => setForm({ ...form, specialty: e.target.value })}
              placeholder="Especialidad (ej. Redes)"
            />
            <button
              className="btn-primary team-form-submit"
              onClick={submitNew}
              disabled={busy}
            >
              {busy ? (
                <>
                  <span className="btn-spinner" aria-hidden="true" />
                  Creando…
                </>
              ) : (
                "Crear miembro"
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
      )}

      {/* ─── Listado ───────────────────────────────────── */}
      <div className="clients-list-card">
        {users.length === 0 ? (
          <EmptyState
            icon="users"
            title="Sin miembros en el equipo"
            description={
              canManage
                ? "Rellena el formulario superior para añadir el primer miembro."
                : "Aún no hay miembros registrados."
            }
          />
        ) : (
          <div className="team-grid">
            {users.map((u, i) => {
              const isEditing   = editingId === u.id;
              const isResetting = resetId === u.id;
              const isSelf      = u.id === currentUserId;
              const isDeleting  = deletingId === u.id;
              const color       = TECH_AVATAR_COLORS[i % TECH_AVATAR_COLORS.length];
              const stats       = statsByUser[u.id] || { total: 0, progress: 0, done: 0 };

              return (
                <div key={u.id} className="team-card">
                  <div className="team-card-top">
                    <div className="tech-avatar" style={{ background: color }}>
                      {initials(u.name, u.email)}
                    </div>
                    {isEditing ? (
                      <div className="team-edit-fields">
                        <input
                          type="text"
                          value={editingDraft.name}
                          onChange={(e) => setEditingDraft({ ...editingDraft, name: e.target.value })}
                          placeholder="Nombre"
                          autoFocus
                        />
                        <select
                          value={editingDraft.role}
                          onChange={(e) => setEditingDraft({ ...editingDraft, role: e.target.value })}
                          disabled={isSelf /* no permitimos cambiarte el rol a ti mismo */}
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={editingDraft.phone}
                          onChange={(e) => setEditingDraft({ ...editingDraft, phone: e.target.value })}
                          placeholder="Teléfono"
                        />
                        <input
                          type="text"
                          value={editingDraft.specialty}
                          onChange={(e) => setEditingDraft({ ...editingDraft, specialty: e.target.value })}
                          placeholder="Especialidad"
                        />
                      </div>
                    ) : (
                      <div className="team-info">
                        <div className="team-name">
                          {u.name || <em style={{ opacity: 0.6 }}>(sin nombre)</em>}
                          {isSelf && <span className="users-self-tag"> · tú</span>}
                        </div>
                        <div className="team-email">{u.email}</div>
                        <div className="team-meta-row">
                          <span className={roleBadgeClass(u.role)}>{ROLE_LABELS[u.role] || u.role}</span>
                          {u.specialty && <span className="team-specialty">{u.specialty}</span>}
                        </div>
                        {u.phone && <div className="team-phone">📞 {u.phone}</div>}
                      </div>
                    )}
                  </div>

                  <div className="tech-stats">
                    <div className="tech-stat">
                      <span className="tech-stat-num">{stats.total}</span>
                      <span className="tech-stat-label">Tareas</span>
                    </div>
                    <div className="tech-stat">
                      <span className="tech-stat-num" style={{ color: "var(--c-progress)" }}>
                        {stats.progress}
                      </span>
                      <span className="tech-stat-label">En curso</span>
                    </div>
                    <div className="tech-stat">
                      <span className="tech-stat-num" style={{ color: "var(--c-done)" }}>
                        {stats.done}
                      </span>
                      <span className="tech-stat-label">Listas</span>
                    </div>
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

                  {canManage && (
                    <div className="team-card-actions">
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
                            Contraseña
                          </button>
                          <button
                            className="btn-danger small-btn"
                            onClick={() => deleteUser(u)}
                            disabled={isSelf || isDeleting || isResetting}
                            title={isSelf ? "No puedes borrarte a ti mismo" : "Borrar miembro"}
                          >
                            {isDeleting ? "Borrando…" : "Borrar"}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
