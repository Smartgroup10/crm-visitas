import { Router } from "express";
import bcrypt from "bcryptjs";
import { query } from "../db.js";
import { signToken, authMiddleware } from "../auth.js";
import { logger } from "../logger.js";
import { schemas, validate } from "../schemas.js";
import { sendMail, getMailerMode } from "../mailer.js";

export const authRouter = Router();

// Helper: forma pública del usuario (sin password_hash). Incluye las
// preferencias de notificación porque el frontend las lee al arrancar para
// pintar el panel de preferencias y decidir si mostrar avisos.
function publicMe(row) {
  return {
    id:                   row.id,
    email:                row.email,
    name:                 row.name,
    role:                 row.role,
    notify_email_enabled: row.notify_email_enabled ?? true,
    notify_lead_minutes:  row.notify_lead_minutes ?? 60,
  };
}

// ─── POST /api/auth/login ─────────────────────────────────
authRouter.post("/login", validate(schemas.login), async (req, res) => {
  try {
    // email ya viene trim + lowercase aplicados por el schema
    const { email, password } = req.body;

    const { rows } = await query(
      "select id, email, password_hash, name, role from users where email = $1",
      [email]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Credenciales inválidas" });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Credenciales inválidas" });

    const payload = {
      id:    user.id,
      email: user.email,
      name:  user.name,
      role:  user.role,
    };
    const token = signToken(payload);
    res.json({ token, user: payload });
  } catch (err) {
    logger.error({ err }, "[auth/login]");
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ─── GET /api/auth/me ────────────────────────────────────
// Devuelve el perfil leído fresco de BD, no el del JWT (que está cacheado
// hasta 7 días). Si un admin te promueve o degrada, el frontend ve el
// cambio en la siguiente recarga sin necesidad de cerrar sesión.
authRouter.get("/me", authMiddleware, async (req, res) => {
  try {
    const { rows } = await query(
      `select id, email, name, role,
              notify_email_enabled, notify_lead_minutes
         from users
        where id = $1`,
      [req.user.id]
    );
    const fresh = rows[0];
    if (!fresh) return res.status(401).json({ error: "Usuario no existe" });
    res.json(publicMe(fresh));
  } catch (err) {
    logger.error({ err }, "[auth/me]");
    res.status(500).json({ error: "Error leyendo perfil" });
  }
});

// ─── PATCH /api/auth/me/preferences ──────────────────────
// Actualiza preferencias del usuario actual (no requiere admin: cada uno
// gestiona sus avisos). Acepta cualquier subconjunto de campos válidos.
authRouter.patch(
  "/me/preferences",
  authMiddleware,
  validate(schemas.preferencesUpdate),
  async (req, res) => {
    try {
      const sets = [];
      const vals = [];
      let i = 1;

      if (Object.prototype.hasOwnProperty.call(req.body, "notify_email_enabled")) {
        sets.push(`notify_email_enabled = $${i++}`);
        vals.push(req.body.notify_email_enabled);
      }
      if (Object.prototype.hasOwnProperty.call(req.body, "notify_lead_minutes")) {
        sets.push(`notify_lead_minutes = $${i++}`);
        vals.push(req.body.notify_lead_minutes);
      }

      if (sets.length === 0) {
        // El schema garantiza al menos uno, pero por defensa:
        return res.status(400).json({ error: "Nada que actualizar" });
      }

      vals.push(req.user.id);
      const { rows } = await query(
        `update users
            set ${sets.join(", ")}
          where id = $${i}
        returning id, email, name, role,
                  notify_email_enabled, notify_lead_minutes`,
        vals
      );
      if (!rows[0]) return res.status(404).json({ error: "Usuario no encontrado" });
      res.json(publicMe(rows[0]));
    } catch (err) {
      logger.error({ err }, "[auth/me/preferences]");
      res.status(500).json({ error: "Error actualizando preferencias" });
    }
  }
);

// ─── POST /api/auth/me/preferences/test-email ─────────────
//
// Envía un correo de prueba al email del usuario actual. Útil para que
// cada técnico pueda comprobar él mismo si su buzón recibe los avisos
// del CRM (firewall, spam, dirección incorrecta…) sin tener que
// esperar a que se cree o programe una tarea.
//
// Bypassa toda la lógica de `dispatchTaskNotifications` y la cola de
// pg-boss: llama directamente a `sendMail`. Si el SMTP está mal
// configurado, esto fallará en el acto y devolverá el error real al
// frontend para mostrarlo en pantalla.
//
// No respeta el toggle `notify_email_enabled`: el botón es justamente
// para verificar la configuración SMTP, así que tiene sentido permitir
// el envío aunque el usuario tenga los avisos apagados.
authRouter.post("/me/preferences/test-email", authMiddleware, async (req, res) => {
  try {
    const { rows } = await query(
      "select email, name from users where id = $1",
      [req.user.id]
    );
    const user = rows[0];
    if (!user || !user.email) {
      return res.status(400).json({
        error: "Tu usuario no tiene una dirección de correo asociada.",
      });
    }

    const mode = getMailerMode();
    if (mode !== "smtp") {
      return res.status(503).json({
        error: `El servidor está en modo "${mode}" — no hay SMTP configurado.`,
      });
    }

    const subject = "Prueba de notificaciones · CRM Smartgroup";
    const greet = user.name ? `Hola ${user.name.split(" ")[0]},` : "Hola,";
    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:20px;color:#0f172a">
        <h2 style="margin:0 0 12px;color:#2563eb">✅ Recibes correctamente nuestros avisos</h2>
        <p style="margin:0 0 12px">${greet}</p>
        <p style="margin:0 0 12px">Esto es un correo de prueba enviado desde el CRM. Si lo estás leyendo,
        significa que el sistema puede entregarte notificaciones de tareas y recordatorios sin problemas.</p>
        <p style="margin:0 0 12px;color:#64748b;font-size:13px">No respondas a este mensaje, es automático.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:18px 0">
        <p style="margin:0;color:#94a3b8;font-size:12px">CRM Smartgroup · enviado a ${user.email}</p>
      </div>`.trim();
    const text =
      `${greet}\n\nEsto es un correo de prueba enviado desde el CRM. ` +
      `Si lo lees, las notificaciones por email te llegarán correctamente.\n\n` +
      `— CRM Smartgroup`;

    const result = await sendMail({ to: user.email, subject, html, text });

    if (!result?.ok) {
      logger.warn({ err: result?.error, to: user.email }, "[auth/test-email] falló");
      return res.status(502).json({
        error: result?.error || "El servidor SMTP rechazó el envío.",
      });
    }

    res.json({ ok: true, to: user.email, messageId: result.messageId });
  } catch (err) {
    logger.error({ err }, "[auth/test-email]");
    res.status(500).json({ error: err?.message || "Error enviando la prueba" });
  }
});
