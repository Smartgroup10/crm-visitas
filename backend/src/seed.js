import bcrypt from "bcryptjs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { query } from "./db.js";
import { logger } from "./logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Aplica schema.sql contra la BD. El script es idempotente
 * (usa `create table if not exists` y `on conflict do nothing`),
 * así que es seguro ejecutarlo en cada arranque. Evita depender de
 * docker-entrypoint-initdb.d, que solo corre si el volumen está vacío.
 */
export async function applySchema() {
  try {
    const sqlPath = resolve(__dirname, "..", "schema.sql");
    const sql = await readFile(sqlPath, "utf8");
    await query(sql);
    logger.info("[db] schema aplicado");
  } catch (err) {
    logger.error({ err }, "[db] error aplicando schema");
    throw err;
  }
}

/**
 * Crea un usuario administrador inicial si no existe ningún usuario en la BD.
 * Usa las variables de entorno ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME.
 */
export async function seedAdmin() {
  try {
    const { rows } = await query("select count(*)::int as n from users");
    if (rows[0].n > 0) return;

    const email    = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    const name     = process.env.ADMIN_NAME || "Administrador";

    // Sin credenciales explícitas NO sembramos un admin: evitamos crear
    // un usuario con contraseña conocida/adivinable en producción.
    if (!email || !password) {
      logger.warn(
        "[seed] ADMIN_EMAIL y/o ADMIN_PASSWORD no definidos: no se crea usuario admin. " +
        "Define ambas variables en .env para sembrar el admin inicial."
      );
      return;
    }

    const hash = await bcrypt.hash(password, 10);
    await query(
      "insert into users (email, password_hash, name, role) values ($1, $2, $3, $4)",
      [email, hash, name, "admin"]
    );
    logger.info({ email }, "[seed] usuario admin creado");
  } catch (err) {
    logger.error({ err }, "[seed] error creando admin");
  }
}

/**
 * Reintenta la conexión a la BD hasta que responde, con backoff simple.
 */
export async function waitForDb(maxAttempts = 30, delayMs = 1000) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await query("select 1");
      return;
    } catch (err) {
      logger.info({ attempt: i + 1, maxAttempts }, "[db] esperando conexión...");
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("No se pudo conectar a la BD tras varios intentos");
}
