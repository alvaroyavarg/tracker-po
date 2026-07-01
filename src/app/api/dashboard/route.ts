import { NextRequest, NextResponse } from "next/server";
import { listPos } from "@/lib/repo";
import { monthKey } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/dashboard?io=
// Métricas agregadas + forecast mensual de ejecución por IO.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const ioFilter = sp.get("io")?.trim() || undefined;

  const pos = listPos({ io: ioFilter });

  const currencyCount: Record<string, number> = {};
  for (const p of pos) currencyCount[p.currency] = (currencyCount[p.currency] || 0) + 1;
  const currency =
    Object.entries(currencyCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "CLP";

  const totalAmount = pos.reduce((s, p) => s + (p.amount || 0), 0);

  const statusMap: Record<string, { count: number; amount: number }> = {};
  for (const p of pos) {
    const k = p.status || "Sin estado";
    statusMap[k] = statusMap[k] || { count: 0, amount: 0 };
    statusMap[k].count++;
    statusMap[k].amount += p.amount || 0;
  }
  const byStatus = Object.entries(statusMap).map(([status, v]) => ({ status, ...v }));

  const vendorMap: Record<string, { count: number; amount: number }> = {};
  for (const p of pos) {
    const k = p.vendor || "Sin proveedor";
    vendorMap[k] = vendorMap[k] || { count: 0, amount: 0 };
    vendorMap[k].count++;
    vendorMap[k].amount += p.amount || 0;
  }
  const byVendor = Object.entries(vendorMap)
    .map(([vendor, v]) => ({ vendor, ...v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const ioMap: Record<string, { count: number; amount: number }> = {};
  for (const p of pos) {
    const k = p.io || "Sin IO";
    ioMap[k] = ioMap[k] || { count: 0, amount: 0 };
    ioMap[k].count++;
    ioMap[k].amount += p.amount || 0;
  }
  const byIO = Object.entries(ioMap)
    .map(([io, v]) => ({ io, ...v }))
    .sort((a, b) => b.amount - a.amount);

  // Forecast: matriz mes x IO usando executionDate (o poDate como respaldo).
  const monthsSet = new Set<string>();
  const iosSet = new Set<string>();
  const matrix: Record<string, Record<string, number>> = {};
  const totalsByMonth: Record<string, number> = {};

  for (const p of pos) {
    const mk = monthKey(p.executionDate) || monthKey(p.poDate);
    if (!mk) continue;
    const io = p.io || "Sin IO";
    monthsSet.add(mk);
    iosSet.add(io);
    matrix[io] = matrix[io] || {};
    matrix[io][mk] = (matrix[io][mk] || 0) + (p.amount || 0);
    totalsByMonth[mk] = (totalsByMonth[mk] || 0) + (p.amount || 0);
  }

  const months = Array.from(monthsSet).sort();
  const ios = Array.from(iosSet).sort();

  return NextResponse.json({
    totals: { count: pos.length, totalAmount, currency },
    byStatus,
    byVendor,
    byIO,
    forecast: { months, ios, matrix, totalsByMonth },
  });
}
