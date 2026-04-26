import { useEffect, useState } from "react";

import { api, ApiError } from "../lib/api";
import { useToast } from "../hooks/useToast";

/**
 * Modal de preferencias del usuario actual.
 *
 *  - Notificaciones por email (on/off): si está apagado el backend no envía
 *    nada al usuario (recordatorios personales y avisos de tareas).
 *  - Antelación: minutos de aviso antes de que empiece una tarea con hora.
 *
 * El estado real vive en `useAuth().profile`. Aquí trabajamos sobre una
 * copia local hasta que el usuario pulsa "Guardar"; entonces hacemos PATCH
 * y refrescamos `profile` mediante el callback `onUpdated`.
 */

const LEAD_PRESETS = [
  { value: 0,    label: "Al empezar" },
  { value: 15,   label: "15 min antes" },
  { value: 30,   label: "30 min antes" },
  { value: 60,   label: "1 hora antes" },
  { value: 120,  label: "2 horas antes" },
  { value: 1440, label: "1 día antes" },
];

export default function PreferencesModal({ open, profile, onClose, onUpdated }) {
  const toast = useToast();
  const [enabled, setEnabled] = useState(true);
  const [lead, setLead] = useState(60);
  const [busy, setBusy] = useState(false);

  // Cuando el modal se abre, sincronizamos con el profile actual.
  useEffect(() => {
    if (!open) return;
    setEnabled(profile?.notify_email_enabled ?? true);
    setLead(Number(profile?.notify_lead_minutes ?? 60));
  }, [open, profile]);

  // Escape cierra
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const dirty =
    enabled !== (profile?.notify_email_enabled ?? true) ||
    Number(lead) !== Number(profile?.notify_lead_minutes ?? 60);

  async function handleSave() {
    if (!dirty) return onClose?.();
    setBusy(true);
    try {
      const updated = await api.patch("/auth/me/preferences", {
        notify_email_enabled: enabled,
        notify_lead_minutes: Number(lead),
      });
      onUpdated?.(updated);
      toast.success("Preferencias actualizadas");
      onClose?.();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No se pudieron guardar las preferencias";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="task-modal"
        style={{ width: "min(520px, 100%)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prefs-title"
      >
        <div className="modal-header">
          <div className="modal-header-main">
            <div>
              <h2 id="prefs-title">Mis preferencias</h2>
              <p>Notificaciones por email para recordatorios y tareas</p>
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
          <div className="form-row">
            <label className="prefs-toggle">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span>
                <strong>Recibir avisos por email</strong>
                <small>
                  {profile?.email
                    ? `Se enviarán a ${profile.email}`
                    : "Se enviarán al email asociado a tu cuenta"}
                </small>
              </span>
            </label>
          </div>

          <div className="form-row">
            <label htmlFor="prefs-lead">
              <strong>Antelación para tareas con hora</strong>
              <small style={{ display: "block", color: "var(--text-soft)", fontWeight: 400, marginTop: 2 }}>
                Cuánto antes quieres recibir el aviso de una tarea programada.
              </small>
            </label>
            <select
              id="prefs-lead"
              value={lead}
              disabled={!enabled}
              onChange={(e) => setLead(Number(e.target.value))}
            >
              {LEAD_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="modal-footer" style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 20px", borderTop: "1.5px solid var(--line-soft)", background: "var(--bg-surface)", position: "sticky", bottom: 0 }}>
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
            onClick={handleSave}
            disabled={busy || !dirty}
          >
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
