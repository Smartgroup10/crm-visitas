import { Router } from "express";
import { query } from "../db.js";
import { emit } from "../io.js";

export const techniciansRouter = Router();

// ─── GET /api/technicians ────────────────────────────────
techniciansRouter.get("/", async (_req, res) => {
  try {
    const { rows } = await query("select * from technicians order by name asc");
    res.json(rows);
  } catch (err) {
    console.error("[technicians/list]", err);
    res.status(500).json({ error: "Error obteniendo técnicos" });
  }
});

// ─── POST /api/technicians ───────────────────────────────
techniciansRouter.post("/", async (req, res) => {
  try {
    const name      = (req.body?.name      || "").trim();
    const phone     = (req.body?.phone     || "").trim();
    const specialty = (req.body?.specialty || "").trim();
    if (!name) return res.status(400).json({ error: "Nombre requerido" });

    const { rows } = await query(
      "insert into technicians (name, phone, specialty) values ($1, $2, $3) returning *",
      [name, phone, specialty]
    );
    emit("technicians:change", { type: "insert", technician: rows[0] });
    res.json(rows[0]);
  } catch (err) {
    console.error("[technicians/create]", err);
    res.status(500).json({ error: "Error creando técnico" });
  }
});

// ─── PUT /api/technicians/:id ────────────────────────────
techniciansRouter.put("/:id", async (req, res) => {
  try {
    const body = req.body || {};
    const sets = [];
    const values = [];

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) return res.status(400).json({ error: "Nombre requerido" });
      values.push(name);
      sets.push(`name = $${values.length}`);
    }
    if (typeof body.phone === "string") {
      values.push(body.phone.trim());
      sets.push(`phone = $${values.length}`);
    }
    if (typeof body.specialty === "string") {
      values.push(body.specialty.trim());
      sets.push(`specialty = $${values.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: "Nada que actualizar" });

    values.push(req.params.id);
    const { rows } = await query(
      `update technicians set ${sets.join(", ")} where id = $${values.length} returning *`,
      values
    );
    if (!rows[0]) return res.status(404).json({ error: "Técnico no encontrado" });
    emit("technicians:change", { type: "update", technician: rows[0] });
    res.json(rows[0]);
  } catch (err) {
    console.error("[technicians/update]", err);
    res.status(500).json({ error: "Error actualizando técnico" });
  }
});

// ─── DELETE /api/technicians/:id ─────────────────────────
techniciansRouter.delete("/:id", async (req, res) => {
  try {
    await query("delete from technicians where id = $1", [req.params.id]);
    emit("technicians:change", { type: "delete", id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    console.error("[technicians/delete]", err);
    res.status(500).json({ error: "Error borrando técnico" });
  }
});
