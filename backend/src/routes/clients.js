import { Router } from "express";
import { query } from "../db.js";
import { emit } from "../io.js";
import { requireRole, authMiddleware } from "../auth.js";
import { logger } from "../logger.js";
import { schemas, validate } from "../schemas.js";

export const clientsRouter = Router();

const canManage = requireRole("admin", "supervisor");

// ─── GET /api/clients ────────────────────────────────────
clientsRouter.get("/", async (_req, res) => {
  try {
    const { rows } = await query("select * from clients order by name asc");
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "[clients/list]");
    res.status(500).json({ error: "Error obteniendo clientes" });
  }
});

// ─── POST /api/clients ───────────────────────────────────
clientsRouter.post("/", canManage, validate(schemas.clientCreate), async (req, res) => {
  try {
    const { name } = req.body;

    const { rows } = await query(
      "insert into clients (name, created_by) values ($1, $2) returning *",
      [name, req.user.id]
    );
    emit("clients:change", { type: "insert", client: rows[0] });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "[clients/create]");
    res.status(500).json({ error: "Error creando cliente" });
  }
});

// ─── PUT /api/clients/:id ────────────────────────────────
clientsRouter.put("/:id", canManage, validate(schemas.clientUpdate), async (req, res) => {
  try {
    const { name } = req.body;

    const { rows } = await query(
      "update clients set name = $1 where id = $2 returning *",
      [name, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Cliente no encontrado" });
    emit("clients:change", { type: "update", client: rows[0] });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "[clients/update]");
    res.status(500).json({ error: "Error actualizando cliente" });
  }
});

// ─── DELETE /api/clients/:id ─────────────────────────────
clientsRouter.delete("/:id", canManage, async (req, res) => {
  try {
    await query("delete from clients where id = $1", [req.params.id]);
    emit("clients:change", { type: "delete", id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[clients/delete]");
    res.status(500).json({ error: "Error borrando cliente" });
  }
});

// ─── GET /api/clients/:id/details ────────────────────────
//
// Devuelve la ficha completa del cliente + todas sus tareas asociadas.
// Lo usa la vista de detalle para mostrar histórico y estadísticas.
//
// Decisión de diseño: una sola query con dos selects en lugar de dos
// endpoints separados. Para los volúmenes esperados (decenas de
// tareas por cliente como mucho) el payload es manejable y evitamos
// un round-trip desde el frontend. Las stats (totales por estado /
// tipo, última visita, etc.) las calcula el frontend a partir de los
// items — más flexible y barato que mantener agregados en SQL.
//
// Cualquier usuario autenticado puede leer este endpoint: igual que
// /api/tasks, los datos no son sensibles a nivel de rol.
clientsRouter.get("/:id/details", authMiddleware, async (req, res) => {
  try {
    const { rows: clientRows } = await query(
      "select id, name, created_at from clients where id = $1",
      [req.params.id]
    );
    const client = clientRows[0];
    if (!client) return res.status(404).json({ error: "Cliente no encontrado" });

    // Orden: pasadas más recientes arriba, futuras al final por fecha
    // creciente. Para conseguirlo barato, ordenamos por date desc
    // tratando NULLs como muy antiguas (al fondo). El frontend luego
    // segmenta entre "pasadas" y "futuras" según la fecha actual.
    const { rows: tasks } = await query(
      `select * from tasks
        where client_id = $1
        order by date desc nulls last, created_at desc`,
      [req.params.id]
    );

    res.json({ client, tasks });
  } catch (err) {
    logger.error({ err }, "[clients/details]");
    res.status(500).json({ error: "Error obteniendo detalle del cliente" });
  }
});
