// ============================================================
// Adapter de email
// ============================================================
// Encapsula el envío de correo en una única función `sendMail` para que el
// resto del backend no dependa del proveedor concreto.
//
// Soporta DOS modos de envío, elegidos automáticamente según las env vars:
//
//   1. Brevo HTTP API (recomendado en cloud / VPS con outbound SMTP
//      bloqueado): usa POST https://api.brevo.com/v3/smtp/email vía
//      HTTPS/443 — ningún firewall razonable bloquea ese puerto. Los
//      correos salen desde la infraestructura de Brevo (con buena
//      reputación de IP), pero el `from` sigue siendo TUYO porque
//      autorizas el sender en el dashboard de Brevo.
//
//   2. SMTP autenticado vía nodemailer (Office 365, Gmail, Arsys,
//      Postmark, Mailgun…): conexión TCP directa al servidor SMTP en
//      465/587. Requiere que el host pueda hacer outbound al puerto.
//
// Si NINGUNA configuración está completa, modo "dry-run": el correo se
// loguea pero no se envía. Útil en local o en preview deployments para
// no spamear.
//
// Variables de entorno (modo Brevo)
//   BREVO_API_KEY    xkeysib-...                  // API key de Brevo
//   MAIL_FROM        "Smartgroup CRM <instalaciones@smartgroup.es>"
//
// Variables de entorno (modo SMTP)
//   MAIL_HOST        smtp.serviciodecorreo.es     // host SMTP
//   MAIL_PORT        587                          // 587 STARTTLS / 465 SMTPS
//   MAIL_SECURE      false                        // true sólo si usas 465
//   MAIL_USER        instalaciones@smartgroup.es  // usuario SMTP
//   MAIL_PASS        <app password / contraseña>  // contraseña SMTP
//   MAIL_FROM        "Smartgroup CRM <instalaciones@smartgroup.es>"
//
// Comunes
//   APP_BASE_URL     https://crm-visitas.api2smart.com  // para deep links
//
// Precedencia: Brevo gana si BREVO_API_KEY está definido. Para volver a
// SMTP, basta con quitar BREVO_API_KEY y dejar las MAIL_* configuradas.
// ============================================================

import nodemailer from "nodemailer";
import { logger } from "./logger.js";

// ─── Brevo ──────────────────────────────────────────────────────
const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

// ─── SMTP ───────────────────────────────────────────────────────
const MAIL_HOST   = process.env.MAIL_HOST || "";
const MAIL_PORT   = Number(process.env.MAIL_PORT) || 587;
const MAIL_SECURE = String(process.env.MAIL_SECURE || "").toLowerCase() === "true";
const MAIL_USER   = process.env.MAIL_USER || "";
const MAIL_PASS   = process.env.MAIL_PASS || "";

// ─── Comunes ────────────────────────────────────────────────────
const MAIL_FROM   = process.env.MAIL_FROM || (MAIL_USER ? `CRM Visitas <${MAIL_USER}>` : "");

export const APP_BASE_URL = (process.env.APP_BASE_URL || "").replace(/\/+$/, "");

let transporter = null;
let mode = "disabled"; // "brevo" | "smtp" | "dry-run" | "disabled"

