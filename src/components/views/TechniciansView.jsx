import { useState } from "react";
import { TECH_AVATAR_COLORS } from "../../data/constants";

export default function TechniciansView({ technicians, tasks, onAdd, onUpdate, onDelete }) {
  const [newName, setNewName]   = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");

  async function addTechnician() {
    const name = newName.trim();
    if (!name) return;
    if (technicians.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      alert(`El técnico "${name}" ya existe.`);
      return;
    }
    await onAdd(name);
    setNewName("");
  }

  function startEdit(tech) {
    setEditingId(tech.id);
    setEditName(tech.name);
  }

  async function saveEdit() {
    const name = editName.trim();
    if (!name) return;
    await onUpdate(editingId, name);
    setEditingId(null);
  }

  async function deleteTechnician(tech) {
    if (tasks.some((task) => task.technicianIds.includes(tech.id))) {
      alert("No puedes borrar este técnico porque está asignado a una o más tareas.");
      return;
    }
    await onDelete(tech.id);
  }

  function getTechStats(techId) {
    const tt = tasks.filter((t) => t.technicianIds.includes(techId));
    return {
      total:    tt.length,
      progress: tt.filter((t) => t.status === "En curso").length,
      done:     tt.filter((t) => t.status === "Listo").length,
    };
  }

  return (
    <div className="technicians-view">
      <div className="tech-header">
        <h2>Técnicos</h2>
        <p>Gestiona el equipo técnico y su carga de trabajo.</p>
      </div>

      <div className="tech-create-card">
        <div className="tech-create-form">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTechnician()}
            placeholder="Nombre del técnico"
            autoFocus
          />
          <button
            type="button"
            className="btn-primary"
            onClick={addTechnician}
            disabled={!newName.trim()}
          >
            Añadir técnico
          </button>
        </div>
      </div>

      {technicians.length === 0 ? (
        <div className="empty-state">No hay técnicos registrados.</div>
      ) : (
        <div className="tech-grid">
          {technicians.map((tech, i) => {
            const stats    = getTechStats(tech.id);
            const color    = TECH_AVATAR_COLORS[i % TECH_AVATAR_COLORS.length];
            const isEditing = editingId === tech.id;

            return (
              <div key={tech.id} className="tech-card">
                <div className="tech-card-top">
                  <div className="tech-avatar" style={{ background: color }}>
                    {tech.name.slice(0, 2).toUpperCase()}
                  </div>
                  {isEditing ? (
                    <div className="tech-edit-fields">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Nombre"
                        onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div className="tech-info">
                      <div className="tech-name">{tech.name}</div>
                    </div>
                  )}
                </div>

                <div className="tech-stats">
                  <div className="tech-stat">
                    <span className="tech-stat-num">{stats.total}</span>
                    <span className="tech-stat-label">Tareas</span>
                  </div>
                  <div className="tech-stat">
                    <span className="tech-stat-num" style={{ color: "var(--c-progress)" }}>
                      {stats.progress}
                    </span>
                    <span className="tech-stat-label">En curso</span>
                  </div>
                  <div className="tech-stat">
                    <span className="tech-stat-num" style={{ color: "var(--c-done)" }}>
                      {stats.done}
                    </span>
                    <span className="tech-stat-label">Listas</span>
                  </div>
                </div>

                <div className="tech-card-actions">
                  {isEditing ? (
                    <>
                      <button className="btn-primary small-btn" onClick={saveEdit}>
                        Guardar
                      </button>
                      <button className="btn-secondary small-btn" onClick={() => setEditingId(null)}>
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="btn-secondary small-btn" onClick={() => startEdit(tech)}>
                        Editar
                      </button>
                      <button className="btn-danger small-btn" onClick={() => deleteTechnician(tech)}>
                        Borrar
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
