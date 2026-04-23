import bcrypt from "bcryptjs";
import { query } from "./db.js";

/**
 * Crea un usuario administrador inicial si no existe ningún usuario en la BD.
 * Usa las variables de entorno ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME.
 */
export async function seedAdmin() {
  try {
    const { rows } = await query("select count(*)::int as n from users");
    if (rows[0].n > 0) return;

    const email    = process.env.ADMIN_EMAIL    || "admin@smartgroup.es";
    const password = process.env.ADMIN_PASSWORD || "admin";
    const name     = process.env.ADMIN_NAME     || "Administrador";

    const hash = await bcrypt.hash(password, 10);
    await query(
      "insert into users (email, password_hash, name, role) values ($1, $2, $3, $4)",
      [email, hash, name, "admin"]
    );
    console.log(`[seed] usuario admin creado: ${email}`);
  } catch (err) {
    console.error("[seed] error creando admin:", err);
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
      console.log(`[db] esperando conexión... (${i + 1}/${maxAttempts})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("No se pudo conectar a la BD tras varios intentos");
}
