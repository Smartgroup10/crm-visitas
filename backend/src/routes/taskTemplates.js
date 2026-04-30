// ============================================================
// Plantillas de tarea (CRUD)
// ============================================================
// Una plantilla guarda los valores típicos de una tarea repetitiva
// (tipo, prioridad, técnico habitual, materiales típicos, notas con
// checklist…) para que al crear una nueva el usuario sólo tenga que
// seleccionar la plantilla y rellenar la fecha. Al aplicar una
// plantilla, el frontend mergea los campos en el draft de la tarea.
//
// Permisos: la lectura está abierta a cualquier autenticado (los
// técnicos pueden ver qué plantillas existen para crear sus tareas
// del día). La escritura (crear/editar/borrar) la limitamos a
// admin/supervisor — son los que mantienen el catálogo de tipos de
// trabajo.
// ============================================================

import { Router } from "express";
import { query } from "../db.js";
import { emit } from "../io.js";
import { requireRole, authMiddleware } from "../auth.js";
import { logger } from "../logger.js";
import { schemas, validate } from "../schemas.js";

export const taskTemplatesRouter = Router();

const canManage = requireRole("admin", "supervisor");

// ─── GET /api/task-templates ─────────────────────────────
// Devuelve la lista ordenada por nombre. Los volúmenes esperados son
// pequeños (decenas de plantillas), así que devolvemos todo de un
// tirón sin paginación.
taskTemplatesRouter.get("/", authMiddleware, async (_req, res) => {
  try {
    const { rows } = await query(
      "select * from task_templates order by name asc"
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "[task-templates/list]");
    res.status(500).json({ error: "Error obteniendo plantillas" });
  }
});

// ─── POST /api/task-templates ────────────────────────────
taskTemplatesRouter.post(
  "/",
  canManage,
  validate(schemas.taskTemplateCreate),
  async (req, res) => {
    try {
      const t = req.body || {};
      const { rows } = await query(
        `insert into task_templates (
          name, title, type, priority, status, estimated_time,
          notes, materials, vehicle, phone, client_id,
          technician_ids, type_fields, created_by
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        returning *`,
        [
          t.name,
          t.title          ?? "",
          t.type           ?? null,
          t.priority       ?? "Media",
          t.status         ?? "No iniciado",
          t.estimated_time ?? "",
          t.notes          ?? "",
          t.materials      ?? "",
          t.vehicle        ?? "",
          t.phone          ?? "",
          t.client_id      || null,
          t.technician_ids ?? [],
          JSON.stringify(t.type_fields ?? {}),
          req.user.id,
        ]
      );
      emit("task-templates:change", { type: "insert", template: rows[0] });
      res.json(rows[0]);
    } catch (err) {
      logger.error({ err }, "[task-templates/create]");
      res.status(500).json({ error: "Error creando plantilla" });
    }
  }
);

// ─── PUT /api/task-templates/:id ─────────────────────────
taskTemplatesRouter.put(
  "/:id",
  canManage,
  validate(schemas.taskTemplateUpdate),
  async (req, res) => {
    try {
      const t = req.body || {};
      const { rows } = await query(
        `update task_templates set
           name = $1, title = $2, type = $3, priority = $4, status = $5,
           estimated_time = $6, notes = $7, materials = $8, vehicle = $9,
           phone = $10, client_id = $11, technician_ids = $12,
           type_fields = $13
         where id = $14 returning *`,
        [
          t.name,
          t.title          ?? "",
          t.type           ?? null,
          t.priority       ?? "Media",
          t.status         ?? "No iniciado",
          t.estimated_time ?? "",
          t.notes          ?? "",
          t.materials      ?? "",
          t.vehicle        ?? "",
          t.phone          ?? "",
          t.client_id      || null,
          t.technician_ids ?? [],
          JSON.stringify(t.type_fields ?? {}),
          req.params.id,
        ]
      );
      if (!rows[0]) return res.status(404).json({ error: "Plantilla no encontrada" });
      emit("task-templates:change", { type: "update", template: rows[0] });
      res.json(rows[0]);
    } catch (err) {
      logger.error({ err }, "[task-templates/update]");
      res.status(500).json({ error: "Error actualizando plantilla" });
    }
  }
);

// ─── DELETE /api/task-templates/:id ──────────────────────
taskTemplatesRouter.delete("/:id", canManage, async (req, res) => {
  try {
    await query("delete from task_templates where id = $1", [req.params.id]);
    emit("task-templates:change", { type: "delete", id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[task-templates/delete]");
    res.status(500).json({ error: "Error borrando plantilla" });
  }
});
