// ============================================================
// Plantillas de email (HTML + texto plano)
// ============================================================
// Todo el HTML usa estilos inline porque la mayoría de clientes (Outlook,
// Gmail) ignoran `<style>` o lo procesan de forma inconsistente. Mantén las
// plantillas simples: la fiabilidad pesa más que la estética. Pero se
// pueden hacer cosas elegantes con tablas + estilos inline si te ciñes a
// los subset que respetan los grandes clientes.
//
// Filosofía de diseño:
//   - Brand strip de 4px arriba (azul de marca) para identidad visual.
//   - Header con nombre de la app + tagline.
//   - Kicker (etiqueta UPPERCASE pequeña) sobre el título grande,
//     pattern habitual en correos de SaaS modernos (Linear, Notion,
//     Stripe). Ayuda a entender "de qué va este email" en 1s.
//   - Data card con fondo gris suave para destacar los datos clave;
//     status y priority como BADGES coloreados (no texto plano).
//   - CTA grande centrado + fallback URL en gris.
//   - Footer minimal con enlace de preferencias.
//
// Se mantiene toda la lógica anterior (deepLink, escapeHtml, etc.)
// para no romper consumidores; sólo cambia el HTML producido.
// ============================================================

import { APP_BASE_URL } from "./mailer.js";

const BRAND        = "CRM Visitas · Smartgroup";
const BRAND_TAG    = "Operaciones · Soporte técnico";
const BRAND_COLOR  = "#2563eb";
const HEADER_BG    = "#0f172a";   // navy oscuro, mismo que el sidebar de la app

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

// ─── Badge para status / priority ──────────────────────────────────
// Mapeo de valor → colores semánticos. Los hex están elegidos para que
// pasen WCAG AA contraste contra su propio bg incluso en clientes con
// dark mode forzado (los grandes clientes de email NO respetan
// prefers-color-scheme dentro del cuerpo HTML, así que no hay que
// preocuparse de dos tonalidades — el "tema" del email se queda fijo).
const BADGE_STYLES = {
  // Prioridades
  "Alta":        { bg: "#fee2e2", color: "#991b1b" },
  "Media":       { bg: "#fef3c7", color: "#92400e" },
  "Baja":        { bg: "#e0e7ef", color: "#475569" },
  // Estados
  "No iniciado": { bg: "#e5e7eb", color: "#374151" },
  "En curso":    { bg: "#fef3c7", color: "#92400e" },
  "Listo":       { bg: "#d1fae5", color: "#065f46" },
  "Bloqueado":   { bg: "#fee2e2", color: "#991b1b" },
};

function badge(value) {
  if (!value) return "—";
  const s = BADGE_STYLES[value] || { bg: "#e5e7eb", color: "#374151" };
  return `<span style="display:inline-block;padding:3px 10px;
                       background:${s.bg};color:${s.color};
                       border-radius:99px;font-size:12px;font-weight:600;
                       letter-spacing:0.2px;">${escapeHtml(value)}</span>`;
}

/**
 * CTA button: el corazón del email. Centrado vía <table align="center">
 * (Outlook ignora a veces text-align en divs sueltos). Padding generoso
 * para tap-target cómodo en móvil. Sufijo "→" para indicar acción.
 */
