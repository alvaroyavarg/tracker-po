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
