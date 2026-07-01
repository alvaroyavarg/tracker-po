// Campos canónicos de una línea de PO a los que se mapean las columnas de la sábana.
export const PO_FIELDS = [
  { key: "poNumber", label: "N° PO", required: true },
  { key: "poLine", label: "N° línea", required: false },
  { key: "io", label: "IO (Internal Order)", required: false },
  { key: "vendor", label: "Proveedor", required: false },
  { key: "description", label: "Descripción", required: false },
  { key: "glAccount", label: "Cuenta G/L", required: false },
  { key: "glDescription", label: "Descripción G/L", required: false },
  { key: "requisitioner", label: "Requisitioner (mail)", required: false },
  { key: "owner", label: "Responsable / Dueño", required: false },
  { key: "reportingFY", label: "Reporting FY", required: false },
  { key: "totalPoValue", label: "Valor total PO", required: false },
  { key: "lineValue", label: "Valor línea", required: false },
  { key: "invoicedAmount", label: "Facturado (Invoice)", required: false },
  { key: "openAmount", label: "Saldo abierto", required: false },
  { key: "currency", label: "Moneda", required: false },
  { key: "status", label: "Estado", required: false },
  { key: "poDate", label: "Fecha creación PO", required: false },
  { key: "deliveryDate", label: "Fecha entrega", required: false },
  { key: "executionDate", label: "Mes de ejecución", required: false },
  { key: "notes", label: "Notas", required: false },
] as const;

export type PoFieldKey = (typeof PO_FIELDS)[number]["key"];

// Estados posibles del ciclo de vida de una línea de PO.
export const PO_STATUSES = [
  "Pendiente",
  "Aprobada",
  "En proceso",
  "Recibida",
  "Facturada",
  "Pagada",
  "Cerrada",
  "Anulada",
] as const;

export type PoStatus = (typeof PO_STATUSES)[number];

export const STATUS_COLORS: Record<string, string> = {
  Pendiente: "bg-amber-50 text-amber-700 ring-amber-600/20",
  Aprobada: "bg-blue-50 text-blue-700 ring-blue-600/20",
  "En proceso": "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  Recibida: "bg-cyan-50 text-cyan-700 ring-cyan-600/20",
  Facturada: "bg-violet-50 text-violet-700 ring-violet-600/20",
  Pagada: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  Cerrada: "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
  Anulada: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

// DTO de una línea de PO (unidad base del tracker).
export interface PoLineDTO {
  id: string;
  poNumber: string;
  poLine: string | null;
  io: string | null;
  vendor: string | null;
  description: string | null;
  glAccount: string | null;
  glDescription: string | null;
  requisitioner: string | null;
  owner: string | null;
  reportingFY: string | null;
  totalPoValue: number;
  lineValue: number;
  invoicedAmount: number;
  openAmount: number;
  currency: string;
  status: string;
  poDate: string | null;
  deliveryDate: string | null;
  executionDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// Agrupación de líneas por PO para la vista principal.
export interface PoGroup {
  poNumber: string;
  vendor: string | null;
  description: string | null;
  totalPoValue: number;
  lineSum: number;
  invoicedSum: number;
  openSum: number;
  lines: PoLineDTO[];
  ios: string[];
  statuses: string[];
}

export function groupByPo(lines: PoLineDTO[]): PoGroup[] {
  const map = new Map<string, PoLineDTO[]>();
  for (const l of lines) {
    const arr = map.get(l.poNumber) || [];
    arr.push(l);
    map.set(l.poNumber, arr);
  }
  const groups: PoGroup[] = [];
  for (const [poNumber, ls] of map) {
    ls.sort((a, b) => (a.poLine || "").localeCompare(b.poLine || "", undefined, { numeric: true }));
    groups.push({
      poNumber,
      vendor: ls.find((l) => l.vendor)?.vendor ?? null,
      description: ls.find((l) => l.description)?.description ?? null,
      totalPoValue: Math.max(...ls.map((l) => l.totalPoValue || 0)),
      lineSum: ls.reduce((s, l) => s + (l.lineValue || 0), 0),
      invoicedSum: ls.reduce((s, l) => s + (l.invoicedAmount || 0), 0),
      openSum: ls.reduce((s, l) => s + (l.openAmount || 0), 0),
      lines: ls,
      ios: Array.from(new Set(ls.map((l) => l.io).filter(Boolean))) as string[],
      statuses: Array.from(new Set(ls.map((l) => l.status))),
    });
  }
  return groups;
}
