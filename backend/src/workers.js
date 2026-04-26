// ============================================================
// Workers de pg-boss
// ============================================================
// Registra los handlers de las colas. Se invoca una sola vez tras arrancar
// pg-boss. Los handlers son async y deben ser idempotentes en la medida
// de lo posible: pg-boss reintenta en caso de error.
// ============================================================

import { logger } from "./logger.js";
import { sendMail } from "./mailer.js";
import { QUEUES, getQueue } from "./queue.js";

export async function registerWorkers() {
  const boss = getQueue();
  if (!boss) {
    logger.warn("[workers] pg-boss no disponible; no se registran workers");
    return;
  }

  // ─── Cola: send-email ────────────────────────────────────────
  // Recibe { to, subject, html, text, replyTo, headers } y delega en mailer.
  await boss.work(QUEUES.SEND_EMAIL, { teamSize: 5, teamConcurrency: 2 }, async (jobs) => {
    // pg-boss v10 entrega arrays de jobs por batch.
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

  logger.info("[workers] registrados");
}
