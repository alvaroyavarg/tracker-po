// Coerción de valores crudos de la sábana a los tipos del modelo,
// y auto-detección de mapeo de columnas por nombre de encabezado.

import { PO_FIELDS, PoFieldKey } from "./types";

// Normaliza texto para comparar encabezados: sin tildes, minúsculas, sin símbolos.
export function normalizeHeader(h: string): string {
  return (h || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Sinónimos por campo (en normalizado) para el auto-mapeo.
const SYNONYMS: Record<PoFieldKey, string[]> = {
  poNumber: ["po", "n po", "num po", "numero po", "purchase order", "orden de compra", "oc", "po number", "n orden", "pedido"],
  io: ["io", "internal order", "orden interna", "centro de costo", "centro costo", "cost center", "cc", "ceco"],
  brand: ["marca", "brand", "unidad de negocio", "bu"],
  vendor: ["proveedor", "vendor", "supplier", "razon social", "nombre proveedor"],
  description: ["descripcion", "description", "detalle", "glosa", "concepto", "item"],
  category: ["categoria", "category", "familia", "tipo", "rubro"],
  amount: ["monto", "amount", "valor", "total", "neto", "importe", "monto neto", "monto total", "precio"],
  currency: ["moneda", "currency", "divisa"],
  status: ["estado", "status", "situacion", "etapa"],
  poDate: ["fecha emision", "fecha po", "fecha oc", "fecha creacion", "po date", "fecha orden", "emision"],
  deliveryDate: ["fecha entrega", "delivery date", "entrega", "fecha recepcion", "recepcion"],
  executionDate: ["mes ejecucion", "fecha ejecucion", "mes de ejecucion", "ejecucion", "mes", "periodo", "fecha estimada", "forecast"],
  notes: ["notas", "notes", "observacion", "observaciones", "comentario", "comentarios", "obs"],
};

// Dado el listado de encabezados de la sábana, sugiere el mapeo columna->campo.
export function autoMap(headers: string[]): Record<string, PoFieldKey | ""> {
  const mapping: Record<string, PoFieldKey | ""> = {};
  const used = new Set<PoFieldKey>();

  for (const header of headers) {
    const norm = normalizeHeader(header);
    let best: PoFieldKey | "" = "";

    // 1) match exacto contra sinónimos
    for (const field of PO_FIELDS) {
      if (used.has(field.key)) continue;
      const syns = SYNONYMS[field.key];
      if (syns.some((s) => s === norm)) {
        best = field.key;
        break;
      }
    }
    // 2) match parcial (contiene)
    if (!best) {
      for (const field of PO_FIELDS) {
        if (used.has(field.key)) continue;
        const syns = SYNONYMS[field.key];
        if (syns.some((s) => norm.includes(s) || s.includes(norm))) {
          best = field.key;
          break;
        }
      }
    }

    mapping[header] = best;
    if (best) used.add(best);
  }
  return mapping;
}

// --- Coerción de valores ---

export function coerceNumber(value: unknown): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return value;
  let s = String(value).trim();
  // Quita símbolos de moneda y espacios
  s = s.replace(/[^0-9,.\-]/g, "");
  if (!s) return 0;
  // Maneja formatos: "1.234.567,89" (es-CL) vs "1,234,567.89" (en)
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // coma es decimal -> quita puntos, coma->punto
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // punto es decimal -> quita comas
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    // solo coma: si hay 3 dígitos tras la última coma, es separador de miles
    const after = s.split(",").pop() || "";
    if (after.length === 3) s = s.replace(/,/g, "");
    else s = s.replace(",", ".");
  } else if (hasDot) {
    const parts = s.split(".");
    const after = parts[parts.length - 1];
    if (parts.length > 2 || after.length === 3) s = s.replace(/\./g, "");
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Serial de fecha de Excel -> Date JS.
function excelSerialToDate(serial: number): Date {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const date = new Date(utcValue * 1000);
  const fractional = serial - Math.floor(serial);
  const secs = Math.round(fractional * 86400);
  date.setUTCSeconds(date.getUTCSeconds() + secs);
  return date;
}

const MONTH_MAP: Record<string, number> = {
  ene: 0, enero: 0, jan: 0, january: 0,
  feb: 1, febrero: 1, february: 1,
  mar: 2, marzo: 2, march: 2,
  abr: 3, abril: 3, apr: 3, april: 3,
  may: 4, mayo: 4,
  jun: 5, junio: 5, june: 5,
  jul: 6, julio: 6, july: 6,
  ago: 7, agosto: 7, aug: 7, august: 7,
  sep: 8, sept: 8, septiembre: 8, september: 8,
  oct: 9, octubre: 9, october: 9,
  nov: 10, noviembre: 10, november: 10,
  dic: 11, diciembre: 11, dec: 11, december: 11,
};

export function coerceDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    // Serial de Excel (rango razonable)
    if (value > 20000 && value < 80000) return excelSerialToDate(value);
    return null;
  }
  const s = String(value).trim();
  if (!s) return null;

  // dd/mm/yyyy o dd-mm-yyyy
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    let [, d, m, y] = dmy;
    let year = parseInt(y, 10);
    if (year < 100) year += 2000;
    const date = new Date(year, parseInt(m, 10) - 1, parseInt(d, 10));
    return isNaN(date.getTime()) ? null : date;
  }
  // yyyy-mm o yyyy-mm-dd
  const ymd = s.match(/^(\d{4})[\/\-.](\d{1,2})(?:[\/\-.](\d{1,2}))?$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, d ? parseInt(d, 10) : 1);
    return isNaN(date.getTime()) ? null : date;
  }
  // "Ene 2026", "enero-2026", "ene/26"
  const monthText = s.match(/^([a-záéíóú]+)[\s\-\/]*(\d{2,4})$/i);
  if (monthText) {
    const mm = MONTH_MAP[normalizeHeader(monthText[1])];
    if (mm != null) {
      let year = parseInt(monthText[2], 10);
      if (year < 100) year += 2000;
      return new Date(year, mm, 1);
    }
  }
  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}

export function coerceText(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}
