// ============================================================
// Plantillas de email (HTML + texto plano)
// ============================================================
// Todo el HTML usa estilos inline porque la mayoría de clientes (Outlook,
// Gmail) ignoran `<style>` o lo procesan de forma inconsistente. Mantén las
// plantillas simples: la fiabilidad pesa más que la estética.
// ============================================================

import { APP_BASE_URL } from "./mailer.js";

const BRAND = "CRM Visitas · Smartgroup";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDateTime(iso) {
  // `iso` ≈ "2026-04-25T09:00:00Z" o "2026-04-25T09:00:00+02:00"
  // Formateamos en es-ES para que sea legible en el correo.
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-ES", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtDate(d) {
  if (!d) return "—";
  // d puede venir como "YYYY-MM-DD" (string) o Date.
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  }
  try {
    return new Date(d).toLocaleDateString("es-ES");
  } catch { return String(d); }
}

function btn(href, label) {
  if (!href) return "";
  return `<a href="${escapeHtml(href)}"
    style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;
           padding:10px 18px;border-radius:6px;font-weight:600;font-size:14px;">
    ${escapeHtml(label)}
  </a>`;
}

function layout({ title, intro, lines, ctaHref, ctaLabel, footerNote }) {
  const linesHtml = (lines || [])
    .filter(Boolean)
    .map(
      (l) => `<tr>
        <td style="color:#6b7280;font-size:13px;padding:4px 0;width:120px;vertical-align:top;">${escapeHtml(l.label)}</td>
        <td style="color:#111827;font-size:14px;padding:4px 0;">${l.html ?? escapeHtml(l.value || "")}</td>
      </tr>`
    )
    .join("");

  const cta = ctaHref
    ? `<div style="margin:24px 0 8px;">${btn(ctaHref, ctaLabel || "Abrir en el CRM")}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;background:#ffffff;border-radius:10px;
                    box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden;">
        <tr><td style="background:#0f172a;color:#fff;padding:14px 20px;font-weight:700;font-size:14px;letter-spacing:.4px;">
          ${escapeHtml(BRAND)}
        </td></tr>
        <tr><td style="padding:24px 24px 16px;">
          <h1 style="margin:0 0 12px;font-size:18px;color:#111827;">${escapeHtml(title)}</h1>
          ${intro ? `<p style="margin:0 0 14px;color:#374151;font-size:14px;line-height:1.5;">${escapeHtml(intro)}</p>` : ""}
          ${linesHtml ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:6px;">${linesHtml}</table>` : ""}
          ${cta}
        </td></tr>
        <tr><td style="padding:14px 24px 22px;color:#9ca3af;font-size:12px;border-top:1px solid #f1f5f9;">
          ${escapeHtml(footerNote || "Recibes este correo porque tienes notificaciones activas en el CRM. Puedes desactivarlas desde tu perfil.")}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function lineList(lines) {
  // Versión texto plano de las mismas líneas
  return (lines || [])
    .filter(Boolean)
    .map((l) => `${l.label}: ${l.text || l.value || ""}`)
    .join("\n");
}

function deepLink(path) {
  if (!APP_BASE_URL) return "";
  return APP_BASE_URL + path;
}

// ─── Recordatorios personales ─────────────────────────────────────
export function reminderEmail({ user, reminder }) {
  const when = fmtDateTime(reminder.remind_at);
  const title = `🔔 Recordatorio: ${reminder.title}`;
  const lines = [
    { label: "Cuándo", value: when, text: when },
    reminder.body
      ? { label: "Notas", value: reminder.body, text: reminder.body }
      : null,
  ];
  return {
    subject: title,
    html: layout({
      title,
      intro: `Hola${user?.name ? " " + user.name.split(" ")[0] : ""}, este es tu recordatorio personal.`,
      lines,
      ctaHref: deepLink("/?view=mitrabajo"),
      ctaLabel: "Abrir el CRM",
    }),
    text:
      `${title}\n\n` +
      `Hola${user?.name ? " " + user.name.split(" ")[0] : ""}, este es tu recordatorio personal.\n\n` +
      lineList(lines) +
      (APP_BASE_URL ? `\n\n${deepLink("/?view=mitrabajo")}` : "") +
      `\n\n— ${BRAND}`,
  };
}

