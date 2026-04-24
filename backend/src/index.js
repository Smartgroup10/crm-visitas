import express from "express";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";

import { authMiddleware, verifyToken } from "./auth.js";
import { setIO } from "./io.js";
import { pool } from "./db.js";
import { applySchema, seedAdmin, waitForDb } from "./seed.js";
import { logger } from "./logger.js";

import { authRouter }        from "./routes/auth.js";
import { tasksRouter }       from "./routes/tasks.js";
import { clientsRouter }     from "./routes/clients.js";
import { usersRouter }       from "./routes/users.js";

const IS_PROD = process.env.NODE_ENV === "production";

// ─── Configuración CORS ──────────────────────────────────
// En producción exigimos CORS_ORIGIN explícito. El fallback "*" solo se acepta
// en desarrollo, para no dejar el backend abierto al mundo por accidente.
const corsOrigin = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (IS_PROD && (corsOrigin.length === 0 || corsOrigin.includes("*"))) {
  logger.fatal(
    "[backend] CORS_ORIGIN debe estar definido y no puede ser '*' en producción."
  );
  process.exit(1);
}

const allowAnyOrigin = corsOrigin.length === 0 || corsOrigin.includes("*");
const corsOptions = {
  origin: allowAnyOrigin ? true : corsOrigin,
  credentials: true,
};

// ─── App y servidor ──────────────────────────────────────
const app = express();
// Estamos detrás del reverse proxy de Coolify: confiamos en el primer hop
// para que req.ip devuelva la IP real del cliente (necesario para el
// rate-limiter). No usamos `true` porque habilitaría IP spoofing.
app.set("trust proxy", 1);
const server = createServer(app);

const io = new SocketServer(server, {
  cors: corsOptions,
  path: "/socket.io",
});
setIO(io);

// Logger HTTP: una línea estructurada por request (método, path, status,
// latencia, req-id). Lo ponemos lo primero para que cualquier error
// posterior quede asociado al request que lo disparó.
app.use(
  pinoHttp({
    logger,
    // No inundamos los logs con los health checks (Coolify los pulsa
    // constantemente). Los errores de /health/ready siguen registrándose
    // porque llegan por logger.error desde la ruta.
    autoLogging: {
      ignore: (req) => req.url?.startsWith("/health"),
    },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
  })
);

// Cabeceras de seguridad. Deshabilitamos CSP aquí porque el frontend se sirve
// aparte (Vite) y la API solo devuelve JSON; lo dejamos para el reverse proxy.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(corsOptions));
app.use(express.json({ limit: "5mb" }));

// ─── Rate limit del login ────────────────────────────────
// Tope estricto para desincentivar fuerza bruta sobre /api/auth/login.
// El resto de endpoints quedan detrás de JWT, así que no los limitamos
// globalmente para no perjudicar el uso normal del CRM.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,       // 15 min
  limit: 10,                       // 10 intentos por IP / ventana
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Prueba en unos minutos." },
});
app.use("/api/auth/login", loginLimiter);

// ─── Health checks ───────────────────────────────────────
// /health/live: el proceso responde (usar para liveness probe).
// /health/ready: el pool de Postgres responde (usar para readiness probe).
app.get("/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});
app.get("/health/live", (_req, res) => {
  res.json({ ok: true });
});
app.get("/health/ready", async (_req, res) => {
  try {
    await pool.query("select 1");
    res.json({ ok: true });
  } catch (err) {
    res.status(503).json({ ok: false, error: "db_unavailable" });
  }
});

// ─── Rutas ───────────────────────────────────────────────
app.use("/api/auth",    authRouter);
app.use("/api/tasks",   authMiddleware, tasksRouter);
app.use("/api/clients", authMiddleware, clientsRouter);
// Gestión del equipo (usuarios). El listado es accesible a cualquier usuario
// autenticado (se usa para asignar tareas, filtrar, etc.), pero las
// operaciones de escritura se restringen dentro del router a admin.
app.use("/api/users",   authMiddleware, usersRouter);

// ─── Socket.io: autenticación en handshake ───────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Unauthorized"));
  try {
    socket.data.user = verifyToken(token);
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  const user = socket.data.user;
  logger.info({ user: user?.email || user?.id }, "[socket] conectado");
  socket.on("disconnect", () => {
    logger.info({ user: user?.email || user?.id }, "[socket] desconectado");
  });
});

// ─── Arranque ────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3001;

(async () => {
  try {
    await waitForDb();
    await applySchema();
    await seedAdmin();
    server.listen(PORT, () => {
      logger.info(
        { port: PORT, corsOrigin: allowAnyOrigin ? "*" : corsOrigin },
        "[backend] escuchando"
      );
    });
  } catch (err) {
    logger.fatal({ err }, "[backend] fallo al arrancar");
    process.exit(1);
  }
})();

// ─── Graceful shutdown ───────────────────────────────────
// Coolify/K8s envían SIGTERM al redesplegar. Cerramos el servidor HTTP,
// los sockets abiertos y el pool de Postgres para no dejar conexiones
// colgando ni perder escrituras en vuelo.
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "[backend] cerrando con gracia...");

  // Forzamos salida si algo se queda colgado más de 10s.
  const killTimer = setTimeout(() => {
    logger.error("[backend] shutdown forzado tras 10s");
    process.exit(1);
  }, 10_000);
  killTimer.unref();

  try {
    io.close();
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
    logger.info("[backend] cerrado limpiamente");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "[backend] error durante shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
