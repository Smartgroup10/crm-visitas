export const STORAGE_KEY = "smartgroup_ops_v7";
export const CLIENTS_STORAGE_KEY = "smartgroup_ops_clients_v3";
export const UI_STORAGE_KEY = "smartgroup_ops_ui_v1";
export const TECHNICIANS_STORAGE_KEY = "smartgroup_ops_technicians_v1";
export const MIGRATION_FLAG_KEY = "smartgroup_ops_migration_v1";
export const MIGRATION_V2_FLAG_KEY = "smartgroup_ops_migration_v2";

export const STATUS_OPTIONS = ["No iniciado", "En curso", "Listo", "Bloqueado"];
export const PRIORITY_OPTIONS = ["Baja", "Media", "Alta", "Urgente"];
export const CATEGORY_OPTIONS = ["Visita", "Instalación", "Mantenimiento", "Incidencia"];

// "tecnicos" ya no existe (fusionado con "equipo"); se mantiene la clave
// "usuarios" (ahora etiquetada "Equipo" en la UI) para no invalidar el
// estado guardado en localStorage de usuarios antiguos.
export const VALID_SECTIONS = [
  "inicio",
  "mitrabajo",
  "instalaciones",
  "clientes",
  "usuarios",
  "informes",
];

export const CALENDAR_MODES = ["mes", "semana", "dia"];

export const TECH_AVATAR_COLORS = [
  "#0073ea",
  "#e2445c",
  "#00c875",
  "#fdab3d",
  "#a358d0",
  "#037f4c",
  "#0086c0",
  "#d83a52",
];
