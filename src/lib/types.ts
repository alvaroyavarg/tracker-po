// Campos canónicos de una PO a los que se mapean las columnas de la sábana.
export const PO_FIELDS = [
  { key: "poNumber", label: "N° PO", required: true },
  { key: "io", label: "IO (Internal Order)", required: false },
  { key: "brand", label: "Marca", required: false },
  { key: "vendor", label: "Proveedor", required: false },
  { key: "description", label: "Descripción", required: false },
  { key: "category", label: "Categoría", required: false },
  { key: "amount", label: "Monto", required: false },
  { key: "currency", label: "Moneda", required: false },
  { key: "status", label: "Estado", required: false },
  { key: "poDate", label: "Fecha emisión", required: false },
  { key: "deliveryDate", label: "Fecha entrega", required: false },
  { key: "executionDate", label: "Mes de ejecución", required: false },
  { key: "notes", label: "Notas", required: false },
] as const;

export type PoFieldKey = (typeof PO_FIELDS)[number]["key"];

// Estados posibles del ciclo de vida de una PO.
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

export interface PurchaseOrderDTO {
  id: string;
  poNumber: string;
  io: string | null;
  brand: string | null;
  vendor: string | null;
  description: string | null;
  category: string | null;
  amount: number;
  currency: string;
  status: string;
  poDate: string | null;
  deliveryDate: string | null;
  executionDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
