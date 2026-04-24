import { Router } from "express";
import bcrypt from "bcryptjs";
import { query } from "../db.js";
import { emit } from "../io.js";
import { logger } from "../logger.js";

export const usersRouter = Router();

// Roles permitidos (debe coincidir con el check constraint de schema.sql)
const VALID_ROLES = new Set(["admin", "supervisor", "tecnico"]);
const MIN_PASSWORD_LENGTH = 8;

function publicUser(row) {
  // Nunca devolvemos el password_hash al frontend
  return {
    id:         row.id,
    email:      row.email,
    name:       row.name,
    role:       row.role,
    created_at: row.created_at,
  };
}

function normalizeEmail(email) {
  return (email || "").toLowerCase().trim();
}

// ─── GET /api/users ──────────────────────────────────────
usersRouter.get("/", async (_req, res) => {
  try {
    const { rows } = await query(
      "select id, email, name, role, created_at from users order by created_at asc"
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "[users/list]");
    res.status(500).json({ error: "Error obteniendo usuarios" });
  }
});

// ─── POST /api/users ─────────────────────────────────────
usersRouter.post("/", async (req, res) => {
  try {
    const email    = normalizeEmail(req.body?.email);
    const name     = (req.body?.name || "").trim();
    const password = req.body?.password || "";
    const role     = (req.body?.role || "tecnico").trim();

    if (!email)                   return res.status(400).json({ error: "Email requerido" });
    if (!VALID_ROLES.has(role))   return res.status(400).json({ error: "Rol inválido" });
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
      });
    }

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `insert into users (email, password_hash, name, role)
       values ($1, $2, $3, $4)
       returning id, email, name, role, created_at`,
      [email, hash, name, role]
    );
    emit("users:change", { type: "insert", user: rows[0] });
    res.json(rows[0]);
  } catch (err) {
    if (err?.code === "23505") {
      // duplicado de email (unique constraint)
      return res.status(409).json({ error: "Ya existe un usuario con ese email" });
    }
    logger.error({ err }, "[users/create]");
    res.status(500).json({ error: "Error creando usuario" });
  }
});

// ─── PUT /api/users/:id ──────────────────────────────────
// Actualiza nombre y/o rol. El email no se cambia (sería liarla con logins).
usersRouter.put("/:id", async (req, res) => {
  try {
    const name = (req.body?.name || "").trim();
    const role = (req.body?.role || "").trim();

    if (!VALID_ROLES.has(role)) return res.status(400).json({ error: "Rol inválido" });

    // Protección: evitar que el admin se quite el rol a sí mismo (se quedaría sin acceso)
    if (req.user.id === req.params.id && role !== "admin") {
      return res.status(400).json({
        error: "No puedes quitarte el rol de admin a ti mismo",
      });
    }

    const { rows } = await query(
      `update users set name = $1, role = $2 where id = $3
       returning id, email, name, role, created_at`,
      [name, role, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Usuario no encontrado" });
    emit("users:change", { type: "update", user: rows[0] });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "[users/update]");
    res.status(500).json({ error: "Error actualizando usuario" });
  }
});

// ─── PATCH /api/users/:id/password ───────────────────────
// Reset de contraseña (por admin). Si quisieras que el propio usuario se
// la cambie, sería una ruta aparte con comprobación de la password actual.
usersRouter.patch("/:id/password", async (req, res) => {
  try {
    const password = req.body?.password || "";
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
      });
    }
    const hash = await bcrypt.hash(password, 10);
    const { rowCount } = await query(
      "update users set password_hash = $1 where id = $2",
      [hash, req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[users/password]");
    res.status(500).json({ error: "Error actualizando contraseña" });
  }
});

// ─── DELETE /api/users/:id ───────────────────────────────
usersRouter.delete("/:id", async (req, res) => {
  try {
    // Protección: no permitir borrarse a uno mismo (evita dejarse sin admins
    // accidentalmente si era el único).
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: "No puedes borrarte a ti mismo" });
    }
    const { rowCount } = await query("delete from users where id = $1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "Usuario no encontrado" });
    emit("users:change", { type: "delete", id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[users/delete]");
    res.status(500).json({ error: "Error borrando usuario" });
  }
});

// Exporta helpers por si los necesitas en otro sitio
export { VALID_ROLES, publicUser };
