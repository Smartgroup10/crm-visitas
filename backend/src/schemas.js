import { z } from "zod";

/**
 * Esquemas de validación para los payloads de la API.
 *
 * Filosofía:
 *  - Validamos tipos, formato y límites razonables (evitar payloads gigantes
 *    o de tipo inesperado que reventarían la BBDD o serían amplificadores
 *    de ataque).
 *  - Las reglas semánticas "de negocio" (por ejemplo, "no puedes borrarte
 *    a ti mismo", "el admin no puede demotearse") siguen viviendo en el
 *    handler de la ruta: no son cuestiones de forma del payload.
 *  - Los campos con default en el schema de BBDD se tratan como opcionales
 *    aquí; el router ya rellena a `""`, `null` o `[]` cuando faltan.
 */

// Helpers ----------------------------------------------------------
const trimmed = (max) => z.string().trim().max(max);
const optionalString = (max) => trimmed(max).optional();
const uuid = z.string().uuid();

const ROLES = ["admin", "supervisor", "tecnico"];

// Campos de una tarea (forma común compartida por POST / PUT) -----
const taskShape = {
  title:           trimmed(500).min(1, "El título es obligatorio"),
  date:            z.string().max(30).nullable().optional(),     // "YYYY-MM-DD" o null
  status:          optionalString(50),
  priority:        optionalString(50),
  client_id:       uuid.nullable().optional(),
  phone:           optionalString(40),
  technician_ids:  z.array(uuid).optional(),
  vehicle:         optionalString(200),
  type:            z.string().trim().max(100).nullable().optional(),
  notes:           optionalString(10_000),
  materials:       optionalString(10_000),
  estimated_time:  optionalString(100),
  attachments:     z.array(z.any()).max(50).optional(),
  type_fields:     z.record(z.any()).optional(),
};

// Esquemas públicos ------------------------------------------------
export const schemas = {
  // Auth
  login: z.object({
    email: trimmed(255).min(1, "Email requerido").toLowerCase(),
    password: z.string().min(1, "Contraseña requerida").max(200),
  }),

  // Clients
  clientCreate: z.object({
    name: trimmed(200).min(1, "Nombre requerido"),
  }),
  clientUpdate: z.object({
    name: trimmed(200).min(1, "Nombre requerido"),
  }),

  // Tasks. No usamos .strict(): si el frontend envía campos legacy que
  // ya no se persisten (p.ej. campos específicos de un tipo que quitamos
  // de la UI), zod los descarta silenciosamente en lugar de rechazar la
  // request. El handler sólo lee las claves que le interesan.
  taskCreate: z.object(taskShape),
  taskUpdate: z.object(taskShape),
  // PATCH: cualquier subconjunto de campos conocidos; el resto se ignora.
  taskPatch: z
    .object(
      Object.fromEntries(
        Object.entries(taskShape).map(([k, v]) => [k, v.optional()])
      )
    )
    .refine((d) => Object.keys(d).length > 0, {
      message: "Nada que actualizar",
    }),

  // Users (== miembros del equipo: admin / supervisor / tecnico).
  // phone y specialty se usan para el directorio del equipo y para la
  // vista de informes; no influyen en autenticación ni autorización.
  userCreate: z.object({
    email:     trimmed(255).toLowerCase().email("Email inválido"),
    name:      optionalString(200),
    password:  z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(200),
    role:      z.enum(ROLES).optional().default("tecnico"),
    phone:     optionalString(40),
    specialty: optionalString(200),
  }),
  userUpdate: z.object({
    name:      optionalString(200),
    role:      z.enum(ROLES),
    phone:     optionalString(40),
    specialty: optionalString(200),
  }),
  passwordChange: z.object({
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(200),
  }),

  // Preferencias del usuario actual. Ambos campos opcionales: el endpoint
  // sólo actualiza los que llegan, dejando los demás intactos.
  preferencesUpdate: z
    .object({
      notify_email_enabled: z.boolean().optional(),
      // Antelación del recordatorio para tareas programadas (en minutos).
      // 0 = "al empezar". Cap a 24h para no programar jobs absurdos.
      notify_lead_minutes: z.number().int().min(0).max(24 * 60).optional(),
    })
    .refine((d) => Object.keys(d).length > 0, {
      message: "Nada que actualizar",
    }),

  // Recordatorios personales. `remind_at` debe ser una fecha ISO válida
  // (el frontend pasa Date.toISOString()). No exigimos que sea futura aquí
  // porque el handler ya decide qué hacer si la fecha ya pasó (programar
  // un job inmediato o rechazar, según política).
  reminderCreate: z.object({
    title:     trimmed(200).min(1, "El título es obligatorio"),
    body:      optionalString(2000),
    remind_at: z.string().datetime({ offset: true }),
  }),
  reminderUpdate: z
    .object({
      title:     trimmed(200).min(1, "El título es obligatorio").optional(),
      body:      optionalString(2000),
      remind_at: z.string().datetime({ offset: true }).optional(),
    })
    .refine((d) => Object.keys(d).length > 0, {
      message: "Nada que actualizar",
    }),
};

// Middleware -------------------------------------------------------
/**
 * Valida `req.body` contra un esquema de zod. Si pasa, reemplaza
 * `req.body` por el objeto parseado (con trims y defaults aplicados);
 * si no, responde 400 con la lista de errores por campo.
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join(".") || "_",
        message: issue.message,
      }));
      return res.status(400).json({
        error: "Datos inválidos",
        details,
      });
    }
    req.body = result.data;
    next();
  };
}
