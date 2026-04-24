import jwt from "jsonwebtoken";
import { logger } from "./logger.js";

/**
 * Resolución del secreto JWT.
 *
 * En producción es obligatorio: si no está definido, abortamos el arranque.
 * En desarrollo permitimos un fallback visible para no bloquear el trabajo
 * local, pero lo avisamos por consola para que nadie lo promueva sin querer.
 */
const IS_PROD = process.env.NODE_ENV === "production";
const RAW_SECRET = process.env.JWT_SECRET;

if (IS_PROD && !RAW_SECRET) {
  logger.fatal(
    "[auth] JWT_SECRET no está definido. El servidor no puede arrancar en producción sin un secreto."
  );
  process.exit(1);
}
if (!RAW_SECRET) {
  logger.warn("[auth] JWT_SECRET no definido; usando valor de desarrollo inseguro");
}

const SECRET = RAW_SECRET || "dev-secret";
const TOKEN_TTL = "7d";

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Sin sesión" });
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Sesión inválida o caducada" });
  }
}

/**
 * Middleware de autorización por rol. Usar SIEMPRE después de authMiddleware.
 *   app.use('/api/users', authMiddleware, requireRole('admin'), usersRouter);
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Sin sesión" });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Permiso insuficiente" });
    }
    next();
  };
}
