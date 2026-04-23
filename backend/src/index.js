import express from "express";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import cors from "cors";

import { authMiddleware, verifyToken } from "./auth.js";
import { setIO } from "./io.js";
import { seedAdmin, waitForDb } from "./seed.js";

import { authRouter }        from "./routes/auth.js";
import { tasksRouter }       from "./routes/tasks.js";
import { clientsRouter }     from "./routes/clients.js";
import { techniciansRouter } from "./routes/technicians.js";

// ─── Configuración CORS ──────────────────────────────────
const corsOrigin = (process.env.CORS_ORIGIN || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin: corsOrigin.length === 1 && corsOrigin[0] === "*" ? true : corsOrigin,
  credentials: true,
};

// ─── App y servidor ──────────────────────────────────────
const app = express();
const server = createServer(app);

const io = new SocketServer(server, {
  cors: corsOptions,
  path: "/socket.io",
});
setIO(io);

app.use(cors(corsOptions));
app.use(express.json({ limit: "5mb" }));

// ─── Health check ────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ─── Rutas ───────────────────────────────────────────────
app.use("/api/auth",        authRouter);
app.use("/api/tasks",       authMiddleware, tasksRouter);
app.use("/api/clients",     authMiddleware, clientsRouter);
app.use("/api/technicians", authMiddleware, techniciansRouter);

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
  console.log(`[socket] conectado: ${user?.email || user?.id}`);
  socket.on("disconnect", () => {
    console.log(`[socket] desconectado: ${user?.email || user?.id}`);
  });
});

// ─── Arranque ────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3001;

(async () => {
  try {
    await waitForDb();
    await seedAdmin();
    server.listen(PORT, () => {
      console.log(`[backend] escuchando en :${PORT}`);
      console.log(`[backend] CORS origin: ${JSON.stringify(corsOrigin)}`);
    });
  } catch (err) {
    console.error("[backend] fallo al arrancar:", err);
    process.exit(1);
  }
})();
