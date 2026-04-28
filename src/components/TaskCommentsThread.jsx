import { useEffect, useRef, useState } from "react";

import { useTaskComments } from "../hooks/useTaskComments";
import { useAuth } from "../hooks/useAuth";

/**
 * Hilo de comentarios de una tarea (chat interno).
 *
 * UX:
 *  - Lista vertical estilo mensajes, ordenada por antigüedad ascendente
 *    (más viejo arriba, más nuevo abajo — como un chat tradicional).
 *  - Al final, un textarea para escribir uno nuevo.
 *  - Cada comentario muestra autor, hora relativa, y un menú "..."
 *    SÓLO para el autor — desde donde puede editar inline o borrar.
 *  - Auto-scroll al fondo cuando llega un comentario nuevo.
 *  - Ctrl+Enter (Cmd+Enter en Mac) envía el mensaje sin pulsar el botón.
 *
 * Estilos en `styles/comments.css`. El componente se monta dentro del
 * TaskModal cuando hay tarea editable.
 */

// ─── Helpers ────────────────────────────────────────────────────
function relativeTime(iso) {
  if (!iso) return "";
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return "";
  const diff = Date.now() - target;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "ahora mismo";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fullTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function getInitials(name) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Comentario individual ──────────────────────────────────────
function CommentItem({ comment, isOwn, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (draft.trim() === comment.body.trim()) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onEdit(comment.id, draft);
      setEditing(false);
    } catch { /* hook ya guarda el error */ }
    finally { setBusy(false); }
  }

  function handleCancel() {
    setDraft(comment.body);
    setEditing(false);
  }

  function handleKey(e) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  }

  return (
    <li className={`comment-item ${isOwn ? "comment-own" : ""}`}>
      <div className="comment-avatar" aria-hidden="true">
        {getInitials(comment.author_name)}
      </div>
      <div className="comment-bubble">
        <div className="comment-meta">
          <strong className="comment-author">
            {comment.author_name || "Usuario"}
          </strong>
          <span className="comment-time" title={fullTime(comment.created_at)}>
            {relativeTime(comment.created_at)}
            {comment.edited_at && (
              <span className="comment-edited" title={`Editado: ${fullTime(comment.edited_at)}`}>
                {" "}(editado)
              </span>
            )}
          </span>
          {isOwn && !editing && (
            <span className="comment-actions">
              <button
                type="button"
                className="comment-action-btn"
                onClick={() => setEditing(true)}
                aria-label="Editar comentario"
                title="Editar"
              >
                Editar
              </button>
              <button
                type="button"
                className="comment-action-btn comment-action-danger"
                onClick={() => {
                  if (window.confirm("¿Eliminar este comentario?")) {
                    onDelete(comment.id);
                  }
                }}
                aria-label="Eliminar comentario"
                title="Eliminar"
              >
                Eliminar
              </button>
            </span>
          )}
        </div>
        {editing ? (
          <div className="comment-edit">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKey}
              rows={Math.min(8, Math.max(2, draft.split("\n").length))}
              autoFocus
              disabled={busy}
            />
            <div className="comment-edit-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCancel}
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSave}
                disabled={busy || draft.trim() === ""}
              >
                {busy ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        ) : (
          <div className="comment-body">{comment.body}</div>
        )}
      </div>
    </li>
  );
}

// ─── Componente principal ──────────────────────────────────────
export default function TaskCommentsThread({ taskId }) {
  const { profile } = useAuth();
  const {
    items, loading, error, sending,
    addComment, updateComment, deleteComment,
  } = useTaskComments(taskId);

  const [draft, setDraft] = useState("");
  const listEndRef = useRef(null);

  // Auto-scroll al final cuando cambia el número de items.
  // Sólo cuando el usuario YA estaba cerca del final (evitamos hacer
  // scroll si está leyendo arriba). Heurística simple: siempre por
  // ahora, en una v2 lo refinamos.
  useEffect(() => {
    if (listEndRef.current) {
      listEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [items.length]);

  async function handleSend(e) {
    e?.preventDefault?.();
    if (!draft.trim() || sending) return;
    try {
      await addComment(draft);
      setDraft("");
    } catch { /* hook guarda el error */ }
  }

  function handleKey(e) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!taskId) return null;

  return (
    <section className="task-comments" aria-label="Comentarios de la tarea">
      <header className="task-comments-header">
        <h3>Comentarios{items.length > 0 ? ` (${items.length})` : ""}</h3>
        {loading && <span className="task-comments-status">cargando…</span>}
      </header>

      {error && (
        <div className="task-comments-error" role="alert">
          {error}
        </div>
      )}

      {items.length === 0 && !loading && !error && (
        <div className="task-comments-empty">
          Aún no hay comentarios. Sé el primero en aportar contexto.
        </div>
      )}

      {items.length > 0 && (
        <ul className="comments-list">
          {items.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              isOwn={c.author_id === profile?.id}
              onEdit={updateComment}
              onDelete={deleteComment}
            />
          ))}
          <li ref={listEndRef} aria-hidden="true" />
        </ul>
      )}

      <form className="comment-form" onSubmit={handleSend}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Escribe un comentario… (Ctrl+Enter para enviar)"
          rows={2}
          disabled={sending}
        />
        <div className="comment-form-actions">
          <small className="comment-form-hint">
            Visible para todo el equipo asignado a la tarea
          </small>
          <button
            type="submit"
            className="btn-primary"
            disabled={sending || draft.trim() === ""}
          >
            {sending ? "Enviando…" : "Comentar"}
          </button>
        </div>
      </form>
    </section>
  );
}
