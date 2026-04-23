import { useState } from "react";
import { usePermissions } from "../../hooks/usePermissions";

export default function ClientsView({ clients, tasks, onAdd, onUpdate, onDelete }) {
  const { canManage } = usePermissions();
  const [newClient, setNewClient]         = useState("");
  const [editingClientId, setEditingClientId] = useState(null);
  const [editingValue, setEditingValue]   = useState("");

  async function addClient() {
    const value = newClient.trim();
    if (!value) return;
    if (clients.some((c) => c.name === value)) return;
    await onAdd(value);
    setNewClient("");
  }

  function startEdit(client) {
    setEditingClientId(client.id);
    setEditingValue(client.name);
  }

  async function saveEdit() {
    const value = editingValue.trim();
    if (!value) return;
    if (clients.some((c) => c.name === value && c.id !== editingClientId)) return;
    await onUpdate(editingClientId, value);
    setEditingClientId(null);
    setEditingValue("");
  }

  async function deleteClient(client) {
    const isUsed = tasks.some((task) => task.clientId === client.id);
    if (isUsed) {
      alert("No puedes borrar este cliente porque está asignado a una o más tareas.");
      return;
    }
    await onDelete(client.id);
  }

  return (
    <div className="clients-view">
      <div className="clients-header">
        <div>
          <h2>Clientes</h2>
          <p>
            {canManage
              ? "Gestiona el listado de clientes disponibles para asignar a tareas."
              : "Listado de clientes. Solo lectura."}
          </p>
        </div>
      </div>

      {canManage && (
        <div className="clients-create-card">
          <div className="inline-action">
            <input
              type="text"
              value={newClient}
              onChange={(e) => setNewClient(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addClient()}
              placeholder="Nombre del cliente"
            />
            <button className="btn-primary" onClick={addClient}>
              Crear cliente
            </button>
          </div>
        </div>
      )}

      <div className="clients-list-card">
        {clients.length === 0 ? (
          <div className="empty-state">No hay clientes creados.</div>
        ) : (
          <div className="clients-list">
            {clients.map((client) => {
              const usageCount = tasks.filter((task) => task.clientId === client.id).length;
              const isEditing  = editingClientId === client.id;

              return (
                <div key={client.id} className="client-row">
                  <div className="client-main">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                        autoFocus
                      />
                    ) : (
                      <div>
                        <div className="client-name">{client.name}</div>
                        <div className="client-meta">
                          Tareas asociadas: {usageCount}
                        </div>
                      </div>
                    )}
                  </div>

                  {canManage && (
                    <div className="client-actions">
                      {isEditing ? (
                        <>
                          <button className="btn-primary small-btn" onClick={saveEdit}>
                            Guardar
                          </button>
                          <button
                            className="btn-secondary small-btn"
                            onClick={() => {
                              setEditingClientId(null);
                              setEditingValue("");
                            }}
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn-secondary small-btn"
                            onClick={() => startEdit(client)}
                          >
                            Editar
                          </button>
                          <button
                            className="btn-danger small-btn"
                            onClick={() => deleteClient(client)}
                          >
                            Borrar
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
