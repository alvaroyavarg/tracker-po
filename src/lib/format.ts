// Utilidades de formato (moneda, fechas, meses) con locale chileno.

export function formatMoney(value: number, currency = "CLP"): string {
  const noDecimals = currency === "CLP";
  try {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency,
      minimumFractionDigits: noDecimals ? 0 : 2,
      maximumFractionDigits: noDecimals ? 0 : 2,
    }).format(value || 0);
  } catch {
    return `${currency} ${(value || 0).toLocaleString("es-CL")}`;
  }
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-CL").format(value || 0);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const MONTHS_ES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

// Clave de mes 'YYYY-MM' -> etiqueta legible 'Ene 2026'.
export function monthKey(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const idx = parseInt(m, 10) - 1;
  return `${MONTHS_ES[idx] ?? m} ${y}`;
}

// --- Año fiscal (julio a junio): F26 = 01/07/2025 → 30/06/2026 ---

// Rango de fechas de un año fiscal a partir de su etiqueta ("F26").
export function fyBounds(label: string): { start: string; end: string; endYear: number } | null {
  const m = label.trim().toUpperCase().match(/^F?(\d{2})$/);
  if (!m) return null;
  const endYear = 2000 + parseInt(m[1], 10);
  return {
    start: `${endYear - 1}-07-01`,
    end: `${endYear}-07-01`,
    endYear,
  };
}

// Etiqueta de año fiscal de una fecha ("F26"), o del Reporting FY si no hay fecha.
export function fyOf(poDate: string | null | undefined, reportingFY?: string | null): string | null {
  if (poDate) {
    const d = new Date(poDate);
    if (!isNaN(d.getTime())) {
      const endYear = d.getUTCMonth() + 1 >= 7 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
      return `F${String(endYear % 100).padStart(2, "0")}`;
    }
  }
  if (reportingFY) {
    const n = parseInt(String(reportingFY), 10);
    if (!isNaN(n)) return `F${String(n % 100).padStart(2, "0")}`;
  }
  return null;
}
