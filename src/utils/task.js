import { getClientName, peopleFromIds } from "./id";
import { defaultsForType, TASK_TYPES } from "../data/taskTypes";

export function emptyTask(date, type = "incidencia") {
  return {
    id: null,
    title: "",
    clientId: "",
    phone: "",
    type,
    date,
    startTime: "",
    technicianIds: [],
    status: "No iniciado",
    priority: "Media",
    notes: "",
    materials: "",
    estimatedTime: "",
    vehicle: "",
    attachments: [],
    ...defaultsForType(type),
  };
}

export function normalizeTask(task) {
  return {
    ...task,
    technicianIds: Array.isArray(task.technicianIds) ? task.technicianIds : [],
    attachments: Array.isArray(task.attachments) ? task.attachments : [],
  };
}

/**
 * Predicado canónico de "tarea que requiere atención inmediata":
 *   - estado Bloqueado (independientemente de prioridad)
 *   - O urgente y aún no iniciada
 *
 * Usado por el badge del Sidebar y la sección "Requieren acción"
 * de Mi Trabajo. Mantenerlo en un único sitio evita derivas (un
 * lugar diciendo 7 y otro diciendo 9 para los mismos datos).
 */
export function requiresAttention(task) {
  return (
    task.status === "Bloqueado" ||
    (task.priority === "Urgente" && task.status === "No iniciado")
  );
}

export function getAttentionTasks(tasks) {
  return tasks.filter(requiresAttention);
}

// ─── Detección de solapamiento de horario ─────────────────────
// Cuando el supervisor asigna una tarea a un técnico que ya tiene
// otra reservada en esa franja, el modal pinta un aviso. No es
// bloqueante — a veces se solapa a propósito (revisión + intervención
// breve, dos cosas en el mismo sitio…). Sólo informativo.

/**
 * Convierte "HH:MM" a minutos desde medianoche. Devuelve null si
 * el input no es válido (string vacío, formato distinto). */
function timeToMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== "string") return null;
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Parsea `estimatedTime` (campo de texto libre) a minutos. Soporta
 * los formatos que usa el equipo en la práctica:
 *   "2 horas", "2h", "1h 30min", "30 min", "1.5h", "90", "1,5"
 * Si no consigue parsear, devuelve `defaultMin` (60 por defecto —
 * asumimos una hora cuando se desconoce, valor razonable para que el
 * detector de solapamientos funcione aunque el campo esté vacío). */
export function parseEstimatedMinutes(text, defaultMin = 60) {
  if (text == null) return defaultMin;
  const cleaned = String(text).toLowerCase().trim();
  if (!cleaned) return defaultMin;

  let total = 0;

  // "2h" / "2 horas" / "1.5h" / "1,5 horas"
  const hoursMatch = cleaned.match(/(\d+(?:[.,]\d+)?)\s*(?:h(?:ora)?s?)\b/);
  if (hoursMatch) {
    total += parseFloat(hoursMatch[1].replace(",", ".")) * 60;
  }

  // "30 min" / "30min" / "30 minutos"
  const minsMatch = cleaned.match(/(\d+)\s*(?:min(?:uto)?s?)\b/);
  if (minsMatch) {
    total += parseInt(minsMatch[1], 10);
  }

  // Si no había unidad y es un número solo, asumimos horas
  if (total === 0) {
    const numMatch = cleaned.match(/^(\d+(?:[.,]\d+)?)$/);
    if (numMatch) {
      total = parseFloat(numMatch[1].replace(",", ".")) * 60;
    }
  }

  return total > 0 ? total : defaultMin;
}

/**
 * ¿Solapan dos tareas en el calendario?
 *   - Mismo día
 *   - Ambas con `startTime`
 *   - Ventanas [start, start+duración) se cruzan
 *
 * Si una tarea no tiene `startTime`, no hay solape posible.
 * `estimatedTime` se parsea con fallback de 60 min. */
export function tasksOverlap(a, b) {
  if (!a || !b) return false;
  if (a.date !== b.date) return false;
  const aStart = timeToMinutes(a.startTime);
  const bStart = timeToMinutes(b.startTime);
  if (aStart === null || bStart === null) return false;
  const aEnd = aStart + parseEstimatedMinutes(a.estimatedTime);
  const bEnd = bStart + parseEstimatedMinutes(b.estimatedTime);
  // [aStart, aEnd) ∩ [bStart, bEnd) ≠ ∅
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Devuelve las tareas del listado que solapan con `draft` y
 * comparten al menos un técnico asignado. Excluye la propia tarea
 * (cuando se está editando). Resultado pensado para mostrar en un
 * aviso del TaskModal. */
export function findTaskConflicts(draft, allTasks) {
  if (!draft || !draft.date || !draft.startTime) return [];
  const draftTechs = draft.technicianIds || [];
  if (draftTechs.length === 0) return [];

  const techSet = new Set(draftTechs);
  const draftId = draft.id || null;

  return (allTasks || []).filter((other) => {
    if (!other) return false;
    if (other.id === draftId) return false;            // no auto-conflict
    if (other.date !== draft.date) return false;       // distinto día
    if (!other.startTime) return false;                // sin hora
    // Comparten algún técnico
    const otherTechs = other.technicianIds || [];
    if (!otherTechs.some((id) => techSet.has(id))) return false;
    return tasksOverlap(draft, other);
  });
}

export function taskHaystack(task, clients, technicians) {
  const typeLabel = TASK_TYPES[task.type]?.label || task.type || "";
  return [
    task.title,
    getClientName(task.clientId, clients),
    task.phone,
    peopleFromIds(task.technicianIds, technicians),
    typeLabel,
    task.notes,
    task.materials,
    task.estimatedTime,
    task.vehicle,
    ...(task.attachments || []).map((f) => f.name),
  ]
    .join(" ")
    .toLowerCase();
}
