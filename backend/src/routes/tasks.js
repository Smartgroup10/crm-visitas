import { Router } from "express";
import { query } from "../db.js";
import { emit } from "../io.js";

export const tasksRouter = Router();

// Campos permitidos en PATCH (whitelist para evitar SQL injection por clave)
const ALLOWED_PATCH_FIELDS = new Set([
  "title", "date", "status", "priority", "client_id", "phone",
  "technician_ids", "vehicle", "type", "notes", "materials",
  "estimated_time", "attachments", "type_fields",
]);

// Campos JSONB que hay que serializar
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
    console.error("[tasks/list]", err);
    res.status(500).json({ error: "Error obteniendo tareas" });
  }
});

// ─── POST /api/tasks ─────────────────────────────────────
tasksRouter.post("/", async (req, res) => {
  try {
    const t = req.body || {};
    const { rows } = await query(
      `insert into tasks (
        title, date, status, priority, client_id, phone, technician_ids,
        vehicle, type, notes, materials, estimated_time, attachments,
        type_fields, created_by, updated_by
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15)
      returning *`,
      [
        t.title           ?? "",
        t.date            ?? null,
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
  } catch (err) {
    console.error("[tasks/create]", err);
    res.status(500).json({ error: "Error creando tarea" });
  }
});

// ─── PUT /api/tasks/:id ──────────────────────────────────
tasksRouter.put("/:id", async (req, res) => {
  try {
    const t = req.body || {};
    const { rows } = await query(
      `update tasks set
         title = $1, date = $2, status = $3, priority = $4, client_id = $5,
         phone = $6, technician_ids = $7, vehicle = $8, type = $9,
         notes = $10, materials = $11, estimated_time = $12,
         attachments = $13, type_fields = $14, updated_by = $15
       where id = $16 returning *`,
      [
        t.title          ?? "",
        t.date           ?? null,
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
  } catch (err) {
    console.error("[tasks/update]", err);
    res.status(500).json({ error: "Error actualizando tarea" });
  }
});

// ─── PATCH /api/tasks/:id ────────────────────────────────
// Actualización parcial (ej. solo cambio de fecha al arrastrar en calendario).
tasksRouter.patch("/:id", async (req, res) => {
  try {
    const fields = Object.entries(req.body || {}).filter(([k]) =>
      ALLOWED_PATCH_FIELDS.has(k)
    );
    if (!fields.length) {
      return res.status(400).json({ error: "Nada que actualizar" });
    }

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
  } catch (err) {
    console.error("[tasks/patch]", err);
    res.status(500).json({ error: "Error actualizando tarea" });
  }
});

// ─── DELETE /api/tasks/:id ───────────────────────────────
tasksRouter.delete("/:id", async (req, res) => {
  try {
    await query("delete from tasks where id = $1", [req.params.id]);
    emit("tasks:change", { type: "delete", id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    console.error("[tasks/delete]", err);
    res.status(500).json({ error: "Error borrando tarea" });
  }
});
