import jwt from "jsonwebtoken";
import { logger } from "./logger.js";
import { query } from "./db.js";

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
 *
 * Lee el rol actual de la BD en vez de confiar en el payload del JWT (que
 * tiene TTL de 7 días): si un admin promueve a alguien, no tiene que cerrar
 * sesión. Y si el admin pierde el rol, deja de tener acceso inmediatamente
 * en la siguiente petición. El coste es una SELECT corta por cada request
 * protegida — aceptable y cacheada por el pool de pg.
 */
export function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Sin sesión" });
    try {
      const { rows } = await query(
        "select role from users where id = $1",
        [req.user.id]
      );
      const currentRole = rows[0]?.role;
      if (!currentRole) {
        // El user del JWT ya no existe en BD (borrado)
        return res.status(401).json({ error: "Usuario no existe" });
      }
      // Refrescamos el req.user para que los handlers posteriores vean el
      // rol actualizado sin tener que repetir la consulta.
      req.user.role = currentRole;
      if (!allowedRoles.includes(currentRole)) {
        return res.status(403).json({ error: "Permiso insuficiente" });
      }
      next();
    } catch (err) {
      logger.error({ err }, "[auth/requireRole]");
      res.status(500).json({ error: "Error verificando permisos" });
    }
  };
}
