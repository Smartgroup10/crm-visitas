// ============================================================
// Recordatorios personales — /api/reminders
// ============================================================
// Cada usuario gestiona su propia lista. Privacidad total: no exponemos
// recordatorios de otros usuarios ni siquiera al admin (es información
// personal, no operativa). Si en el futuro hace falta una vista de
// "auditoría", se puede añadir un endpoint distinto con requireRole.
//
// Cuando se crea o reprograma un recordatorio, se programa un job en
// pg-boss para `remind_at`. Al editar fecha o al borrar, cancelamos el
// job anterior. Si pg-boss no está disponible, persistimos igual y
// dejamos `job_id = null`: el `reminder-sweeper` periódico se encargará
// de los retrasados (ver workers.js).
// ============================================================

import { Router } from "express";
import { query } from "../db.js";
import { logger } from "../logger.js";
import { schemas, validate } from "../schemas.js";
import { getQueue, QUEUES } from "../queue.js";

export const remindersRouter = Router();

function publicReminder(row) {
  return {
    id:         row.id,
    title:      row.title,
    body:       row.body || "",
    remind_at:  row.remind_at,
    status:     row.status,
    sent_at:    row.sent_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Programa el job de envío en pg-boss y devuelve su id (o null si no
// disponible). El worker `reminder-fire` consume esta cola.
async function scheduleReminderJob(reminderId, remindAt) {
  const boss = getQueue();
  if (!boss) return null;
  try {
    const startAfter = new Date(remindAt);
    return await boss.send(
      QUEUES.REMINDER_FIRE,
      { reminderId },
      {
        startAfter,
        retryLimit: 3,
        retryDelay: 60,
        retryBackoff: true,
        // Aseguramos que dos reprogramaciones no produzcan dos jobs vivos:
        // usamos una "singleton key" por reminderId. pg-boss respeta la
        // unicidad mientras el job esté pending.
        singletonKey: `reminder:${reminderId}`,
      }
    );
  } catch (err) {
    logger.error({ err, reminderId }, "[reminders] no se pudo programar job");
    return null;
  }
}

async function cancelReminderJob(jobId) {
  const boss = getQueue();
  if (!boss || !jobId) return;
  try {
    await boss.cancel(jobId);
  } catch (err) {
    // Si el job ya se ejecutó/canceló, pg-boss puede tirar; lo ignoramos.
    logger.debug({ err, jobId }, "[reminders] cancel ignorado");
  }
}

// ─── GET /api/reminders ──────────────────────────────────
// Lista los recordatorios del usuario actual ordenados por fecha asc.
// Soporta filtro `?status=pending|sent|dismissed|all` (default: pending).
remindersRouter.get("/", async (req, res) => {
  try {
    const status = String(req.query.status || "pending").toLowerCase();
    const params = [req.user.id];
    let where = "user_id = $1";
    if (status !== "all") {
      params.push(status);
      where += " and status = $2";
    }
    const { rows } = await query(
      `select id, user_id, title, body, remind_at, status, sent_at, created_at, updated_at
         from reminders
        where ${where}
        order by remind_at asc, created_at asc`,
      params
    );
    res.json(rows.map(publicReminder));
  } catch (err) {
    logger.error({ err }, "[reminders/list]");
    res.status(500).json({ error: "Error obteniendo recordatorios" });
  }
});

// ─── POST /api/reminders ─────────────────────────────────
remindersRouter.post("/", validate(schemas.reminderCreate), async (req, res) => {
  try {
    const { title, body = "", remind_at } = req.body;

    const { rows } = await query(
      `insert into reminders (user_id, title, body, remind_at)
       values ($1, $2, $3, $4)
       returning id, user_id, title, body, remind_at, status, sent_at, created_at, updated_at`,
      [req.user.id, title, body, remind_at]
    );
    const reminder = rows[0];

    const jobId = await scheduleReminderJob(reminder.id, reminder.remind_at);
    if (jobId) {
      await query("update reminders set job_id = $1 where id = $2", [jobId, reminder.id]);
    }
    res.json(publicReminder(reminder));
  } catch (err) {
    logger.error({ err }, "[reminders/create]");
    res.status(500).json({ error: "Error creando recordatorio" });
  }
});

// ─── PATCH /api/reminders/:id ────────────────────────────
remindersRouter.patch("/:id", validate(schemas.reminderUpdate), async (req, res) => {
  try {
    // Comprobamos que el recordatorio sea del usuario y leemos el job_id
    // actual para cancelarlo si cambia la fecha.
    const { rows: existingRows } = await query(
      "select id, user_id, job_id, remind_at from reminders where id = $1",
      [req.params.id]
    );
    const existing = existingRows[0];
    if (!existing || existing.user_id !== req.user.id) {
      return res.status(404).json({ error: "Recordatorio no encontrado" });
    }

    const sets = [];
    const vals = [];
    let i = 1;
    for (const k of ["title", "body", "remind_at"]) {
      if (Object.prototype.hasOwnProperty.call(req.body, k)) {
        sets.push(`${k} = $${i++}`);
        vals.push(req.body[k]);
      }
    }
    if (sets.length === 0) {
      return res.status(400).json({ error: "Nada que actualizar" });
    }
    // Cuando se reprograma, volvemos al estado pending (por si estaba dismissed).
    const reschedules = Object.prototype.hasOwnProperty.call(req.body, "remind_at");
    if (reschedules) {
      sets.push(`status = 'pending'`);
      sets.push(`sent_at = null`);
    }

    vals.push(req.params.id);
    const { rows } = await query(
      `update reminders set ${sets.join(", ")} where id = $${i}
       returning id, user_id, title, body, remind_at, status, sent_at, created_at, updated_at`,
      vals
    );
    const updated = rows[0];

    if (reschedules) {
      await cancelReminderJob(existing.job_id);
      const jobId = await scheduleReminderJob(updated.id, updated.remind_at);
      await query("update reminders set job_id = $1 where id = $2", [jobId, updated.id]);
    }

    res.json(publicReminder(updated));
  } catch (err) {
    logger.error({ err }, "[reminders/update]");
    res.status(500).json({ error: "Error actualizando recordatorio" });
  }
});

// ─── POST /api/reminders/:id/dismiss ─────────────────────
// Descarta el recordatorio sin borrarlo (queda en histórico).
remindersRouter.post("/:id/dismiss", async (req, res) => {
  try {
    const { rows } = await query(
      `update reminders
          set status = 'dismissed'
        where id = $1 and user_id = $2
      returning id, user_id, title, body, remind_at, status, sent_at, created_at, updated_at, job_id`,
      [req.params.id, req.user.id]
    );
    const updated = rows[0];
    if (!updated) return res.status(404).json({ error: "Recordatorio no encontrado" });
    await cancelReminderJob(updated.job_id);
    res.json(publicReminder(updated));
  } catch (err) {
    logger.error({ err }, "[reminders/dismiss]");
    res.status(500).json({ error: "Error descartando recordatorio" });
  }
});

// ─── DELETE /api/reminders/:id ───────────────────────────
remindersRouter.delete("/:id", async (req, res) => {
  try {
    const { rows } = await query(
      "delete from reminders where id = $1 and user_id = $2 returning job_id",
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Recordatorio no encontrado" });
    await cancelReminderJob(rows[0].job_id);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[reminders/delete]");
    res.status(500).json({ error: "Error borrando recordatorio" });
  }
});
