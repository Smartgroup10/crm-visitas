// ============================================================
// Notificaciones de tareas
// ============================================================
// Centraliza el envío de avisos al asignar / modificar / desasignar /
// borrar una tarea. Lo usan los handlers de routes/tasks.js.
//
// Tres momentos:
//   1. Asignación inicial: un técnico aparece en `technician_ids` por
//      primera vez → email "te han asignado".
//   2. Cambio relevante: cambia date/start_time o desasignación →
//      email "cambios en tu tarea" / "ya no estás asignado".
//   3. Recordatorio previo: si la tarea tiene fecha+hora, programamos un
//      job en pg-boss que dispara `notify_lead_minutes` antes del inicio
//      con un email "tu tarea empieza en X minutos".
//
// Filosofía:
//   - Nunca tumbamos el handler si una notificación falla. Logueamos.
//   - Los emails inmediatos pasan por la cola `send-email` (reintentos).
//   - El recordatorio previo va a la cola `task-reminder` con singletonKey
//     y guardamos el job_id en `task_reminder_jobs` para poder cancelarlo.
// ============================================================

import { query } from "./db.js";
import { logger } from "./logger.js";
import {
  taskAssignedEmail,
  taskChangedEmail,
} from "./templates.js";
import { getQueue, QUEUES, scheduleEmail } from "./queue.js";

// ─── Diff utilities ────────────────────────────────────────
function arrSet(a) {
  return new Set(Array.isArray(a) ? a : []);
}
function added(prev, next) {
  const p = arrSet(prev);
  return [...arrSet(next)].filter((x) => !p.has(x));
}
function removed(prev, next) {
  const n = arrSet(next);
  return [...arrSet(prev)].filter((x) => !n.has(x));
}

// ─── Lookup helpers ────────────────────────────────────────
async function getRecipients(userIds) {
  if (!userIds || userIds.length === 0) return [];
  const { rows } = await query(
    `select id, email, name, notify_email_enabled, notify_lead_minutes
       from users
      where id = any($1::uuid[])
        and coalesce(email, '') <> ''`,
    [userIds]
  );
  return rows;
}
async function getClientName(clientId) {
  if (!clientId) return null;
  const { rows } = await query("select name from clients where id = $1", [clientId]);
  return rows[0]?.name || null;
}
async function getUserNameById(userId) {
  if (!userId) return null;
  const { rows } = await query("select name, email from users where id = $1", [userId]);
  return rows[0]?.name || rows[0]?.email || null;
}

