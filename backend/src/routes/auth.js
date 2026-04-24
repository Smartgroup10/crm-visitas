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
authRouter.get("/me", authMiddleware, (req, res) => {
  // Devuelve los datos del token. Si quieres refrescar con BD, consulta users.
  res.json(req.user);
});