if (BREVO_API_KEY && MAIL_FROM) {
  // Modo preferente: Brevo HTTP. No abre conexión TCP directa, así que
  // funciona aunque el VPS bloquee outbound SMTP.
  mode = "brevo";
  logger.info({ from: MAIL_FROM }, "[mailer] Brevo HTTP listo");
} else if (MAIL_HOST && MAIL_USER && MAIL_PASS) {
  transporter = nodemailer.createTransport({
    host: MAIL_HOST,
    port: MAIL_PORT,
    secure: MAIL_SECURE,                // 465 → true; 587 STARTTLS → false
    auth: { user: MAIL_USER, pass: MAIL_PASS },
    // Algunas configuraciones de Office 365 fallan el handshake STARTTLS si
    // no se permite TLS 1.2+ explícitamente. Forzamos minVersion para evitar
    // sustos con servidores antiguos en proxies intermedios.
    tls: { minVersion: "TLSv1.2" },
    // Timeouts agresivos: el default de nodemailer es ~10 min, lo que
    // significa que cuando un firewall bloquea outbound SMTP la app se
    // queda 10 min con la request en espera y los workers de pg-boss
    // bloqueados. Bajamos a 8s para que falle rápido — entre 8 y 10s ya
    // sabemos si la conexión va o no, y el usuario ve el error pronto
    // en lugar de un spinner eterno.
    connectionTimeout: 8_000,
    greetingTimeout:   8_000,
    socketTimeout:    15_000,
  });
  mode = "smtp";
  logger.info({ host: MAIL_HOST, port: MAIL_PORT, user: MAIL_USER }, "[mailer] SMTP listo");
} else if (MAIL_HOST || MAIL_USER || MAIL_PASS || BREVO_API_KEY) {
  // Configuración a medias: avisamos para que no pase desapercibido.
  mode = "dry-run";
  logger.warn(
    {
      hasBrevoKey: !!BREVO_API_KEY,
      hasFrom: !!MAIL_FROM,
      hasHost: !!MAIL_HOST,
      hasUser: !!MAIL_USER,
      hasPass: !!MAIL_PASS,
    },
    "[mailer] configuración incompleta; entrando en modo dry-run"
  );
} else {
  mode = "dry-run";
  logger.info("[mailer] sin proveedor configurado; modo dry-run (los emails se loguean, no se envían)");
}

// ─── Parser "Name <email>" → { name, email } ─────────────────────
// Brevo necesita los campos sender/to como objetos {email, name?}.
// Aceptamos los formatos típicos de cabecera SMTP:
//   "Foo Bar <foo@bar.com>"     →  { name: "Foo Bar", email: "foo@bar.com" }
//   "<foo@bar.com>"             →  { email: "foo@bar.com" }
//   "foo@bar.com"               →  { email: "foo@bar.com" }
function parseAddress(addr) {
  if (!addr) return null;
  const s = String(addr).trim();
  const m = s.match(/^\s*(?:"?([^"<]+?)"?\s*)?<\s*([^>]+?)\s*>\s*$/);
  if (m) {
    const name = (m[1] || "").trim();
    return name ? { name, email: m[2] } : { email: m[2] };
  }
  return { email: s };
}

function toRecipients(to) {
  const list = Array.isArray(to) ? to : [to];
  return list
    .map(parseAddress)
    .filter((x) => x && x.email);
}

// ─── Envío vía Brevo HTTP API ────────────────────────────────────
async function sendViaBrevo({ to, subject, html, text, replyTo, headers }) {
  const sender = parseAddress(MAIL_FROM);
  if (!sender) {
    return { ok: false, mode: "brevo", error: "MAIL_FROM no válido" };
  }
  const recipients = toRecipients(to);
  if (recipients.length === 0) {
    return { ok: false, mode: "brevo", error: "no_recipients" };
  }

  const body = {
    sender,
    to: recipients,
    subject,
    htmlContent: html || (text ? `<pre style="font-family:inherit;white-space:pre-wrap">${text}</pre>` : "<p></p>"),
    textContent: text || undefined,
    replyTo: replyTo ? parseAddress(replyTo) : undefined,
    headers: headers && Object.keys(headers).length > 0 ? headers : undefined,
  };

  // AbortController nos da el equivalente HTTP del connectionTimeout de
  // nodemailer. Si Brevo no responde en 8s, abortamos. En la práctica
  // tarda 200-500 ms; cualquier cosa por encima de 5s es síntoma de
  // problema de red.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8_000);

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    // Brevo devuelve 201 con `{ messageId }` en éxito y 4xx/5xx con
    // `{ code, message }` en error. Capturamos JSON con tolerancia: si
    // por algún motivo no es JSON, igual devolvemos el cuerpo crudo
    // truncado para diagnosticar.
    let data = null;
    try { data = await res.json(); }
    catch { data = { message: await res.text().catch(() => "").then((t) => t.slice(0, 500)) }; }

    if (!res.ok) {
      const msg = data?.message || data?.code || `HTTP ${res.status}`;
      logger.error(
        { status: res.status, code: data?.code, msg, to: recipients.map((r) => r.email), subject },
        "[mailer:brevo] error enviando"
      );
      return { ok: false, mode: "brevo", error: msg };
    }

    logger.info(
      { to: recipients.map((r) => r.email), subject, messageId: data?.messageId },
      "[mailer:brevo] enviado"
    );
    return { ok: true, mode: "brevo", messageId: data?.messageId };
  } catch (err) {
    clearTimeout(timer);
    const reason = err?.name === "AbortError" ? "timeout (8s)" : (err?.message || "send_failed");
    logger.error({ err, to: recipients.map((r) => r.email), subject }, "[mailer:brevo] error red");
    return { ok: false, mode: "brevo", error: reason };
  }
}

