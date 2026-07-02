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

// ¿El texto (owner/requisitioner) calza con el filtro de dueño?
// Tolerante a puntos, mayúsculas, tildes y dominios de correo:
// "Alvaro Yavar" calza con "Alvaro.Yavar@diageo.com".
export function matchesOwner(value: string | null | undefined, filter: string): boolean {
  if (!filter.trim()) return true;
  const hay = normalizeHeader(String(value ?? ""));
  if (!hay) return false;
  const tokens = normalizeHeader(filter).split(" ").filter(Boolean);
  return tokens.every((t) => hay.includes(t));
}

// Sinónimos por campo (normalizados) para el auto-mapeo.
// Incluye los encabezados exactos de la sábana COUPA/SAP.
const SYNONYMS: Record<PoFieldKey, string[]> = {
  poNumber: ["po number", "po", "n po", "num po", "numero po", "purchase order", "orden de compra", "oc", "n orden", "pedido"],
  poLine: ["po line number", "po line", "linea", "n linea", "line", "line number", "item po", "posicion"],
  io: ["internal order", "io", "orden interna", "centro de costo", "centro costo", "cost center", "cc", "ceco"],
  vendor: ["vendor name1", "vendor name", "proveedor", "vendor", "supplier", "razon social", "nombre proveedor"],
  description: ["po descripcion", "po description", "descripcion", "description", "detalle", "glosa", "concepto"],
  glAccount: ["g l account", "gl account", "cuenta gl", "cuenta contable", "cuenta"],
  glDescription: ["g l description", "gl description", "descripcion gl", "descripcion cuenta"],
  requisitioner: ["po requisitioner mail id", "requisitioner", "requisitioner mail", "solicitante mail", "mail solicitante"],
  owner: ["requisitante", "owner", "buyer", "requestor", "requestor name", "responsable", "dueno", "solicitante", "comprador", "gestor", "brand manager", "requester", "requester name", "created by", "creado por"],
  reportingFY: ["reporting fy", "fy", "fiscal year", "ano fiscal"],
  totalPoValue: ["total po value", "valor total po", "monto total po", "po value"],
  lineValue: ["total po line value", "po line value", "valor linea", "monto linea", "line value", "monto", "valor", "importe"],
  invoicedAmount: ["as of today total invoice", "total invoice", "invoice", "facturado", "invoiced", "ejecutado", "gr amount", "receipted"],
  openAmount: ["open po line value", "open po value", "open value", "saldo abierto", "saldo", "open amount", "pendiente", "por ejecutar", "restante"],
  currency: ["moneda", "currency", "divisa"],
  poDate: ["po creation date coupa", "po creation date sap", "po creation date", "fecha creacion", "fecha emision", "fecha po", "fecha oc", "po date", "creation date"],
  deliveryDate: ["delivery date", "fecha entrega", "entrega", "fecha recepcion", "recepcion"],
  executionDate: ["mes ejecucion", "fecha ejecucion", "mes de ejecucion", "ejecucion", "periodo", "forecast"],
  notes: ["notas", "notes", "observacion", "observaciones", "comentario", "comentarios", "obs"],
};

// Dado el listado de encabezados de la sábana, sugiere el mapeo columna->campo.
// El match exacto se resuelve por campo en orden de prioridad de sinónimos, para
// que "Vendor Name1" le gane a "Vendor" (código) y "Internal Order" a "Cost center".
export function autoMap(headers: string[]): Record<string, PoFieldKey | ""> {
  const mapping: Record<string, PoFieldKey | ""> = {};
  const used = new Set<PoFieldKey>();
  const norms = headers.map(normalizeHeader);

  for (const header of headers) mapping[header] = "";

  // 1) match exacto: por campo, recorriendo sus sinónimos en orden de prioridad
  for (const field of PO_FIELDS) {
    for (const syn of SYNONYMS[field.key]) {
      const idx = norms.findIndex((n, i) => n === syn && !mapping[headers[i]]);
      if (idx >= 0) {
        mapping[headers[idx]] = field.key;
        used.add(field.key);
        break;
      }
    }
  }
  // 2) match parcial (contiene) para lo que quedó sin mapear
  for (const field of PO_FIELDS) {
    if (used.has(field.key)) continue;
    outer: for (const syn of SYNONYMS[field.key]) {
      for (let i = 0; i < headers.length; i++) {
        const n = norms[i];
        if (!n || mapping[headers[i]]) continue;
        if (n.includes(syn) || syn.includes(n)) {
          mapping[headers[i]] = field.key;
          used.add(field.key);
          break outer;
        }
      }
    }
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
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
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
