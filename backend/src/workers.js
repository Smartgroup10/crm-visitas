// ============================================================
// Workers de pg-boss
// ============================================================
// Registra los handlers de las colas. Se invoca una sola vez tras arrancar
// pg-boss. Los handlers son async y deben ser idempotentes en la medida
// de lo posible: pg-boss reintenta en caso de error.
// ============================================================

import { query } from "./db.js";
import { logger } from "./logger.js";
import { sendMail } from "./mailer.js";
import { reminderEmail, taskReminderEmail } from "./templates.js";
import { QUEUES, getQueue } from "./queue.js";
import { emitToUser } from "./io.js";

export async function registerWorkers() {
  const boss = getQueue();
  if (!boss) {
    logger.warn("[workers] pg-boss no disponible; no se registran workers");
    return;
  }

  // ─── Cola: send-email ────────────────────────────────────────
  // Recibe { to, subject, html, text, replyTo, headers } y delega en mailer.
  await boss.work(QUEUES.SEND_EMAIL, { teamSize: 5, teamConcurrency: 2 }, async (jobs) => {
    const list = Array.isArray(jobs) ? jobs : [jobs];
    for (const job of list) {
      const data = job.data || {};
      const result = await sendMail(data);
      if (!result?.ok) {
        // Lanzamos para que pg-boss reintente con su backoff configurado.
        throw new Error(result?.error || "send_failed");
      }
    }
  });

  // ─── Cola: reminder-fire ─────────────────────────────────────
  // Recibe { reminderId } y dispara el envío del email asociado, dejando
  // el reminder marcado como `sent`. Idempotente: si el reminder ya está
  // sent o dismissed, no hace nada.
  await boss.work(QUEUES.REMINDER_FIRE, { teamSize: 3, teamConcurrency: 2 }, async (jobs) => {
    const list = Array.isArray(jobs) ? jobs : [jobs];
    for (const job of list) {
      await handleReminderFire(job.data?.reminderId);
    }
  });

  // ─── Cola: task-reminder ─────────────────────────────────────
  // Recibe { taskId, userId } y manda el email "tu tarea empieza en X
  // minutos". Si en el momento del envío la tarea ya no existe, ya está
  // listo, o el técnico ya no está asignado, el handler no hace nada.
  await boss.work(QUEUES.TASK_REMINDER, { teamSize: 3, teamConcurrency: 2 }, async (jobs) => {
    const list = Array.isArray(jobs) ? jobs : [jobs];
    for (const job of list) {
      await handleTaskReminderFire(job.data || {});
    }
  });

  logger.info("[workers] registrados");

  // ─── Sweeper periódico ──────────────────────────────────────
  // Para casos en los que pg-boss no estaba arriba al programar (job_id
  // null) o el job se perdió: cada minuto miramos los recordatorios
  // pending cuya fecha ya pasó y los disparamos. Es la red de seguridad.
  scheduleSweeper();
}

async function handleReminderFire(reminderId) {
  if (!reminderId) return;
  const { rows } = await query(
    `select r.id, r.title, r.body, r.remind_at, r.status,
            u.id as user_id, u.email, u.name,
            u.notify_email_enabled
       from reminders r
       join users u on u.id = r.user_id
      where r.id = $1`,
    [reminderId]
  );
  const reminder = rows[0];
  if (!reminder) {
    logger.warn({ reminderId }, "[reminder-fire] no existe");
    return;
  }
  if (reminder.status !== "pending") {
    logger.debug({ reminderId, status: reminder.status }, "[reminder-fire] ya procesado");
    return;
  }

  // Notificación in-app: la lanzamos SIEMPRE (independiente de la
  // preferencia de email). Si el usuario tiene la app abierta verá el
  // toast y la notificación del navegador; si no, su frontend la
  // recogerá cuando vuelva (watcher local sobre la lista de reminders).
  const notifyPayload = {
    kind: "reminder",
    id: reminder.id,
    title: reminder.title,
    body: reminder.body || "",
    when: reminder.remind_at,
    tag: `reminder:${reminder.id}`,
  };

  if (!reminder.notify_email_enabled) {
    // El usuario tiene desactivados los avisos por email: marcamos como
    // sent para no volver a procesarlo, pero la notificación in-app sí
    // sale (es independiente: vive en la sesión del usuario).
    await query(
      "update reminders set status = 'sent', sent_at = now() where id = $1",
      [reminderId]
    );
    emitToUser(reminder.user_id, "notify", notifyPayload);
    logger.info({ reminderId }, "[reminder-fire] sin email; in-app enviado");
    return;
  }
  if (!reminder.email) {
    // Sin dirección de correo. Igual que arriba: in-app sí, marcar sent
    // para no reintentar eternamente.
    await query(
      "update reminders set status = 'sent', sent_at = now() where id = $1",
      [reminderId]
    );
    emitToUser(reminder.user_id, "notify", notifyPayload);
    logger.warn({ reminderId }, "[reminder-fire] usuario sin email; in-app enviado");
    return;
  }

  const tpl = reminderEmail({
    user: { name: reminder.name, email: reminder.email },
    reminder: { title: reminder.title, body: reminder.body, remind_at: reminder.remind_at },
  });

  const result = await sendMail({
    to: reminder.email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  });

  if (!result?.ok) {
    // Dejamos el reminder en pending para que el sweeper lo reintente
    // (y pg-boss también reintentará el job al lanzar excepción).
    throw new Error(result?.error || "send_failed");
  }

  await query(
    "update reminders set status = 'sent', sent_at = now() where id = $1 and status = 'pending'",
    [reminderId]
  );
  emitToUser(reminder.user_id, "notify", notifyPayload);
  logger.info({ reminderId, to: reminder.email }, "[reminder-fire] enviado");
}