// ─── Envío vía SMTP (nodemailer) ─────────────────────────────────
async function sendViaSmtp({ to, subject, html, text, replyTo, headers }) {
  try {
    const info = await transporter.sendMail({
      from: MAIL_FROM,
      to,
      subject,
      html,
      text,
      replyTo,
      headers,
    });
    logger.info({ to, subject, messageId: info?.messageId }, "[mailer] enviado");
    return { ok: true, mode: "smtp", messageId: info?.messageId };
  } catch (err) {
    logger.error({ err, to, subject }, "[mailer] error enviando");
    return { ok: false, mode: "smtp", error: err?.message || "send_failed" };
  }
}

/**
 * Envía un email. Devuelve `{ ok, mode, messageId? }`.
 * Nunca lanza: registra el error y devuelve `{ ok: false }` para que el
 * caller (worker, handler) decida si reintenta sin tumbar el flujo.
 */
export async function sendMail({ to, subject, html, text, replyTo, headers }) {
  if (!to || (Array.isArray(to) && to.length === 0)) {
    logger.warn({ subject }, "[mailer] sendMail sin destinatarios; ignorado");
    return { ok: false, mode, reason: "no_recipients" };
  }

  if (mode === "brevo") {
    return sendViaBrevo({ to, subject, html, text, replyTo, headers });
  }

  if (mode === "smtp") {
    return sendViaSmtp({ to, subject, html, text, replyTo, headers });
  }

  // dry-run / disabled
  logger.info(
    {
      to: Array.isArray(to) ? to : [to],
      subject,
      bodyPreview: (text || html || "").slice(0, 160),
    },
    "[mailer:dry-run] (no enviado)"
  );
  return { ok: true, mode: "dry-run" };
}

export function getMailerMode() {
  return mode;
}

// ─── Verificación opcional (smoke test al arrancar) ────────────────
// Si el operador define MAIL_VERIFY=true, comprobamos credenciales al
// arrancar para detectar fallos inmediatamente.
//   - Brevo: hacemos GET /v3/account (endpoint barato que requiere
//     api-key válida).
//   - SMTP: nodemailer.transporter.verify().
export async function verifyMailer() {
  if (mode === "brevo") {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8_000);
      const res = await fetch("https://api.brevo.com/v3/account", {
        headers: { "api-key": BREVO_API_KEY, "accept": "application/json" },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data?.message || `HTTP ${res.status}`;
        logger.error({ status: res.status, msg }, "[mailer:brevo] verify falló");
        return { ok: false, mode, error: msg };
      }
      logger.info("[mailer:brevo] verify OK");
      return { ok: true, mode };
    } catch (err) {
      const reason = err?.name === "AbortError" ? "timeout (8s)" : (err?.message || "verify_failed");
      logger.error({ err }, "[mailer:brevo] verify falló");
      return { ok: false, mode, error: reason };
    }
  }
  if (mode === "smtp" && transporter) {
    try {
      await transporter.verify();
      logger.info("[mailer] verify OK");
      return { ok: true, mode };
    } catch (err) {
      logger.error({ err }, "[mailer] verify falló");
      return { ok: false, mode, error: err?.message || "verify_failed" };
    }
  }
  return { ok: true, mode };
}
