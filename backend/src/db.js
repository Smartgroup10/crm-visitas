import pg from "pg";
import { logger } from "./logger.js";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("error", (err) => {
  logger.error({ err }, "[db] error en pool inactivo");
});

export async function query(text, params) {
  return pool.query(text, params);
}
