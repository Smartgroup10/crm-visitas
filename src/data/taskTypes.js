export const TASK_TYPES = {
  "incidencia": {
    label: "Incidencia",
    specificFields: [
      { name: "dispositivoAfectado", label: "Dispositivo afectado", type: "text", required: true },
      { name: "sintoma", label: "Síntoma", type: "textarea", required: false },
      { name: "servicioCaido", label: "Servicio caído", type: "boolean", required: false },
    ],
  },
  "instalacion-proyecto": {
    label: "Instalación de proyecto",
    specificFields: [
      { name: "referenciaProyecto", label: "Referencia de proyecto", type: "text", required: true },
      { name: "equiposAInstalar", label: "Equipos a instalar", type: "textarea", required: true },
      { name: "dependenciasExternas", label: "Dependencias externas", type: "textarea", required: false },
    ],
  },
  "ampliacion": {
    label: "Ampliación",
    specificFields: [
      { name: "instalacionOriginal", label: "Instalación original", type: "text", required: true },
      { name: "equiposAAnadir", label: "Equipos a añadir", type: "textarea", required: true },
    ],
  },
  "mantenimiento-preventivo": {
    label: "Mantenimiento preventivo",
    specificFields: [
      {
        name: "tipoRevision",
        label: "Tipo de revisión",
        type: "select",
        required: true,
        options: ["Trimestral", "Semestral", "Anual", "Puntual"],
      },
    ],
  },
  "preventa": {
    label: "Preventa",
    specificFields: [
      {
        name: "fasePreventa",
        label: "Fase",
        type: "select",
        required: true,
        options: ["Visita inicial", "Toma de datos", "Presentación de propuesta", "Negociación", "Cierre"],
      },
      { name: "objetivoVisita", label: "Objetivo de la visita", type: "text", required: true },
      { name: "fechaObjetivoPropuesta", label: "Fecha objetivo propuesta", type: "date", required: false },
    ],
  },
};

export const TASK_TYPE_KEYS = Object.keys(TASK_TYPES);

export const COMMON_TASK_FIELDS = [
  "id",
  "title",
  "clientId",
  "phone",
  "type",
  "date",
  "technicianIds",
  "status",
  "priority",
  "notes",
  "materials",
  "estimatedTime",
  "vehicle",
  "attachments",
];

export function defaultValueForField(field) {
  switch (field.type) {
    case "text":
    case "textarea":
      return "";
    case "boolean":
      return false;
    case "select":
      return field.required ? field.options[0] : "";
    case "date":
      return null;
    default:
      return "";
  }
}

export function defaultsForType(type) {
  const fields = TASK_TYPES[type]?.specificFields || [];
  const defaults = {};
  for (const f of fields) {
    defaults[f.name] = defaultValueForField(f);
  }
  return defaults;
}
