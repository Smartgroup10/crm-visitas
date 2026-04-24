import { Router } from "express";
import { query } from "../db.js";
import { emit } from "../io.js";
import { requireRole } from "../auth.js";
import { logger } from "../logger.js";
import { schemas, validate } from "../schemas.js";

export const techniciansRouter = Router();

const canManage = requireRole("admin", "supervisor");

// ─── GET /api/technicians ────────────────────────────────
techniciansRouter.get("/", async (_req, res) => {
  try {
    const { rows } = await query("select * from technicians order by name asc");
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "[technicians/list]");
    res.status(500).json({ error: "Error obteniendo técnicos" });
  }
});

// ─── POST /api/technicians ───────────────────────────────
techniciansRouter.post("/", canManage, validate(schemas.technicianCreate), async (req, res) => {
  try {
    const { name, phone = "", specialty = "" } = req.body;

    const { rows } = await query(
      "insert into technicians (name, phone, specialty) values ($1, $2, $3) returning *",
      [name, phone, specialty]
    );
    emit("technicians:change", { type: "insert", technician: rows[0] });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "[technicians/create]");
    res.status(500).json({ error: "Error creando técnico" });
  }
});

// ─── PUT /api/technicians/:id ────────────────────────────
techniciansRouter.put("/:id", canManage, validate(schemas.technicianUpdate), async (req, res) => {
  try {
    // El schema ya garantiza que al menos uno viene y que son strings.
    const body = req.body;
    const sets = [];
    const values = [];

    for (const field of ["name", "phone", "specialty"]) {
      if (field in body) {
        values.push(body[field]);
        sets.push(`${field} = $${values.length}`);
      }
    }

    values.push(req.params.id);
    const { rows } = await query(
      `update technicians set ${sets.join(", ")} where id = $${values.length} returning *`,
      values
    );
    if (!rows[0]) return res.status(404).json({ error: "Técnico no encontrado" });
    emit("technicians:change", { type: "update", technician: rows[0] });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "[technicians/update]");
    res.status(500).json({ error: "Error actualizando técnico" });
  }
});

// ─── DELETE /api/technicians/:id ─────────────────────────
techniciansRouter.delete("/:id", canManage, async (req, res) => {
  try {
    await query("delete from technicians where id = $1", [req.params.id]);
    emit("technicians:change", { type: "delete", id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[technicians/delete]");
    res.status(500).json({ error: "Error borrando técnico" });
  }
});
