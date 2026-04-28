import { Router } from "express";
import { query } from "../db.js";
import { emit } from "../io.js";
import { requireRole, authMiddleware } from "../auth.js";
import { logger } from "../logger.js";
import { schemas, validate } from "../schemas.js";
import { dispatchTaskNotifications } from "../taskNotifs.js";
import { recordTaskChange, getTaskActivity } from "../taskActivity.js";

export const tasksRouter = Router();

// Admins y supervisores pueden crear / modificar / borrar tareas.
// Los técnicos sólo pueden leer (GET queda abierto a cualquier autenticado).
const canManage = requireRole("admin", "supervisor");

// Campos JSONB que hay que serializar antes de pasarlos al driver pg.
const JSONB_FIELDS = new Set(["attachments", "type_fields"]);

function prepareValue(key, value) {
  if (JSONB_FIELDS.has(key)) {
    const fallback = key === "attachments" ? [] : {};
    return JSON.stringify(value ?? fallback);
  }
  return value;
}

// ─── GET /api/tasks ──────────────────────────────────────
tasksRouter.get("/", async (_req, res) => {
  try {
    const { rows } = await query("select * from tasks order by created_at asc");
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "[tasks/list]");
    res.status(500).json({ error: "Error obteniendo tareas" });
  }
});

// ─── POST /api/tasks ─────────────────────────────────────
tasksRouter.post("/", canManage, validate(schemas.taskCreate), async (req, res) => {
  try {
    const t = req.body || {};
    const { rows } = await query(
      `insert into tasks (
        title, date, start_time, status, priority, client_id, phone, technician_ids,
        vehicle, type, notes, materials, estimated_time, attachments,
        type_fields, created_by, updated_by
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16)
      returning *`,
      [
        t.title           ?? "",
        t.date            ?? null,
        t.start_time      ?? null,
        t.status          ?? "No iniciado",
        t.priority        ?? "Media",
        t.client_id       || null,
        t.phone           ?? "",
        t.technician_ids  ?? [],
        t.vehicle         ?? "",
        t.type            ?? null,
        t.notes           ?? "",
        t.materials       ?? "",
        t.estimated_time  ?? "",
        JSON.stringify(t.attachments ?? []),
        JSON.stringify(t.type_fields ?? {}),
        req.user.id,
      ]
    );
    emit("tasks:change", { type: "insert", task: rows[0] });
    res.json(rows[0]);
    // Notificaciones + activity log en background: no bloquean la respuesta.
    dispatchTaskNotifications({ prev: null, next: rows[0], actorId: req.user.id });
    recordTaskChange({ prev: null, next: rows[0], actorId: req.user.id });
  } catch (err) {
    logger.error({ err }, "[tasks/create]");
    res.status(500).json({ error: "Error creando tarea" });
  }
});

// ─── PUT /api/tasks/:id ──────────────────────────────────
tasksRouter.put("/:id", canManage, validate(schemas.taskUpdate), async (req, res) => {
  try {
    const t = req.body || {};
    // Leemos el estado previo para poder hacer diff de asignación / fecha.
    const { rows: prevRows } = await query("select * from tasks where id = $1", [req.params.id]);
    const prev = prevRows[0] || null;

    const { rows } = await query(
      `update tasks set
         title = $1, date = $2, start_time = $3, status = $4, priority = $5,
         client_id = $6, phone = $7, technician_ids = $8, vehicle = $9, type = $10,
         notes = $11, materials = $12, estimated_time = $13,
         attachments = $14, type_fields = $15, updated_by = $16
       where id = $17 returning *`,
      [
        t.title          ?? "",
        t.date           ?? null,
        t.start_time     ?? null,
        t.status         ?? "No iniciado",
        t.priority       ?? "Media",
        t.client_id      || null,
        t.phone          ?? "",
        t.technician_ids ?? [],
        t.vehicle        ?? "",
        t.type           ?? null,
        t.notes          ?? "",
        t.materials      ?? "",
        t.estimated_time ?? "",
        JSON.stringify(t.attachments ?? []),
        JSON.stringify(t.type_fields ?? {}),
        req.user.id,
        req.params.id,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: "Tarea no encontrada" });
    emit("tasks:change", { type: "update", task: rows[0] });
    res.json(rows[0]);
    dispatchTaskNotifications({ prev, next: rows[0], actorId: req.user.id });
    recordTaskChange({ prev, next: rows[0], actorId: req.user.id });
  } catch (err) {
    logger.error({ err }, "[tasks/update]");
    res.status(500).json({ error: "Error actualizando tarea" });
  }
});

