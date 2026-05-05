import { useRef, useState } from "react";
import { usePermissions } from "../../hooks/usePermissions";
import { useToast } from "../../hooks/useToast";
import { useConfirm } from "../../hooks/useConfirm";
import EmptyState from "../EmptyState";

// El modal de detalle del cliente vive ahora a nivel App (para que se
// pueda abrir también desde la paleta de comandos / deep-links).
// Disparamos un evento custom y App lo recoge.
function openClientDetail(id) {
  window.dispatchEvent(new CustomEvent("crm:open-client", { detail: { id } }));
}

const EMPTY_DRAFT = {
  name: "",
  cif: "",
  address: "",
  postal_code: "",
  city: "",
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
  const [search, setSearch]                   = useState("");
  const newClientInputRef = useRef(null);

  // Filtro de búsqueda en cliente — útil con cientos de clientes.
  // Hace match en nombre y CIF (los dos campos más identificativos).
  const filteredClients = clients.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.name || "").toLowerCase().includes(q) ||
      (c.cif || "").toLowerCase().includes(q) ||
      (c.city || "").toLowerCase().includes(q)
    );
  });

  async function addClient() {
    const value = newClient.trim();
    if (!value) return;
    if (clients.some((c) => c.name === value)) {
      toast.error(`Ya existe un cliente con el nombre "${value}".`);
      return;
    }
    setBusyAdd(true);
    try {
      // Alta inicial: solo nombre (datos fiscales se rellenan después
      // con "Editar" — flujo rápido para crear cliente desde campo).
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
      cif:         client.cif || "",
      address:     client.address || "",
      postal_code: client.postal_code || "",
      city:        client.city || "",
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
        cif:         editingDraft.cif.trim(),
        address:     editingDraft.address.trim(),
        city:        editingDraft.city.trim(),
        postal_code: editingDraft.postal_code.trim(),
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
              ? "Gestiona el listado de clientes y sus datos fiscales (CIF + domicilio social). La dirección concreta de cada intervención se rellena en la propia tarea."
              : "Listado de clientes. Solo lectura."}
          </p>
        </div>
        {clients.length > 0 && (
          <div className="clients-search">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, CIF o municipio…"
            />
            <span className="clients-search-count">
              {filteredClients.length} / {clients.length}
            </span>
          </div>
        )}
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
        {filteredClients.length === 0 ? (
          <EmptyState
            icon={search ? "search" : "folder"}
            title={
              search
                ? "Sin resultados"
                : "No hay clientes creados"
            }
            description={
              search
                ? `Ningún cliente coincide con "${search}".`
                : canManage
                  ? "Crea tu primer cliente para poder asignarlo a intervenciones."
                  : "Aún no se ha creado ningún cliente."
            }
            action={
              !search && canManage
                ? {
                    label: "Crear cliente",
                    variant: "primary",
                    onClick: () => newClientInputRef.current?.focus(),
                  }
                : search
                  ? {
                      label: "Limpiar búsqueda",
                      variant: "primary",
                      onClick: () => setSearch(""),
                    }
                  : undefined
            }
          />
        ) : (
          <div className="clients-list">
            {filteredClients.map((client) => {
              const usageCount = tasks.filter((task) => task.clientId === client.id).length;
              const isEditing  = editingClientId === client.id;

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
                        <div className="client-meta">
                          {client.cif && (
                            <span className="client-cif">CIF: {client.cif}</span>
                          )}
                          {client.cif && (client.city || client.postal_code) && (
                            <span className="client-meta-sep">·</span>
                          )}
                          {(client.postal_code || client.city) && (
                            <span className="client-fiscal-line">
                              {[client.postal_code, client.city].filter(Boolean).join(" ")}
                            </span>
                          )}
                          {(client.cif || client.city || client.postal_code) && (
                            <span className="client-meta-sep">·</span>
                          )}
                          <span>Tareas: {usageCount}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="client-actions">
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
 * Form inline de edición: nombre + CIF (5+5 col), dirección a ancho
 * completo, CP + ciudad en 2 col. Compacto pero respira. Enter en
 * cualquier campo guarda. */
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
        className="client-edit-cif"
        type="text"
        value={draft.cif}
        onChange={(e) => setDraft({ ...draft, cif: e.target.value })}
        onKeyDown={handleKey}
        placeholder="CIF / NIF"
      />
      <input
        className="client-edit-address"
        type="text"
        value={draft.address}
        onChange={(e) => setDraft({ ...draft, address: e.target.value })}
        onKeyDown={handleKey}
        placeholder="Domicilio fiscal (calle, número)"
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
        placeholder="Municipio"
      />
    </div>
  );
}