function btn(href, label) {
  if (!href) return "";
  const safeHref  = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
    <tr><td align="center" style="border-radius:8px;background:${BRAND_COLOR};
                                  box-shadow:0 2px 6px rgba(37,99,235,0.25);">
      <a href="${safeHref}"
         style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;
                text-decoration:none;padding:14px 32px;border-radius:8px;
                font-weight:700;font-size:15px;font-family:inherit;
                letter-spacing:0.2px;line-height:1;">
        ${safeLabel} <span style="display:inline-block;margin-left:4px;">→</span>
      </a>
    </td></tr>
  </table>`;
}

/**
 * Renderiza una fila de datos del cuerpo (label + valor). El valor
 * puede venir ya como HTML (badge) o como texto plano que escapamos.
 */
function dataRow(label, value, isHtml = false) {
  return `<tr>
    <td style="color:#6b7280;font-size:12.5px;font-weight:500;
               padding:9px 14px 9px 0;width:110px;vertical-align:top;
               border-bottom:1px solid #f1f5f9;">${escapeHtml(label)}</td>
    <td style="color:#111827;font-size:14px;
               padding:9px 0;vertical-align:top;
               border-bottom:1px solid #f1f5f9;line-height:1.5;">
      ${isHtml ? value : escapeHtml(value || "—")}
    </td>
  </tr>`;
}

/**
 * Layout principal de los correos.
 *
 * Props:
 *  - title    {string}   título grande (h1)
 *  - kicker   {string?}  etiqueta UPPERCASE pequeña sobre el título
 *  - intro    {string?}  párrafo introductorio
 *  - lines    {Array<{label, value, html, badge}>?}
 *                         label: nombre del campo
 *                         value: valor en texto plano
 *                         html:  reemplazo HTML del valor (tiene
 *                                preferencia sobre value)
 *                         badge: si true, valor se renderiza como
 *                                badge coloreado (status/priority)
 *  - notes    {string?}   notas largas que se muestran como párrafo
 *                         debajo de la data card (por su tamaño no
 *                         encajan bien como fila)
 *  - ctaHref  {string?}   URL del botón principal
 *  - ctaLabel {string?}   texto del botón
 *  - footerNote {string?} sustituye el texto del footer
 */
function layout({ title, kicker, intro, lines, notes, ctaHref, ctaLabel, footerNote }) {
  const dataLines = (lines || [])
    .filter(Boolean)
    .map((l) => {
      if (l.html)  return dataRow(l.label, l.html, true);
      if (l.badge) return dataRow(l.label, badge(l.value), true);
      return dataRow(l.label, l.value);
    })
    .join("");

  const dataCard = dataLines
    ? `<div style="background:#f9fafb;border:1px solid #f1f5f9;
                   border-radius:10px;padding:4px 16px;margin:18px 0 0;">
         <table role="presentation" cellpadding="0" cellspacing="0"
                style="width:100%;border-collapse:collapse;">
           ${dataLines}
         </table>
       </div>`
    : "";

  // Bloque de notas largas (si lo pasamos): cita con borde lateral
  // azul, para diferenciarlo del resto del contenido.
  const notesBlock = notes
    ? `<div style="margin:16px 0 0;padding:12px 14px;
                   background:#f8fafc;border-left:3px solid ${BRAND_COLOR};
                   border-radius:0 6px 6px 0;color:#374151;font-size:13.5px;
                   line-height:1.55;white-space:pre-wrap;">
         ${escapeHtml(notes)}
       </div>`
    : "";

  // CTA: botón grande + fallback URL en pequeño debajo. Sólo se
  // renderiza si hay ctaHref (si APP_BASE_URL no está definida,
  // deepLink devuelve "" y el bloque se omite limpiamente).
  const cta = ctaHref
    ? `<div style="margin:30px 0 6px;text-align:center;">
         ${btn(ctaHref, ctaLabel || "Abrir en el CRM")}
       </div>
       <p style="margin:12px 0 0;text-align:center;color:#9ca3af;
                 font-size:11.5px;line-height:1.5;">
         ¿No funciona el botón? Copia y pega esta URL:<br>
         <a href="${escapeHtml(ctaHref)}" style="color:#6b7280;
              text-decoration:underline;word-break:break-all;">${escapeHtml(ctaHref)}</a>
       </p>`
    : "";

  const kickerHtml = kicker
    ? `<p style="margin:0 0 4px;color:${BRAND_COLOR};font-size:11.5px;
                 font-weight:700;text-transform:uppercase;letter-spacing:1px;">
         ${escapeHtml(kicker)}
       </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
             color:#0f172a;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#eef2f7;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:580px;background:#ffffff;border-radius:12px;
                    box-shadow:0 4px 16px rgba(15,23,42,0.06),
                               0 1px 3px rgba(15,23,42,0.04);
                    overflow:hidden;">

        <!-- Brand strip arriba: 4px de azul, marca de identidad
             que distingue el correo "del CRM" de cualquier otro. -->
        <tr><td style="height:4px;background:${BRAND_COLOR};line-height:4px;font-size:0;">&nbsp;</td></tr>

        <!-- Header: nombre app + tagline. Fondo navy, mismo que la
             sidebar de la app para coherencia visual.            -->
        <tr><td style="background:${HEADER_BG};padding:18px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
            <tr>
              <td style="vertical-align:middle;">
                <div style="color:#ffffff;font-weight:700;font-size:15px;
                            letter-spacing:0.4px;line-height:1.2;">
                  ${escapeHtml(BRAND)}
                </div>
                <div style="color:rgba(255,255,255,0.55);font-size:11.5px;
                            font-weight:500;margin-top:2px;letter-spacing:0.3px;">
                  ${escapeHtml(BRAND_TAG)}
                </div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Contenido principal -->
        <tr><td style="padding:28px 28px 24px;">
          ${kickerHtml}
          <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;
                     color:#0f172a;font-weight:700;letter-spacing:-0.2px;">
            ${escapeHtml(title)}
          </h1>
          ${intro
            ? `<p style="margin:0 0 6px;color:#374151;font-size:14px;line-height:1.55;">
                 ${escapeHtml(intro)}
               </p>`
            : ""}
          ${dataCard}
          ${notesBlock}
          ${cta}
        </td></tr>

        <!-- Footer minimal. Si APP_BASE_URL existe, enlace inline
             a "Gestionar mis preferencias" (lleva al home de la
             app — desde ahí el usuario abre Preferencias).      -->
        <tr><td style="padding:16px 28px 22px;background:#fafbfc;
                       color:#9ca3af;font-size:11.5px;line-height:1.6;
                       border-top:1px solid #f1f5f9;">
          ${escapeHtml(footerNote || "Recibes este correo porque tienes notificaciones activas en el CRM.")}
          ${APP_BASE_URL
            ? ` <a href="${escapeHtml(APP_BASE_URL)}" style="color:#6b7280;text-decoration:underline;">Gestionar mis preferencias</a>.`
            : ""}
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

function lineList(lines) {
  // Versión texto plano de las mismas líneas. Para clientes que sólo
  // muestran multipart/alternative en text mode, o filtros de spam que
  // pesan más cuando el text body coincide con el HTML.
  return (lines || [])
    .filter(Boolean)
    .map((l) => `${l.label}: ${l.text || l.value || ""}`)
    .join("\n");
}

function deepLink(path) {
  if (!APP_BASE_URL) return "";
  return APP_BASE_URL + path;
}

// ─── Tareas: helpers comunes ──────────────────────────────────────
function taskLines(task, { clientName, when }) {
  return [
    { label: "Cliente",   value: clientName || "—",     text: clientName || "—" },
    when ? { label: "Cuándo", value: when, text: when } : null,
    task.priority ? { label: "Prioridad", value: task.priority, text: task.priority, badge: true } : null,
    task.status   ? { label: "Estado",    value: task.status,   text: task.status,   badge: true } : null,
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

// ─── Recordatorios personales ─────────────────────────────────────
export function reminderEmail({ user, reminder }) {
  const when = fmtDateTime(reminder.remind_at);
  const title = reminder.title;
  const lines = [
    { label: "Cuándo", value: when, text: when },
  ];
  return {
    subject: `🔔 Recordatorio: ${reminder.title}`,
    html: layout({
      title,
      kicker: "🔔 Recordatorio personal",
      intro: `Hola${user?.name ? " " + user.name.split(" ")[0] : ""}, este es el recordatorio que programaste.`,
      lines,
      notes: reminder.body || null,
      ctaHref: deepLink("/?view=mitrabajo"),
      ctaLabel: "Abrir el CRM",
    }),
    text:
      `🔔 Recordatorio: ${title}\n\n` +
      `Hola${user?.name ? " " + user.name.split(" ")[0] : ""}, este es el recordatorio que programaste.\n\n` +
      lineList(lines) +
      (reminder.body ? `\nNotas: ${reminder.body}` : "") +
      (APP_BASE_URL ? `\n\n${deepLink("/?view=mitrabajo")}` : "") +
      `\n\n— ${BRAND}`,
  };
}

// ─── Email: tarea asignada ────────────────────────────────────────
export function taskAssignedEmail({ user, task, clientName, assignerName }) {
  const when = taskWhen(task);
  const title = task.title;
  const intro =
    `Hola${user?.name ? " " + user.name.split(" ")[0] : ""}, ` +
    (assignerName ? `${assignerName} ` : "") +
    `te ha asignado una tarea.`;
  const lines = taskLines(task, { clientName, when });
  return {
    subject: `📝 Te han asignado: ${task.title}`,
    html: layout({
      title,
      kicker: "📝 Tarea asignada",
      intro,
      lines,
      notes: task.notes || null,
      ctaHref: deepLink(`/?task=${encodeURIComponent(task.id)}`),
      ctaLabel: "Ver tarea",
    }),
    text:
      `📝 Te han asignado: ${title}\n\n${intro}\n\n` +
      lineList(lines) +
      (task.notes ? `\nNotas: ${task.notes}` : "") +
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
  const title = task.title;
  const intro =
    leadMinutes
      ? `Tu tarea empieza en ${leadMinutes} minutos.`
      : `Tu tarea está a punto de empezar.`;
  const lines = taskLines(task, { clientName, when });
  return {
    subject: `⏰ Próxima tarea: ${task.title}`,
    html: layout({
      title,
      kicker: "⏰ Próxima tarea",
      intro,
      lines,
      notes: task.notes || null,
      ctaHref: deepLink(`/?task=${encodeURIComponent(task.id)}`),
      ctaLabel: "Ver tarea",
    }),
    text:
      `⏰ Próxima tarea: ${title}\n\n${intro}\n\n` +
      lineList(lines) +
      (task.notes ? `\nNotas: ${task.notes}` : "") +
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
  const title = task.title;
  const intro = `Se han actualizado detalles que te afectan.`;

  // Cambios como lista bonita: cada uno con label en negrita + flecha
  // visual entre el valor antiguo (tachado, gris) y el nuevo (negro).
  const changesHtml = (changes || [])
    .map(
      (c) =>
        `<li style="margin:6px 0;color:#374151;font-size:13.5px;line-height:1.5;">
          <strong style="color:#0f172a;">${escapeHtml(c.label)}:</strong>
          <span style="color:#9ca3af;text-decoration:line-through;text-decoration-color:#cbd5e1;">${escapeHtml(c.from || "—")}</span>
          <span style="color:#9ca3af;margin:0 4px;">→</span>
          <strong style="color:#0f172a;">${escapeHtml(c.to || "—")}</strong>
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
    subject: `✏️ Cambios en tu tarea: ${task.title}`,
    html: layout({
      title,
      kicker: "✏️ Tarea actualizada",
      intro,
      lines,
      notes: task.notes || null,
      ctaHref: deepLink(`/?task=${encodeURIComponent(task.id)}`),
      ctaLabel: "Ver tarea",
    }),
    text:
      `✏️ Cambios en tu tarea: ${title}\n\n${intro}\n\n` +
      (changes || []).map((c) => `• ${c.label}: ${c.from || "—"} → ${c.to || "—"}`).join("\n") +
      "\n\n" +
      lineList(taskLines(task, { clientName, when })) +
      (task.notes ? `\nNotas: ${task.notes}` : "") +
      (APP_BASE_URL ? `\n\n${deepLink(`/?task=${task.id}`)}` : "") +
      `\n\n— ${BRAND}`,
  };
}
