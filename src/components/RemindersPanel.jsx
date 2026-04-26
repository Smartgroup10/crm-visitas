import { useEffect, useState } from "react";

import { ApiError } from "../lib/api";
import { useToast } from "../hooks/useToast";
import { useConfirm } from "../hooks/useConfirm";
import { useReminders } from "../hooks/useReminders";
import { IconBell, IconPlus } from "./Icon";
import EmptyState from "./EmptyState";
import ReminderModal from "./ReminderModal";

/**
 * Panel "Mis recordatorios" embebido en una vista.
 * Carga los recordatorios pending del usuario y permite crearlos, editarlos
 * y descartarlos. Pensado para encajar dentro del `dashboard-grid` de
 * MiTrabajoView pero también funciona aislado.
 */

function fmtRemindAt(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("es-ES", {
      weekday: "short",
      day:   "2-digit",
      month: "short",
      hour:  "2-digit",
      minute:"2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

function relative(iso, now) {
  if (!iso) return "";
  const diffMs = new Date(iso).getTime() - now;
  if (Number.isNaN(diffMs)) return "";
  const absMin = Math.abs(diffMs / 60_000);
  const future = diffMs >= 0;
  let val;
  if (absMin < 1)        val = "<1 min";
  else if (absMin < 60)  val = `${Math.round(absMin)} min`;
  else if (absMin < 1440)val = `${Math.round(absMin / 60)} h`;
  else                   val = `${Math.round(absMin / 1440)} d`;
  return future ? `en ${val}` : `hace ${val}`;
}

export default function RemindersPanel() {
  const toast   = useToast();
  const confirm = useConfirm();
  const { reminders, loading, create, update, dismiss } = useReminders({ status: "pending" });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState(null);

  // Reloj que avanza cada 60s para refrescar los textos relativos
  // ("en 5 min" / "hace 2 min") sin recurrir a Date.now() durante render.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(reminder) {
    setEditing(reminder);
    setModalOpen(true);
  }

  async function handleSubmit(payload) {
    if (editing?.id) {
      await update(editing.id, payload);
    } else {
      await create(payload);
    }
  }

  async function handleDismiss(reminder) {
    const ok = await confirm({
      title: "Descartar recordatorio",
      message: `¿Quieres descartar "${reminder.title}"? No recibirás el aviso.`,
      confirmLabel: "Descartar",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await dismiss(reminder.id);
      toast.success("Recordatorio descartado");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No se pudo descartar";
      toast.error(msg);
    }
  }

  return (
    <div className="panel-block">
      <div className="panel-block-header">
        <h2><span style={{ marginRight: 6, verticalAlign: "-2px" }}><IconBell /></span> Mis recordatorios</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>{loading ? "…" : `${reminders.length} pendientes`}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={openCreate}
            aria-label="Nuevo recordatorio"
            title="Nuevo recordatorio"
          >
            <IconPlus /> Nuevo
          </button>
        </div>
      </div>

      {!loading && reminders.length === 0 ? (
        <EmptyState
          compact
          icon="inbox"
          title="Sin recordatorios"
          description="Crea uno para recibir un email a la hora que elijas."
          action={{ label: "+ Nuevo recordatorio", variant: "primary", onClick: openCreate }}
        />
      ) : (
        <div className="day-task-list">
          {reminders.map((r) => {
            const past = new Date(r.remind_at).getTime() < now;
            return (
              <div key={r.id} className={`day-task-card reminder-card ${past ? "is-past" : ""}`}>
                <button
                  type="button"
                  className="reminder-main"
                  onClick={() => openEdit(r)}
                  aria-label={`Editar ${r.title}`}
                >
                  <div className="day-task-top">
                    <strong>{r.title}</strong>
                    <span className="reminder-when-pill">{relative(r.remind_at, now)}</span>
                  </div>
                  <div className="day-task-meta">{fmtRemindAt(r.remind_at)}</div>
                  {r.body ? <div className="day-task-meta reminder-body">{r.body}</div> : null}
                </button>
                <button
                  type="button"
                  className="reminder-dismiss"
                  onClick={(e) => { e.stopPropagation(); handleDismiss(r); }}
                  aria-label={`Descartar ${r.title}`}
                  title="Descartar"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      <ReminderModal
        open={modalOpen}
        reminder={editing}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