// ─── Recordatorio previo (cola task-reminder) ───────────────
function startDateTime(task) {
  // Combinamos `date` (YYYY-MM-DD) y `start_time` (HH:MM, hora local del
  // operador). Si falta start_time, usamos 09:00 como default razonable
  // (no programamos recordatorios sin date — sin fecha no tiene sentido).
  if (!task?.date) return null;
  const time = task.start_time && /^([01]\d|2[0-3]):[0-5]\d$/.test(task.start_time)
    ? task.start_time
    : "09:00";
  // El servidor puede correr en UTC; usamos hora local del proceso al
  // construir la Date. Para una versión más correcta cuando el equipo
  // está en otra zona, habría que llevar la TZ a nivel de usuario; lo
  // dejamos como mejora futura.
  const d = new Date(`${task.date}T${time}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function cancelTaskReminderForUser(taskId, userId) {
  const boss = getQueue();
  const { rows } = await query(
    "delete from task_reminder_jobs where task_id = $1 and user_id = $2 returning job_id",
    [taskId, userId]
  );
  if (boss && rows[0]?.job_id) {
    try { await boss.cancel(rows[0].job_id); }
    catch (err) { logger.debug({ err }, "[taskNotifs] cancel task-reminder ignorado"); }
  }
}

export async function cancelAllTaskReminders(taskId) {
  const boss = getQueue();
  const { rows } = await query(
    "delete from task_reminder_jobs where task_id = $1 returning job_id",
    [taskId]
  );
  if (!boss) return;
  for (const r of rows) {
    try { await boss.cancel(r.job_id); }
    catch (err) { logger.debug({ err }, "[taskNotifs] cancel masivo ignorado"); }
  }
}

async function scheduleTaskReminder(task, recipient) {
  const boss = getQueue();
  if (!boss) return;
  if (!recipient?.notify_email_enabled) return;
  const start = startDateTime(task);
  if (!start) return;

  const lead = Number(recipient.notify_lead_minutes ?? 60);
  const sendAt = new Date(start.getTime() - lead * 60_000);
  // Si la fecha-recordatorio ya pasó (tarea inminente o creada tarde) no
  // programamos el aviso anticipado: el usuario no llegaría a verlo a
  // tiempo. El email de asignación ya cumple la función de "te aviso ya".
  if (sendAt.getTime() <= Date.now()) return;

  try {
    const jobId = await boss.send(
      QUEUES.TASK_REMINDER,
      { taskId: task.id, userId: recipient.id },
      {
        startAfter: sendAt,
        retryLimit: 3,
        retryDelay: 60,
        retryBackoff: true,
        singletonKey: `task-reminder:${task.id}:${recipient.id}`,
      }
    );
    if (jobId) {
      await query(
        `insert into task_reminder_jobs (task_id, user_id, job_id)
         values ($1, $2, $3)
         on conflict (task_id, user_id) do update set job_id = excluded.job_id`,
        [task.id, recipient.id, jobId]
      );
    }
  } catch (err) {
    logger.error({ err, taskId: task.id, userId: recipient.id }, "[taskNotifs] schedule failed");
  }
}

async function rescheduleTaskRemindersForAll(task) {
  const techs = await getRecipients(task.technician_ids || []);
  for (const t of techs) {
    await cancelTaskReminderForUser(task.id, t.id);
    await scheduleTaskReminder(task, t);
  }
}

// ─── Diff de cambios "que importan" ────────────────────────
function buildChanges(prev, next, clientName) {
  const out = [];
  if (prev.date !== next.date) {
    out.push({ label: "Fecha", from: prev.date || "—", to: next.date || "—" });
  }
  if (prev.start_time !== next.start_time) {
    out.push({ label: "Hora", from: prev.start_time || "—", to: next.start_time || "—" });
  }
  if (prev.title !== next.title) {
    out.push({ label: "Título", from: prev.title || "—", to: next.title || "—" });
  }
  if (clientName?.from !== clientName?.to) {
    out.push({ label: "Cliente", from: clientName?.from || "—", to: clientName?.to || "—" });
  }
  return out;
}

// ─── Punto de entrada principal ────────────────────────────
/**
 * Llamar después de INSERT/UPDATE/DELETE de una tarea.
 *
 *   await dispatchTaskNotifications({ prev: null, next: task, actorId });
 *   await dispatchTaskNotifications({ prev: oldTask, next: newTask, actorId });
 *   await dispatchTaskNotifications({ prev: oldTask, next: null });   // delete
 *
 *   prev / next: filas tal cual las devuelve la BD (snake_case).
 *   actorId: id del usuario que provoca el cambio (para el "te asignó X").
 */
export async function dispatchTaskNotifications({ prev, next, actorId }) {
  try {
    // BORRADO de tarea: cancelamos cualquier recordatorio programado.
    if (prev && !next) {
      await cancelAllTaskReminders(prev.id);
      return;
    }

    if (!next) return;

    const prevTechs = prev ? prev.technician_ids || [] : [];
    const nextTechs = next.technician_ids || [];

    const newAssignees = added(prevTechs, nextTechs);
    const unassigned   = removed(prevTechs, nextTechs);
    const remained     = nextTechs.filter((id) => !newAssignees.includes(id));

    const dateChanged = !!prev && (prev.date !== next.date);
    const timeChanged = !!prev && (prev.start_time !== next.start_time);
    const clientChanged = !!prev && (prev.client_id !== next.client_id);
    const titleChanged  = !!prev && (prev.title !== next.title);
    const importantChange = dateChanged || timeChanged || clientChanged || titleChanged;

    const [clientNameNext, clientNamePrev, actorName] = await Promise.all([
      getClientName(next.client_id),
      prev ? getClientName(prev.client_id) : Promise.resolve(null),
      actorId ? getUserNameById(actorId) : Promise.resolve(null),
    ]);

    // 1) Asignación inicial (a los nuevos técnicos)
    if (newAssignees.length > 0) {
      const recipients = await getRecipients(newAssignees);
      for (const r of recipients) {
        if (!r.notify_email_enabled) continue;
        const tpl = taskAssignedEmail({
          user: r,
          task: next,
          clientName: clientNameNext,
          assignerName: actorName || "Un compañero",
        });
        await scheduleEmail({ to: r.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
      }
    }

    // 2) Desasignación: aviso "ya no estás asignado"
    if (unassigned.length > 0) {
      const recipients = await getRecipients(unassigned);
      for (const r of recipients) {
        if (!r.notify_email_enabled) continue;
        const tpl = taskChangedEmail({
          user: r,
          task: next,
          clientName: clientNameNext,
          changes: [{ label: "Asignación", from: "Asignada", to: "Desasignada" }],
        });
        await scheduleEmail({ to: r.email, subject: `Ya no estás asignado: ${next.title}`, html: tpl.html, text: tpl.text });
      }
      // Y cancelamos sus recordatorios programados.
      for (const userId of unassigned) {
        await cancelTaskReminderForUser(next.id, userId);
      }
    }

    // 3) Cambio relevante para los que siguen asignados
    if (importantChange && remained.length > 0) {
      const recipients = await getRecipients(remained);
      const changes = buildChanges(prev, next, { from: clientNamePrev, to: clientNameNext });
      for (const r of recipients) {
        if (!r.notify_email_enabled) continue;
        const tpl = taskChangedEmail({
          user: r,
          task: next,
          clientName: clientNameNext,
          changes,
        });
        await scheduleEmail({ to: r.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
      }
    }

    // 4) Reprogramar recordatorios previos:
    //    - Si cambia la fecha/hora, hay que reprogramar para todos los
    //      asignados (incluidos los nuevos).
    //    - Si la tarea es nueva o solo cambió la asignación, programar
    //      sólo para los nuevos.
    if (dateChanged || timeChanged) {
      await rescheduleTaskRemindersForAll(next);
    } else if (newAssignees.length > 0) {
      const fresh = await getRecipients(newAssignees);
      for (const r of fresh) {
        await scheduleTaskReminder(next, r);
      }
    }
  } catch (err) {
    logger.error({ err }, "[taskNotifs] dispatch failed");
  }
}
