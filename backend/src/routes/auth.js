import { Router } from "express";
import bcrypt from "bcryptjs";
import { query } from "../db.js";
import { signToken, authMiddleware } from "../auth.js";
import { logger } from "../logger.js";
import { schemas, validate } from "../schemas.js";

export const authRouter = Router();

// ─── POST /api/auth/login ─────────────────────────────────
authRouter.post("/login", validate(schemas.login), async (req, res) => {
  try {
    // email ya viene trim + lowercase aplicados por el schema
    const { email, password } = req.body;

    const { rows } = await query(
      "select id, email, password_hash, name, role from users where email = $1",
      [email]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Credenciales inválidas" });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Credenciales inválidas" });

    const payload = {
      id:    user.id,
      email: user.email,
      name:  user.name,
      role:  user.role,
    };
    const token = signToken(payload);
    res.json({ token, user: payload });
  } catch (err) {
    logger.error({ err }, "[auth/login]");
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ─── GET /api/auth/me ────────────────────────────────────
// Devuelve el perfil leído fresco de BD, no el del JWT (que está cacheado
// hasta 7 días). Si un admin te promueve o degrada, el frontend ve el
// cambio en la siguiente recarga sin necesidad de cerrar sesión.
authRouter.get("/me", authMiddleware, async (req, res) => {
  try {
    const { rows } = await query(
      "select id, email, name, role from users where id = $1",
      [req.user.id]
    );
    const fresh = rows[0];
    if (!fresh) return res.status(401).json({ error: "Usuario no existe" });
    res.json(fresh);
  } catch (err) {
    logger.error({ err }, "[auth/me]");
    res.status(500).json({ error: "Error leyendo perfil" });
  }
});
