import { useRef, useState } from "react";
import { usePermissions } from "../../hooks/usePermissions";
import { useToast } from "../../hooks/useToast";
import { useConfirm } from "../../hooks/useConfirm";
import { formatAddress, getMapsUrl } from "../../utils/address";
import EmptyState from "../EmptyState";

// El modal de detalle del cliente vive ahora a nivel App (para que se
// pueda abrir también desde la paleta de comandos / deep-links).
// Disparamos un evento custom y App lo recoge.
function openClientDetail(id) {
  window.dispatchEvent(new CustomEvent("crm:open-client", { detail: { id } }));
}

const EMPTY_DRAFT = {
  name: "",
  address: "",
  city: "",
  postal_code: "",
  notes: "",
};

export default function ClientsView({ clients, tasks, onAdd, onUpdate, onDelete }) {
  const { canManage } = usePermissions();
  const toast = useToast();
  const confirm = useConfirm();
  const [newClient, setNewClient]             = useState("");
  const [editingClientId, setEditingClientId] = useState(null);
  const [editingDraft, setEditingDraft]       = useState(EMPTY_DRAFT);
  const [busyAdd, setBusyAdd]                 = useState(false);
  const [busyEdit, setBusyEdit]               = useState(false);
  const [deletingId, setDeletingId]           = useState(null);
  const newClientInputRef = useRef(null);

  async function addClient() {
    const value = newClient.trim();
    if (!value) return;
    if (clients.some((c) => c.name === value)) {
      toast.error(`Ya existe un cliente con el nombre "${value}".`);
      return;
    }
    setBusyAdd(true);
    try {
      // El alta inicial sólo pide nombre — la dirección y el resto se
      // rellenan después con "Editar" para no obligar al usuario a
      // tener todos los datos al crear (típico cuando el técnico
      // descubre el cliente en campo y quiere registrarlo rápido).
      await onAdd({ name: value });
      setNewClient("");
    } catch {
      // App.jsx ya muestra toast de error
    } finally {
      setBusyAdd(false);
    }
  }

  function startEdit(client) {
    setEditingClientId(client.id);
    setEditingDraft({
      name:        client.name || "",
      address:     client.address || "",
      city:        client.city || "",
      postal_code: client.postal_code || "",
      notes:       client.notes || "",
    });
  }

  async function saveEdit() {
    const name = editingDraft.name.trim();
    if (!name) return;
    if (clients.some((c) => c.name === name && c.id !== editingClientId)) {
      toast.error(`Ya existe un cliente con el nombre "${name}".`);
      return;
    }
    setBusyEdit(true);
    try {
      await onUpdate(editingClientId, {
        name,
        address:     editingDraft.address.trim(),
        city:        editingDraft.city.trim(),
        postal_code: editingDraft.postal_code.trim(),
        notes:       editingDraft.notes.trim(),
      });
      setEditingClientId(null);
      setEditingDraft(EMPTY_DRAFT);
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
              ? "Gestiona el listado de clientes y sus direcciones para asignarlos a tareas."
              : "Listado de clientes. Solo lectura."}
          </p>
        </div>
      </div>

      {canManage && (
        <div className="clients-create-card">
          <div className="inline-action">
            <input
              ref={newClientInputRef}
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
          <EmptyState
            icon="folder"
            title="No hay clientes creados"
            description={
              canManage
                ? "Crea tu primer cliente para poder asignarlo a intervenciones."
                : "Aún no se ha creado ningún cliente."
            }
            action={
              canManage
                ? {
                    label: "Crear cliente",
                    variant: "primary",
                    onClick: () => newClientInputRef.current?.focus(),
                  }
                : undefined
            }
          />
        ) : (
          <div className="clients-list">
            {clients.map((client) => {
              const usageCount = tasks.filter((task) => task.clientId === client.id).length;
              const isEditing  = editingClientId === client.id;
              const formatted  = formatAddress(client);
              const mapsUrl    = getMapsUrl(client);

              return (
                <div key={client.id} className="client-row">
                  <div className="client-main">
                    {isEditing ? (
                      <ClientEditFields
                        draft={editingDraft}
                        setDraft={setEditingDraft}
                        onSubmit={saveEdit}
                      />
                    ) : (
                      <div>
                        <div className="client-name">{client.name}</div>
                        {formatted && (
                          <div className="client-address">{formatted}</div>
                        )}
                        <div className="client-meta">
                          Tareas asociadas: {usageCount}
                          {client.notes && (
                            <>
                              <span className="client-meta-sep">·</span>
                              <span className="client-notes-inline" title={client.notes}>
                                {client.notes}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="client-actions">
                    {!isEditing && mapsUrl && (
                      <a
                        className="btn-secondary small-btn client-maps-btn"
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Abrir ${formatted} en Maps`}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" strokeWidth="2"
                             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        Cómo llegar
                      </a>
                    )}
                    {!isEditing && (
                      <button
                        className="btn-secondary small-btn"
                        onClick={() => openClientDetail(client.id)}
                      >
                        Ver historial
                      </button>
                    )}
                    {canManage && (
                      isEditing ? (
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
                              setEditingDraft(EMPTY_DRAFT);
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
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Formulario de edición compacto: nombre + dirección en grid 2-col,
 * más notas como textarea pequeña. Enter en cualquier input dispara
 * el guardado para mantener el flujo rápido. */
function ClientEditFields({ draft, setDraft, onSubmit }) {
  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };
  return (
    <div className="client-edit-grid">
      <input
        className="client-edit-name"
        type="text"
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        onKeyDown={handleKey}
        placeholder="Nombre del cliente"
        autoFocus
      />
      <input
        type="text"
        value={draft.address}
        onChange={(e) => setDraft({ ...draft, address: e.target.value })}
        onKeyDown={handleKey}
        placeholder="Dirección (calle, número)"
      />
      <input
        type="text"
        value={draft.postal_code}
        onChange={(e) => setDraft({ ...draft, postal_code: e.target.value })}
        onKeyDown={handleKey}
        placeholder="Código postal"
      />
      <input
        type="text"
        value={draft.city}
        onChange={(e) => setDraft({ ...draft, city: e.target.value })}
        onKeyDown={handleKey}
        placeholder="Ciudad"
      />
      <textarea
        className="client-edit-notes"
        value={draft.notes}
        onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        rows="2"
        placeholder="Notas (portero, código, contacto en obra…)"
      />
    </div>
  );
}
