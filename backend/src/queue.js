// ============================================================
// Cola de jobs (pg-boss)
// ============================================================
// Usamos pg-boss para programar y ejecutar jobs en background reusando la
// misma instancia de PostgreSQL — sin necesidad de Redis ni de un worker
// separado. Beneficios:
//   - Persistencia: si el backend se reinicia, los jobs pendientes siguen
//     ahí y se reintentan automáticamente.
//   - Programación con `sendAfter` o `startAfter`: ideal para "envíame el
//     recordatorio dentro de X minutos / a tal hora".
//   - Reintentos exponenciales configurables por cola.
//
// Filosofía:
//   - Si DATABASE_URL está disponible, arrancamos pg-boss en el mismo
//     proceso que Express. Para una app pequeña como esta es perfecto.
//   - Si por lo que sea pg-boss falla al arrancar, NO tumbamos el backend:
//     se loguea y la app sigue funcionando (los emails simplemente no se
//     enviarán hasta que un operador resuelva el problema).
// ============================================================

import PgBoss from "pg-boss";
import { logger } from "./logger.js";

let boss = null;
let started = false;

export const QUEUES = {
  SEND_EMAIL:        "send-email",
  REMINDER_FIRE:     "reminder-fire",
  TASK_REMINDER:     "task-reminder",
};

/**
 * Arranca pg-boss y crea las colas. Idempotente.
 */
export async function startQueue() {
  if (started) return boss;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    logger.warn("[queue] DATABASE_URL no definida; pg-boss no arranca");
    return null;
  }

  try {
    boss = new PgBoss({
      connectionString,
      // pg-boss crea su propio schema "pgboss" para no contaminar el público.
      schema: "pgboss",
      // Evita que se queden conexiones inactivas si Postgres reinicia
      // (por ejemplo durante un redeploy en Coolify).
      retentionDays: 7,
      monitorStateIntervalSeconds: 30,
    });

    boss.on("error", (err) => {
      logger.error({ err }, "[queue] error");
    });

    await boss.start();

    // Las colas en pg-boss v10 hay que declararlas explícitamente.
    for (const name of Object.values(QUEUES)) {
      await boss.createQueue(name).catch(() => { /* ya existe */ });
    }

    started = true;
    logger.info("[queue] pg-boss arrancado");
    return boss;
  } catch (err) {
    logger.error({ err }, "[queue] no se pudo arrancar pg-boss");
    boss = null;
    return null;
  }
}

export function getQueue() {
  return boss;
}

export async function stopQueue() {
  if (!boss) return;
  try {
    await boss.stop({ graceful: true, timeout: 5_000 });
    logger.info("[queue] pg-boss detenido");
  } catch (err) {
    logger.error({ err }, "[queue] error al detener");
  } finally {
    boss = null;
    started = false;
  }
}

/**
 * Programa un envío de email. Si pg-boss no está disponible, intenta enviar
 * directamente (sin reintento ni programación). El segundo parámetro
 * permite indicar un retraso o fecha futura.
 *
 *   scheduleEmail({ to, subject, html, text }, { sendAfter: new Date(...) })
 */
export async function scheduleEmail(payload, opts = {}) {
  if (!boss) {
    // Fallback: envío directo (importamos perezosamente para evitar ciclo).
    const { sendMail } = await import("./mailer.js");
    return sendMail(payload);
  }
  return boss.send(QUEUES.SEND_EMAIL, payload, {
    retryLimit: 3,
    retryDelay: 60,        // segundos
    retryBackoff: true,
    ...opts,
  });
}

/**
 * Cancela todos los jobs pendientes de una cola que cumplan un predicado
 * sobre su `data`. Útil para "olvida todos los recordatorios de la tarea X
 * porque acaba de cambiar la fecha". pg-boss expone `cancel(id)` por job;
 * para hacerlo masivo basta con guardar los ids al programar.
 *
 * En PR3/PR4 tocaremos esto cuando re-programemos al editar la tarea.
 */
