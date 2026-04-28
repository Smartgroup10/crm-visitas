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

// ─── COMENTARIOS DE TAREAS ───────────────────────────────
//
// Diseño:
//   - Cualquier usuario autenticado puede LEER los comentarios y
//     ESCRIBIR uno nuevo (incluidos técnicos, no es restringido a
//     admins — el sentido del hilo es que el técnico aporte info
//     desde campo).
//   - Sólo el AUTOR puede editar o borrar su propio comentario. Esto
//     se valida en el handler con `req.user.id === author_id`. No lo
//     delegamos al middleware porque depende del recurso concreto.
//   - Emitimos un evento socket `task-comments:change` por cada
//     mutación, con la fila completa, para que el frontend lo refleje
//     en tiempo real (igual que `tasks:change`).

// GET /api/tasks/:id/comments — listar
tasksRouter.get("/:id/comments", authMiddleware, async (req, res) => {
  try {
    const { rows } = await query(
      `select c.id, c.task_id, c.body, c.created_at, c.edited_at,
              c.author_id,
              coalesce(nullif(u.name, ''), u.email) as author_name
         from task_comments c
         left join users u on u.id = c.author_id
        where c.task_id = $1
        order by c.created_at asc`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "[tasks/comments/list]");
    res.status(500).json({ error: "Error obteniendo comentarios" });
  }
});

// POST /api/tasks/:id/comments — crear
tasksRouter.post(
  "/:id/comments",
  authMiddleware,
  validate(schemas.taskCommentCreate),
  async (req, res) => {
    try {
      // Validamos primero que la tarea exista — si el id es inventado,
      // mejor 404 que un INSERT que fallaría por FK con un mensaje feo.
      const { rows: taskRows } = await query(
        "select id from tasks where id = $1",
        [req.params.id]
      );
      if (!taskRows[0]) return res.status(404).json({ error: "Tarea no encontrada" });

      const { rows } = await query(
        `insert into task_comments (task_id, author_id, body)
         values ($1, $2, $3)
         returning id, task_id, body, created_at, edited_at, author_id`,
        [req.params.id, req.user.id, req.body.body]
      );
      // Joineamos el nombre para devolver la fila lista para pintar.
      const { rows: nameRows } = await query(
        "select coalesce(nullif(name, ''), email) as name from users where id = $1",
        [req.user.id]
      );
      const enriched = { ...rows[0], author_name: nameRows[0]?.name || null };
      emit("task-comments:change", { type: "insert", taskId: req.params.id, comment: enriched });
      res.json(enriched);
    } catch (err) {
      logger.error({ err }, "[tasks/comments/create]");
      res.status(500).json({ error: "Error creando comentario" });
    }
  }
);

// PUT /api/tasks/:taskId/comments/:commentId — editar (solo autor)
tasksRouter.put(
  "/:taskId/comments/:commentId",
  authMiddleware,
  validate(schemas.taskCommentUpdate),
  async (req, res) => {
    try {
      // Comprobamos autoría antes de tocar la fila. Si no es el autor,
      // 403 (no 404, queremos diferenciar "no existe" de "no es tuyo").
      const { rows: existing } = await query(
        "select author_id from task_comments where id = $1 and task_id = $2",
        [req.params.commentId, req.params.taskId]
      );
      if (!existing[0]) return res.status(404).json({ error: "Comentario no encontrado" });
      if (existing[0].author_id !== req.user.id) {
        return res.status(403).json({ error: "Sólo el autor puede editar el comentario" });
      }

      const { rows } = await query(
        `update task_comments
            set body = $1, edited_at = now()
          where id = $2
          returning id, task_id, body, created_at, edited_at, author_id`,
        [req.body.body, req.params.commentId]
      );
      const { rows: nameRows } = await query(
        "select coalesce(nullif(name, ''), email) as name from users where id = $1",
        [req.user.id]
      );
      const enriched = { ...rows[0], author_name: nameRows[0]?.name || null };
      emit("task-comments:change", { type: "update", taskId: req.params.taskId, comment: enriched });
      res.json(enriched);
    } catch (err) {
      logger.error({ err }, "[tasks/comments/update]");
      res.status(500).json({ error: "Error actualizando comentario" });
    }
  }
);

// DELETE /api/tasks/:taskId/comments/:commentId — borrar (solo autor)
tasksRouter.delete(
  "/:taskId/comments/:commentId",
  authMiddleware,
  async (req, res) => {
    try {
      const { rows: existing } = await query(
        "select author_id from task_comments where id = $1 and task_id = $2",
        [req.params.commentId, req.params.taskId]
      );
      if (!existing[0]) return res.status(404).json({ error: "Comentario no encontrado" });
      if (existing[0].author_id !== req.user.id) {
        return res.status(403).json({ error: "Sólo el autor puede eliminar el comentario" });
      }

      await query("delete from task_comments where id = $1", [req.params.commentId]);
      emit("task-comments:change", {
        type: "delete",
        taskId: req.params.taskId,
        commentId: req.params.commentId,
      });
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "[tasks/comments/delete]");
      res.status(500).json({ error: "Error borrando comentario" });
    }
  }
);