// ─── PATCH /api/tasks/:id ────────────────────────────────
// Actualización parcial (ej. solo cambio de fecha al arrastrar en calendario).
// El schema ya garantiza que (1) todas las claves son conocidas y (2) al
// menos una viene, así que podemos iterar req.body directamente.
tasksRouter.patch("/:id", canManage, validate(schemas.taskPatch), async (req, res) => {
  try {
    const fields = Object.entries(req.body);

    const { rows: prevRows } = await query("select * from tasks where id = $1", [req.params.id]);
    const prev = prevRows[0] || null;

    const values = [];
    const setClauses = [];
    for (const [key, val] of fields) {
      values.push(prepareValue(key, val));
      setClauses.push(`${key} = $${values.length}`);
    }
    values.push(req.user.id);
    setClauses.push(`updated_by = $${values.length}`);

    values.push(req.params.id);
    const { rows } = await query(
      `update tasks set ${setClauses.join(", ")} where id = $${values.length} returning *`,
      values
    );
    if (!rows[0]) return res.status(404).json({ error: "Tarea no encontrada" });
    emit("tasks:change", { type: "update", task: rows[0] });
    res.json(rows[0]);
    dispatchTaskNotifications({ prev, next: rows[0], actorId: req.user.id });
    recordTaskChange({ prev, next: rows[0], actorId: req.user.id });
  } catch (err) {
    logger.error({ err }, "[tasks/patch]");
    res.status(500).json({ error: "Error actualizando tarea" });
  }
});

// ─── DELETE /api/tasks/:id ───────────────────────────────
tasksRouter.delete("/:id", canManage, async (req, res) => {
  try {
    // Leemos antes de borrar para poder limpiar jobs programados.
    const { rows: prevRows } = await query("select * from tasks where id = $1", [req.params.id]);
    const prev = prevRows[0] || null;

    await query("delete from tasks where id = $1", [req.params.id]);
    emit("tasks:change", { type: "delete", id: req.params.id });
    res.json({ ok: true });
    if (prev) {
      dispatchTaskNotifications({ prev, next: null, actorId: req.user.id });
      // Nota: el INSERT en task_activity falla por el FK (la tarea ya
      // no existe) salvo que lo hagamos antes del delete; pero el
      // cascade lo borraría inmediatamente. Lo dejamos como no-op:
      // borrar una tarea no deja rastro persistente. Si en el futuro
      // se quiere historial de borradas, hay que (1) registrar antes
      // del delete y (2) quitar el cascade en la tabla.
    }
  } catch (err) {
    logger.error({ err }, "[tasks/delete]");
    res.status(500).json({ error: "Error borrando tarea" });
  }
});

// ─── GET /api/tasks/:id/activity ─────────────────────────
// Devuelve el timeline de cambios de la tarea, ordenado más reciente
// primero. Cualquier usuario autenticado puede consultarlo (no es
// info sensible — es metadato de quién tocó qué). Si en el futuro
// queremos restringirlo a admins/supervisors, basta con cambiar el
// middleware.
tasksRouter.get("/:id/activity", authMiddleware, async (req, res) => {
  try {
    const rows = await getTaskActivity(req.params.id);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "[tasks/activity]");
    res.status(500).json({ error: "Error obteniendo actividad" });
  }
});
