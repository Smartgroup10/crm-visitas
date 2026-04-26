import { useEffect, useMemo, useState } from "react";

import { ApiError } from "../lib/api";
import { useToast } from "../hooks/useToast";

/**
 * Modal de creación/edición de recordatorio personal.
 *
 *   <ReminderModal
 *     open
 *     reminder={existing|null}
 *     onClose={...}
 *     onSubmit={(payload) => create/update(...)}
 *   />
 *
 * El padre se encarga del CRUD (vía useReminders); este componente sólo
 * recoge `title`, `body` y `remind_at` (ISO con offset).
 */

const PRESETS = [
  { id: "in-1h",      label: "En 1 hora",         minutesFromNow: 60 },
  { id: "in-3h",      label: "En 3 horas",        minutesFromNow: 180 },
  { id: "today-end",  label: "Hoy a las 18:00",   build: () => atTime(0, 18, 0) },
  { id: "tomorrow-9", label: "Mañana 9:00",       build: () => atTime(1, 9, 0) },
  { id: "tomorrow-15",label: "Mañana 15:00",      build: () => atTime(1, 15, 0) },
  { id: "monday-9",   label: "Lunes 9:00",        build: () => nextWeekday(1, 9, 0) },
];

function atTime(daysFromNow, hour, minute) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d;
}
// weekday: 1 = lunes ... 7 = domingo (ISO)
function nextWeekday(weekday, hour, minute) {
  const now = new Date();
  const isoDow = ((now.getDay() + 6) % 7) + 1;
  let delta = weekday - isoDow;
  if (delta <= 0) delta += 7;
  return atTime(delta, hour, minute);
}

function pad(n) { return String(n).padStart(2, "0"); }

function toLocalDateValue(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toLocalTimeValue(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function combine(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  // new Date("2026-04-25T09:00") usa la zona local del navegador, que es lo
  // que queremos: el usuario escribe "9:00" pensando en su hora local.
  const d = new Date(`${dateStr}T${timeStr}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function ReminderModal({ open, reminder, onClose, onSubmit }) {
  const toast = useToast();
  const isEdit = !!reminder?.id;

  const initial = useMemo(() => {
    if (reminder?.remind_at) {
      const d = new Date(reminder.remind_at);
      return {
        title: reminder.title || "",
        body:  reminder.body  || "",
        date:  toLocalDateValue(d),
        time:  toLocalTimeValue(d),
      };
    }
    const d = atTime(0, Math.min(new Date().getHours() + 1, 23), 0);
    return {
      title: "",
      body:  "",
      date:  toLocalDateValue(d),
      time:  toLocalTimeValue(d),
    };
  }, [reminder]);

  const [title, setTitle] = useState(initial.title);
  const [body,  setBody]  = useState(initial.body);
  const [date,  setDate]  = useState(initial.date);
  const [time,  setTime]  = useState(initial.time);
  const [busy,  setBusy]  = useState(false);

  // Resync cuando se abre o cambia el reminder.
  useEffect(() => {
    if (!open) return;
    setTitle(initial.title);
    setBody(initial.body);
    setDate(initial.date);
    setTime(initial.time);
    setBusy(false);
  }, [open, initial]);

  // Escape cierra
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function applyPreset(p) {
    let target;
    if (typeof p.minutesFromNow === "number") {
      target = new Date(Date.now() + p.minutesFromNow * 60_000);
    } else if (typeof p.build === "function") {
      target = p.build();
    }
    if (target) {
      setDate(toLocalDateValue(target));
      setTime(toLocalTimeValue(target));
    }
  }

  async function handleSubmit() {
    if (!title.trim()) {
      toast.error("Pon un título al recordatorio");
      return;
    }
    const at = combine(date, time);
    if (!at) {
      toast.error("Fecha u hora no válida");
      return;
    }
    setBusy(true);
    try {
      await onSubmit?.({
        title: title.trim(),
        body:  body.trim(),
        remind_at: at.toISOString(),
      });
      toast.success(isEdit ? "Recordatorio actualizado" : "Recordatorio creado");
      onClose?.();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No se pudo guardar el recordatorio";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="task-modal"
        style={{ width: "min(560px, 100%)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-title"
      >
        <div className="modal-header">
          <div className="modal-header-main">
            <div>
              <h2 id="reminder-title">{isEdit ? "Editar recordatorio" : "Nuevo recordatorio"}</h2>
              <p>Recibirás un email a la hora indicada</p>
            </div>
          </div>
          <button
            type="button"
            className="icon-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="form-section">
          <div className="form-row full">
            <label htmlFor="rem-title">Título</label>
            <input
              id="rem-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Llamar a Clínica Norte"
              maxLength={200}
              autoFocus
            />
          </div>

          <div className="form-row full">
            <label>Cuándo</label>
            <div className="reminder-presets">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="chip"
                  onClick={() => applyPreset(p)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="reminder-when">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                step="300"
              />
            </div>
          </div>

          <div className="form-row full">
            <label htmlFor="rem-body">Notas (opcional)</label>
            <textarea
              id="rem-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Detalles del recordatorio…"
              maxLength={2000}
              rows={3}
            />
          </div>
        </div>

        <div
          className="modal-footer"
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            padding: "14px 20px",
            borderTop: "1.5px solid var(--line-soft)",
            background: "var(--bg-surface)",
            position: "sticky",
            bottom: 0,
          }}
        >
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={busy}
          >
            {busy ? "Guardando…" : isEdit ? "Guardar" : "Crear recordatorio"}
          </button>
        </div>
      </div>
    </div>
  );
}