// ─── Tareas: helpers comunes ──────────────────────────────────────
function taskLines(task, { clientName, when }) {
  return [
    { label: "Cliente",    value: clientName || "—", text: clientName || "—" },
    when ? { label: "Cuándo", value: when, text: when } : null,
    task.priority ? { label: "Prioridad", value: task.priority, text: task.priority } : null,
    task.status   ? { label: "Estado",    value: task.status,   text: task.status }   : null,
    task.notes    ? { label: "Notas",     value: task.notes,    text: task.notes }    : null,
  ];
}

function taskWhen(task) {
  if (task?.date && task?.start_time) {
    const [h, m] = String(task.start_time).split(":");
    return `${fmtDate(task.date)} a las ${h}:${m || "00"}`;
  }
  if (task?.date) return fmtDate(task.date);
  return "Sin fecha asignada";
}

// ─── Email: tarea asignada ────────────────────────────────────────
export function taskAssignedEmail({ user, task, clientName, assignerName }) {
  const when = taskWhen(task);
  const title = `📝 Te han asignado: ${task.title}`;
  const intro =
    `Hola${user?.name ? " " + user.name.split(" ")[0] : ""}, ` +
    (assignerName ? `${assignerName} ` : "") +
    `te ha asignado una tarea.`;
  const lines = taskLines(task, { clientName, when });
  return {
    subject: title,
    html: layout({
      title,
      intro,
      lines,
      ctaHref: deepLink(`/?task=${encodeURIComponent(task.id)}`),
      ctaLabel: "Ver tarea",
    }),
    text:
      `${title}\n\n${intro}\n\n` +
      lineList(lines) +
      (APP_BASE_URL ? `\n\n${deepLink(`/?task=${task.id}`)}` : "") +
      `\n\n— ${BRAND}`,
  };
}

// ─── Email: recordatorio antes del inicio de una tarea ────────────
// `user` se acepta por simetría con el resto de plantillas (la firma uniforme
// facilita pasar el destinatario sin pensar en cuál usa qué); el cuerpo no lo
// necesita porque el "to" lo añade el caller en `sendMail`.
// eslint-disable-next-line no-unused-vars
export function taskReminderEmail({ user, task, clientName, leadMinutes }) {
  const when = taskWhen(task);
  const title = `⏰ Próxima tarea: ${task.title}`;
  const intro =
    leadMinutes
      ? `Tu tarea empieza en ${leadMinutes} minutos.`
      : `Tu tarea está a punto de empezar.`;
  const lines = taskLines(task, { clientName, when });
  return {
    subject: title,
    html: layout({
      title,
      intro,
      lines,
      ctaHref: deepLink(`/?task=${encodeURIComponent(task.id)}`),
      ctaLabel: "Ver tarea",
    }),
    text:
      `${title}\n\n${intro}\n\n` +
      lineList(lines) +
      (APP_BASE_URL ? `\n\n${deepLink(`/?task=${task.id}`)}` : "") +
      `\n\n— ${BRAND}`,
  };
}

// ─── Email: cambios en una tarea ya asignada ──────────────────────
// Igual que `taskReminderEmail`: `user` se acepta para que las llamadas
// queden uniformes desde `taskNotifs.js`, aunque el render no lo use.
// eslint-disable-next-line no-unused-vars
export function taskChangedEmail({ user, task, clientName, changes }) {
  const when = taskWhen(task);
  const title = `✏️ Cambios en tu tarea: ${task.title}`;
  const intro = `Se han actualizado detalles que te afectan.`;
  const changesHtml = (changes || [])
    .map(
      (c) =>
        `<li style="margin:4px 0;color:#374151;">
          <strong>${escapeHtml(c.label)}:</strong>
          ${escapeHtml(c.from || "—")} <span style="color:#9ca3af;">→</span> ${escapeHtml(c.to || "—")}
        </li>`
    )
    .join("");
  const lines = [
    ...(changesHtml
      ? [{
          label: "Cambios",
          html: `<ul style="margin:0;padding-left:18px;">${changesHtml}</ul>`,
        }]
      : []),
    ...taskLines(task, { clientName, when }),
  ];
  return {
    subject: title,
    html: layout({ title, intro, lines, ctaHref: deepLink(`/?task=${encodeURIComponent(task.id)}`), ctaLabel: "Ver tarea" }),
    text:
      `${title}\n\n${intro}\n\n` +
      (changes || []).map((c) => `• ${c.label}: ${c.from || "—"} → ${c.to || "—"}`).join("\n") +
      "\n\n" +
      lineList(taskLines(task, { clientName, when })) +
      (APP_BASE_URL ? `\n\n${deepLink(`/?task=${task.id}`)}` : "") +
      `\n\n— ${BRAND}`,
  };
}
