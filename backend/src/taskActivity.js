// ============================================================
// Activity log de tareas
// ============================================================
// Registra cada cambio en una tarea (create / update con diff / delete)
// en la tabla `task_activity`. Lo consume el endpoint
// `GET /api/tasks/:id/activity` y lo pinta el componente
// `TaskActivityTimeline` del frontend.
//
// Filosofía:
//   - El log no es la fuente de verdad — la tarea es. Aquí guardamos
//     metadatos de auditoría legibles para humanos. Por eso resolvemos
//     los UUIDs de cliente y técnicos a NOMBRES en el momento del
//     cambio: si más tarde se renombra un cliente, el timeline sigue
//     mostrando el nombre que tenía cuando se hizo el cambio (snapshot
//     temporal — comportamiento típico de audit logs).
//   - `recordTaskActivity` nunca lanza: si el INSERT falla, lo logueamos
//     y devolvemos. NO debe poder tumbar el flujo del CRUD que la
//     invocó.
//   - Los campos que NO aportan al usuario final (attachments, type_fields,
//     created_by, updated_by) se ignoran al construir el diff. Son
//     internos o demasiado verbosos para un timeline.
// ============================================================

import { query } from "./db.js";
import { logger } from "./logger.js";

// Mapeo de columnas de tasks a labels legibles. Sólo los campos en este
// mapa se loguean en el changeset.
const TRACKED_FIELDS = {
  title:          "Título",
  date:           "Fecha",
  start_time:     "Hora",
  status:         "Estado",
  priority:       "Prioridad",
  type:           "Tipo",
  notes:          "Notas",
  materials:      "Materiales",
  estimated_time: "Tiempo estimado",
  vehicle:        "Vehículo",
  phone:          "Teléfono",
};

// Normaliza nulos y strings vacíos a un único valor (null) para que el
// diff no marque cambio entre `""` y `null` (que semánticamente son lo
// mismo: "campo sin valor").
function normalize(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  return v;
}

async function lookupClientNames(ids) {
  const filtered = [...new Set(ids)].filter(Boolean);
  if (filtered.length === 0) return {};
  const { rows } = await query(
    "select id, name from clients where id = any($1::uuid[])",
    [filtered]
  );
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}

async function lookupUserNames(ids) {
  const filtered = [...new Set(ids)].filter(Boolean);
  if (filtered.length === 0) return {};
  const { rows } = await query(
    "select id, coalesce(nullif(name, ''), email) as name from users where id = any($1::uuid[])",
    [filtered]
  );
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}

/**
 * Compara prev vs next y devuelve un array de cambios legibles.
 *
 * Formato del array:
 *   [{ kind: "field", field, label, from, to }]
 *   [{ kind: "tech_added",   users: [{id, name}, ...] }]
 *   [{ kind: "tech_removed", users: [{id, name}, ...] }]
 *
 * Si no hay cambios, devuelve []. El caller decide si registra
 * `updated` (cuando hay >0 cambios) o no registra nada.
 */
export async function buildTaskChangeset(prev, next) {
  if (!next) return [];
  const changes = [];

  // 1) Campos escalares.
  for (const [field, label] of Object.entries(TRACKED_FIELDS)) {
    const a = normalize(prev?.[field]);
    const b = normalize(next?.[field]);
    if (a !== b) {
      changes.push({
        kind: "field",
        field,
        label,
        from: prev?.[field] ?? null,
        to: next?.[field] ?? null,
      });
    }
  }

  // 2) Cliente (resolvemos UUID → nombre para el timeline).
  if ((prev?.client_id ?? null) !== (next?.client_id ?? null)) {
    const names = await lookupClientNames([prev?.client_id, next?.client_id]);
    changes.push({
      kind: "field",
      field: "client_id",
      label: "Cliente",
      from: prev?.client_id ? names[prev.client_id] || "—" : null,
      to:   next?.client_id ? names[next.client_id] || "—" : null,
    });
  }

  // 3) Técnicos: añadidos / eliminados, con nombres.
  const prevTechs = new Set(prev?.technician_ids || []);
  const nextTechs = new Set(next?.technician_ids || []);
  const added   = [...nextTechs].filter((x) => !prevTechs.has(x));
  const removed = [...prevTechs].filter((x) => !nextTechs.has(x));
  if (added.length > 0 || removed.length > 0) {
    const names = await lookupUserNames([...added, ...removed]);
    if (added.length > 0) {
      changes.push({
        kind: "tech_added",
        users: added.map((id) => ({ id, name: names[id] || "Usuario" })),
      });
    }
    if (removed.length > 0) {
      changes.push({
        kind: "tech_removed",
        users: removed.map((id) => ({ id, name: names[id] || "Usuario" })),
      });
    }
  }

  return changes;
}

/**
 * Inserta una entrada en task_activity. Tolerante a errores: cualquier
 * fallo se loguea pero no propaga (el CRUD principal no debe tumbarse
 * porque el log de auditoría falle).
 */
export async function recordTaskActivity({ taskId, actorId, type, payload }) {
  if (!taskId || !type) return;
  try {
    await query(
      `insert into task_activity (task_id, actor_id, type, payload)
       values ($1, $2, $3, $4::jsonb)`,
      [taskId, actorId || null, type, JSON.stringify(payload || {})]
    );
  } catch (err) {
    logger.error({ err, taskId, type }, "[taskActivity] error registrando");
  }
}

/**
 * Helper de alto nivel: dado prev/next, calcula el diff y registra la
 * actividad correspondiente. Si no hay cambios, no graba nada.
 *   - prev=null, next=task    → "created"
 *   - prev=task, next=task'   → "updated" con changes (si hay)
 *   - prev=task, next=null    → "deleted" (no se hará persistente por
 *     cascade, pero queda como hook por si en el futuro guardamos
 *     historial de borradas).
 */
export async function recordTaskChange({ prev, next, actorId }) {
  if (!prev && next) {
    await recordTaskActivity({
      taskId: next.id,
      actorId,
      type: "created",
      payload: {},
    });
    return;
  }
  if (prev && !next) {
    await recordTaskActivity({
      taskId: prev.id,
      actorId,
      type: "deleted",
      payload: {},
    });
    return;
  }
  if (prev && next) {
    const changes = await buildTaskChangeset(prev, next);
    if (changes.length === 0) return;
    await recordTaskActivity({
      taskId: next.id,
      actorId,
      type: "updated",
      payload: { changes },
    });
  }
}

/**
 * Devuelve el timeline de una tarea, joineando con users para incluir
 * el nombre del actor (más limpio que tener que llamar otro endpoint
 * desde el frontend para resolver los IDs).
 */
export async function getTaskActivity(taskId) {
  const { rows } = await query(
    `select a.id, a.task_id, a.type, a.payload, a.created_at,
            a.actor_id, coalesce(nullif(u.name, ''), u.email) as actor_name
       from task_activity a
       left join users u on u.id = a.actor_id
      where a.task_id = $1
      order by a.created_at desc`,
    [taskId]
  );
  return rows;
}
