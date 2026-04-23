import pg from "pg";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("error", (err) => {
  console.error("[db] error en pool inactivo:", err);
});

export async function query(text, params) {
  return pool.query(text, params);
}
