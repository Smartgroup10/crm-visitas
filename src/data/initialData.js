import { todayISO, addDays } from "../utils/date";

export const DEFAULT_CLIENTS = [
  { id: "c1", name: "Clínica Norte" },
  { id: "c2", name: "Coworking 4 Caminos" },
  { id: "c3", name: "Hotel Centro" },
  { id: "c4", name: "Asesoría Delta" },
  { id: "c5", name: "Oficinas Smartgroup" },
];

export const DEFAULT_TECHNICIANS = [
  { id: "t1", name: "Carlos",   phone: "", specialty: "Telefonía" },
  { id: "t2", name: "Marta",    phone: "", specialty: "Redes" },
  { id: "t3", name: "Fernando", phone: "", specialty: "Instalaciones" },
  { id: "t4", name: "Laura",    phone: "", specialty: "Soporte" },
  { id: "t5", name: "Andrés",   phone: "", specialty: "Mantenimiento" },
  { id: "t6", name: "Luis",     phone: "", specialty: "Infraestructura" },
];

export const initialTasks = [
  {
    id: crypto.randomUUID(),
    title: "Instalación centralita VoIP",
    clientId: "c1",
    phone: "912345678",
    category: "Instalación",
    date: todayISO(),
    technicianIds: ["t1", "t2"],
    status: "No iniciado",
    priority: "Urgente",
    notes: "Comprobar extensiones, desvíos y llamadas entrantes.",
    materials: "3 teléfonos IP, switch PoE, latiguillos",
    estimatedTime: "3 horas",
    vehicle: "Furgón 1",
    attachments: [
      {
        id: crypto.randomUUID(),
        name: "checklist_voip.pdf",
        size: 182340,
        type: "application/pdf",
      },
    ],
  },
  {
    id: crypto.randomUUID(),
    title: "Visita técnica de revisión",
    clientId: "c2",
    phone: "911223344",
    category: "Visita",
    date: addDays(todayISO(), 1),
    technicianIds: ["t3"],
    status: "En curso",
    priority: "Alta",
    notes: "Analizar cableado y cobertura WiFi.",
    materials: "Tester de red, portátil",
    estimatedTime: "2 horas",
    vehicle: "Coche 2",
    attachments: [],
  },
  {
    id: crypto.randomUUID(),
    title: "Mantenimiento preventivo",
    clientId: "c3",
    phone: "917778899",
    category: "Mantenimiento",
    date: addDays(todayISO(), 2),
    technicianIds: ["t4", "t5"],
    status: "Listo",
    priority: "Media",
    notes: "Revisión general de red y telefonía.",
    materials: "Checklist mantenimiento",
    estimatedTime: "1,5 horas",
    vehicle: "Furgón 2",
    attachments: [],
  },
];