async function handleTaskReminderFire({ taskId, userId }) {
  if (!taskId || !userId) return;

  // Limpiamos la fila de seguimiento (si el job se dispara, su id ya no es
  // útil para cancelar). Lo hacemos al principio para que sea idempotente
  // y no acumule basura aunque el envío falle.
  await query(
    "delete from task_reminder_jobs where task_id = $1 and user_id = $2",
    [taskId, userId]
  );

  const { rows } = await query(
    `select t.id, t.title, t.date, t.start_time, t.priority, t.status,
            t.notes, t.client_id, t.technician_ids,
            c.name as client_name,
            u.id as user_id, u.email as user_email, u.name as user_name,
            u.notify_email_enabled, u.notify_lead_minutes
       from tasks t
       left join clients c on c.id = t.client_id
       join users u on u.id = $2
      where t.id = $1`,
    [taskId, userId]
  );
  const row = rows[0];
  if (!row) {
    logger.debug({ taskId, userId }, "[task-reminder] tarea no existe; saltado");
    return;
  }
  if (row.status === "Listo") {
    logger.debug({ taskId, userId }, "[task-reminder] tarea ya completada; saltado");
    return;
  }
  if (!Array.isArray(row.technician_ids) || !row.technician_ids.includes(userId)) {
    logger.debug({ taskId, userId }, "[task-reminder] usuario ya no asignado; saltado");
    return;
  }

  const leadMinutes = Number(row.notify_lead_minutes ?? 60);

  // Notificación in-app: independiente del email. Si la pestaña está
  // cerrada, el watcher local del frontend la disparará cuando vuelva
  // (mientras la fecha-hora siga siendo "próxima").
  const notifyPayload = {
    kind: "task",
    id: row.id,
    title: row.title,
    body: row.client_name
      ? `${row.client_name} · empieza ${leadMinutes ? `en ${leadMinutes} min` : "ahora"}`
      : `Tu tarea empieza ${leadMinutes ? `en ${leadMinutes} min` : "ahora"}`,
    when: row.date && row.start_time ? `${row.date}T${row.start_time}:00` : null,
    tag: `task:${row.id}`,
  };
  emitToUser(userId, "notify", notifyPayload);

  // Si el usuario apagó el email, ya está: el aviso in-app salió. Salir.
  if (!row.notify_email_enabled) return;
  if (!row.user_email) return;

  const tpl = taskReminderEmail({
    user: { id: row.user_id, name: row.user_name, email: row.user_email },
    task: {
      id: row.id, title: row.title, date: row.date, start_time: row.start_time,
      priority: row.priority, status: row.status, notes: row.notes,
    },
    clientName: row.client_name,
    leadMinutes,
  });

  const result = await sendMail({
    to: row.user_email, subject: tpl.subject, html: tpl.html, text: tpl.text,
  });
  if (!result?.ok) throw new Error(result?.error || "send_failed");
}

// ─── Sweeper de recordatorios atrasados ─────────────────────
// Corre cada minuto. Coge recordatorios `pending` con `remind_at` ya pasada
// y dispara `handleReminderFire` directamente, sin pasar por pg-boss
// (porque o el job nunca se programó, o se perdió). Limitamos a 50 por
// pasada para no saturar el worker si hubiera un atasco.
let sweeperTimer = null;
function scheduleSweeper() {
  if (sweeperTimer) return;
  const tick = async () => {
    try {
      const { rows } = await query(
        `select id from reminders
          where status = 'pending'
            and remind_at <= now()
          order by remind_at asc
          limit 50`
      );
      for (const r of rows) {
        try {
          await handleReminderFire(r.id);
        } catch (err) {
          logger.error({ err, id: r.id }, "[reminder-sweeper] error procesando");
        }
      }
    } catch (err) {
      logger.error({ err }, "[reminder-sweeper] error en barrido");
    }
  };
  // Primera pasada en 5s para coger lo que estaba esperando al arrancar,
  // y luego cada 60s.
  sweeperTimer = setInterval(tick, 60_000);
  setTimeout(tick, 5_000);
}
