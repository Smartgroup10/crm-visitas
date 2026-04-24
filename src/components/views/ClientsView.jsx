import { useState } from "react";
import { usePermissions } from "../../hooks/usePermissions";
import { useToast } from "../../hooks/useToast";
import { useConfirm } from "../../hooks/useConfirm";

export default function ClientsView({ clients, tasks, onAdd, onUpdate, onDelete }) {
  const { canManage } = usePermissions();
  const toast = useToast();
  const confirm = useConfirm();
  const [newClient, setNewClient]             = useState("");
  const [editingClientId, setEditingClientId] = useState(null);
  const [editingValue, setEditingValue]       = useState("");
  const [busyAdd, setBusyAdd]                 = useState(false);
  const [busyEdit, setBusyEdit]               = useState(false);
  const [deletingId, setDeletingId]           = useState(null);

  async function addClient() {
    const value = newClient.trim();
    if (!value) return;
    if (clients.some((c) => c.name === value)) {
      toast.error(`Ya existe un cliente con el nombre "${value}".`);
      return;
    }
    setBusyAdd(true);
    try {
      await onAdd(value);
      setNewClient("");
    } catch {
      // App.jsx ya muestra toast de error
    } finally {
      setBusyAdd(false);
    }
  }

  function startEdit(client) {
    setEditingClientId(client.id);
    setEditingValue(client.name);
  }

  async function saveEdit() {
    const value = editingValue.trim();
    if (!value) return;
    if (clients.some((c) => c.name === value && c.id !== editingClientId)) {
      toast.error(`Ya existe un cliente con el nombre "${value}".`);
      return;
    }
    setBusyEdit(true);
    try {
      await onUpdate(editingClientId, value);
      setEditingClientId(null);
      setEditingValue("");
    } catch {
      // App.jsx ya mostró toast
    } finally {
      setBusyEdit(false);
    }
  }

  async function deleteClient(client) {
    const isUsed = tasks.some((task) => task.clientId === client.id);
    if (isUsed) {
      toast.error("No puedes borrar este cliente porque está asignado a una o más tareas.");
      return;
    }
    const ok = await confirm({
      title: "Borrar cliente",
      message: `¿Seguro que quieres borrar "${client.name}"?`,
      variant: "danger",
      confirmLabel: "Borrar",
    });
    if (!ok) return;
    setDeletingId(client.id);
    try {
      await onDelete(client.id);
    } catch {
      // toast ya mostrado en App
    } finally {
      setDeletingId(null);
    }
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
            <button className="btn-primary" onClick={addClient} disabled={busyAdd}>
              {busyAdd ? (
                <>
                  <span className="btn-spinner" aria-hidden="true" />
                  Creando…
                </>
              ) : (
                "Crear cliente"
              )}
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
                          <button
                            className="btn-primary small-btn"
                            onClick={saveEdit}
                            disabled={busyEdit}
                          >
                            {busyEdit ? "Guardando…" : "Guardar"}
                          </button>
                          <button
                            className="btn-secondary small-btn"
                            onClick={() => {
                              setEditingClientId(null);
                              setEditingValue("");
                            }}
                            disabled={busyEdit}
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn-secondary small-btn"
                            onClick={() => startEdit(client)}
                            disabled={deletingId === client.id}
                          >
                            Editar
                          </button>
                          <button
                            className="btn-danger small-btn"
                            onClick={() => deleteClient(client)}
                            disabled={deletingId === client.id}
                          >
                            {deletingId === client.id ? "Borrando…" : "Borrar"}
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
