// ============================================================
// Adapter de email
// ============================================================
// Encapsula el envío de correo en una única función `sendMail` para que el
// resto del backend no dependa del proveedor concreto.
//
// Estrategia actual: SMTP autenticado vía nodemailer.
// Está pensado para tirar contra Microsoft 365 (Exchange Online) con un buzón
// dedicado tipo `crm-noreply@<tu-dominio>` y SMTP AUTH habilitado en el
// tenant — pero las mismas variables sirven para cualquier proveedor SMTP
// (Gmail con App Password, SES, Mailgun, Postmark, Resend SMTP, etc.).
//
// Variables de entorno
//   MAIL_HOST       smtp.office365.com           // host SMTP
//   MAIL_PORT       587                          // 587 STARTTLS / 465 SMTPS
//   MAIL_SECURE     false                        // true sólo si usas 465
//   MAIL_USER       crm-noreply@tu-dominio.es    // usuario SMTP
//   MAIL_PASS       <app password / contraseña>  // contraseña SMTP
//   MAIL_FROM       "CRM Visitas <crm-noreply@tu-dominio.es>"
//   APP_BASE_URL    https://crm.tu-dominio.es    // para deep links
//
// Si MAIL_HOST no está definido, entramos en modo "dry-run": el correo se
// loguea (asunto + destinatarios + primeros chars del cuerpo) en vez de
// enviarse. Permite trabajar en local sin tirar mensajes reales y sirve de
// fallback seguro si la config se queda incompleta en producción (mejor no
// enviar nada que reventar todos los handlers).
//
// Notas Microsoft 365
//   - Tenants modernos suelen tener Basic/SMTP AUTH deshabilitado por
//     defecto. Para que esto funcione hay que habilitar "Authenticated
//     SMTP" en el buzón concreto (Exchange admin → Mailbox → Manage email
//     apps → Authenticated SMTP) Y tener Security Defaults compatibles
//     o app password si se usa MFA.
//   - El campo `from` debe coincidir con el usuario autenticado o con
//     una dirección con permiso "Send As" — Exchange rechaza spoofing.
//   - Si tu tenant tiene SMTP AUTH globalmente bloqueado, la alternativa
//     es Microsoft Graph API (`/users/{id}/sendMail`) con OAuth2 client
//     credentials. Encapsulado aquí, sólo tendríamos que añadir un
//     adapter "graph" y elegir según una variable. Lo dejamos preparado
//     para una iteración posterior.
// ============================================================

import nodemailer from "nodemailer";
import { logger } from "./logger.js";

const MAIL_HOST   = process.env.MAIL_HOST || "";
const MAIL_PORT   = Number(process.env.MAIL_PORT) || 587;
const MAIL_SECURE = String(process.env.MAIL_SECURE || "").toLowerCase() === "true";
const MAIL_USER   = process.env.MAIL_USER || "";
const MAIL_PASS   = process.env.MAIL_PASS || "";
const MAIL_FROM   = process.env.MAIL_FROM || (MAIL_USER ? `CRM Visitas <${MAIL_USER}>` : "");

export const APP_BASE_URL = (process.env.APP_BASE_URL || "").replace(/\/+$/, "");

let transporter = null;
let mode = "disabled"; // "smtp" | "dry-run" | "disabled"

if (MAIL_HOST && MAIL_USER && MAIL_PASS) {
  transporter = nodemailer.createTransport({
    host: MAIL_HOST,
    port: MAIL_PORT,
    secure: MAIL_SECURE,                // 465 → true; 587 STARTTLS → false
    auth: { user: MAIL_USER, pass: MAIL_PASS },
    // Algunas configuraciones de Office 365 fallan el handshake STARTTLS si
    // no se permite TLS 1.2+ explícitamente. Forzamos minVersion para evitar
    // sustos con servidores antiguos en proxies intermedios.
    tls: { minVersion: "TLSv1.2" },
  });
  mode = "smtp";
  logger.info({ host: MAIL_HOST, port: MAIL_PORT, user: MAIL_USER }, "[mailer] SMTP listo");
} else if (MAIL_HOST || MAIL_USER || MAIL_PASS) {
  // Configuración a medias: avisamos para que no pase desapercibido.
  mode = "dry-run";
  logger.warn(
    { hasHost: !!MAIL_HOST, hasUser: !!MAIL_USER, hasPass: !!MAIL_PASS },
    "[mailer] configuración SMTP incompleta; entrando en modo dry-run"
  );
} else {
  mode = "dry-run";
  logger.info("[mailer] sin MAIL_HOST; modo dry-run (los emails se loguean, no se envían)");
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

  if (mode !== "smtp") {
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
    logger.info(
      { to, subject, messageId: info?.messageId },
      "[mailer] enviado"
    );
    return { ok: true, mode, messageId: info?.messageId };
  } catch (err) {
    logger.error({ err, to, subject }, "[mailer] error enviando");
    return { ok: false, mode, error: err?.message || "send_failed" };
  }
}

export function getMailerMode() {
  return mode;
}

// ─── Verificación opcional (smoke test al arrancar) ────────────────
// Si el operador define MAIL_VERIFY=true, hacemos un transporter.verify()
// al arrancar para detectar credenciales mal configuradas inmediatamente
// (típico problema con SMTP AUTH bloqueado en M365). Por defecto no lo
// hacemos: nodemailer abre la conexión perezosamente al primer envío.
export async function verifyMailer() {
  if (mode !== "smtp" || !transporter) return { ok: true, mode };
  try {
    await transporter.verify();
    logger.info("[mailer] verify OK");
    return { ok: true, mode };
  } catch (err) {
    logger.error({ err }, "[mailer] verify falló");
    return { ok: false, mode, error: err?.message || "verify_failed" };
  }
}
