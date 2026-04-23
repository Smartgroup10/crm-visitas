import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.warn("[auth] JWT_SECRET no definido; usando valor de desarrollo inseguro");
}

const TOKEN_TTL = "7d";

export function signToken(payload) {
  return jwt.sign(payload, SECRET || "dev-secret", { expiresIn: TOKEN_TTL });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET || "dev-secret");
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
