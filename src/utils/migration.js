import {
  STORAGE_KEY,
  CLIENTS_STORAGE_KEY,
  TECHNICIANS_STORAGE_KEY,
  MIGRATION_FLAG_KEY,
} from "../data/constants";

export function migrateTasksToIds() {
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(MIGRATION_FLAG_KEY) === "done") return;

  try {
    const rawTasks = localStorage.getItem(STORAGE_KEY);
    const rawClients = localStorage.getItem(CLIENTS_STORAGE_KEY);
    const rawTechnicians = localStorage.getItem(TECHNICIANS_STORAGE_KEY);

    let tasks = rawTasks ? JSON.parse(rawTasks) : null;
    let clients = rawClients ? JSON.parse(rawClients) : null;
    const technicians = rawTechnicians ? JSON.parse(rawTechnicians) : null;

    if (Array.isArray(clients)) {
      clients = clients.map((c) =>
        typeof c === "string" ? { id: crypto.randomUUID(), name: c } : c
      );
    }

    if (!Array.isArray(clients)) clients = [];
    const techList = Array.isArray(technicians) ? technicians : [];

    if (!Array.isArray(tasks)) {
      localStorage.setItem(MIGRATION_FLAG_KEY, "done");
      return;
    }

    const migratedTasks = tasks.map((task) => {
      const newTask = { ...task };

      if (typeof newTask.client === "string" && newTask.client.trim()) {
        const clientName = newTask.client;
        let found = clients.find((c) => c.name === clientName);
        if (!found) {
          found = { id: crypto.randomUUID(), name: clientName };
          clients.push(found);
        }
        newTask.clientId = found.id;
      } else {
        newTask.clientId = "";
      }
      delete newTask.client;

      if (Array.isArray(newTask.people)) {
        const ids = [];
        for (const name of newTask.people) {
          const tech = techList.find((t) => t.name === name);
          if (tech) {
            ids.push(tech.id);
          } else {
            console.warn("Técnico no encontrado en migración:", name);
          }
        }
        newTask.technicianIds = ids;
      } else {
        newTask.technicianIds = [];
      }
      delete newTask.people;

      return newTask;
    });

    clients.sort((a, b) => a.name.localeCompare(b.name, "es"));

    localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedTasks));
    localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients));
    localStorage.setItem(MIGRATION_FLAG_KEY, "done");
  } catch (err) {
    console.error("Error en migración a ids:", err);
  }
}
