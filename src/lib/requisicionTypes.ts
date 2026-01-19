export type TipoRequisicion = {
  id: string;
  nombre: string;
  color: string; // HSL color
  colorClass: string; // Tailwind class for the dot
};

export const tiposRequisicion: TipoRequisicion[] = [
  { 
    id: "requisicion_general", 
    nombre: "Requisición general", 
    color: "355 100% 67%", // coral/red
    colorClass: "bg-primary" 
  },
  { 
    id: "emergencia", 
    nombre: "Emergencia", 
    color: "25 95% 53%", // orange
    colorClass: "bg-orange-500" 
  },
  { 
    id: "servicios_publicos", 
    nombre: "Servicios Públicos", 
    color: "48 96% 53%", // yellow
    colorClass: "bg-yellow-500" 
  },
  { 
    id: "servicios_profesionales", 
    nombre: "Servicios Profesionales", 
    color: "48 96% 53%", // yellow
    colorClass: "bg-yellow-500" 
  },
  { 
    id: "servicios_construccion", 
    nombre: "Servicios de Construcción", 
    color: "48 96% 53%", // yellow
    colorClass: "bg-yellow-500" 
  },
  { 
    id: "proyecto", 
    nombre: "Proyecto", 
    color: "48 96% 53%", // yellow
    colorClass: "bg-yellow-500" 
  },
  { 
    id: "finiquito", 
    nombre: "Finiquito", 
    color: "48 96% 53%", // yellow
    colorClass: "bg-yellow-500" 
  },
  { 
    id: "parque_vehicular", 
    nombre: "Parque Vehicular", 
    color: "48 96% 53%", // yellow
    colorClass: "bg-yellow-500" 
  },
  { 
    id: "prestamo_colaborador", 
    nombre: "Préstamo colaborador", 
    color: "48 96% 53%", // yellow
    colorClass: "bg-yellow-500" 
  },
  { 
    id: "viaticos", 
    nombre: "Viáticos", 
    color: "48 96% 53%", // yellow
    colorClass: "bg-yellow-500" 
  },
  { 
    id: "senales", 
    nombre: "Señales", 
    color: "217 91% 60%", // blue
    colorClass: "bg-blue-500" 
  },
];

export const getTipoRequisicionById = (id: string): TipoRequisicion | undefined => {
  return tiposRequisicion.find(tipo => tipo.id === id);
};

export const getTipoRequisicionColor = (id: string): string => {
  const tipo = getTipoRequisicionById(id);
  return tipo?.colorClass || "bg-muted";
};
