export function getClientName(clientId, clients) {
  if (!clientId) return "";
  const found = clients.find((c) => c.id === clientId);
  return found ? found.name : "(cliente eliminado)";
}

export function getTechnicianName(technicianId, technicians) {
  if (!technicianId) return "";
  const found = technicians.find((t) => t.id === technicianId);
  return found ? found.name : "(técnico eliminado)";
}

export function peopleFromIds(ids, technicians) {
  if (!Array.isArray(ids)) return "";
  return ids
    .map((id) => getTechnicianName(id, technicians))
    .filter(Boolean)
    .join(", ");
}
