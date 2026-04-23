import { Router } from "express";
import { query } from "../db.js";
import { emit } from "../io.js";

export const clientsRouter = Router();

// ─── GET /api/clients ────────────────────────────────────
clientsRouter.get("/", async (_req, res) => {
  try {
    const { rows } = await query("select * from clients order by name asc");
    res.json(rows);
  } catch (err) {
    console.error("[clients/list]", err);
    res.status(500).json({ error: "Error obteniendo clientes" });
  }
});

// ─── POST /api/clients ───────────────────────────────────
clientsRouter.post("/", async (req, res) => {
  try {
    const name = (req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "Nombre requerido" });

    const { rows } = await query(
      "insert into clients (name, created_by) values ($1, $2) returning *",
      [name, req.user.id]
    );
    emit("clients:change", { type: "insert", client: rows[0] });
    res.json(rows[0]);
  } catch (err) {
    console.error("[clients/create]", err);
    res.status(500).json({ error: "Error creando cliente" });
  }
});

// ─── PUT /api/clients/:id ────────────────────────────────
clientsRouter.put("/:id", async (req, res) => {
  try {
    const name = (req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "Nombre requerido" });

    const { rows } = await query(
      "update clients set name = $1 where id = $2 returning *",
      [name, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Cliente no encontrado" });
    emit("clients:change", { type: "update", client: rows[0] });
    res.json(rows[0]);
  } catch (err) {
    console.error("[clients/update]", err);
    res.status(500).json({ error: "Error actualizando cliente" });
  }
});

// ─── DELETE /api/clients/:id ─────────────────────────────
clientsRouter.delete("/:id", async (req, res) => {
  try {
    await query("delete from clients where id = $1", [req.params.id]);
    emit("clients:change", { type: "delete", id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    console.error("[clients/delete]", err);
    res.status(500).json({ error: "Error borrando cliente" });
  }
});
