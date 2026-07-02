import { NextRequest, NextResponse } from "next/server";
import { listPos, managedIoSet } from "@/lib/repo";
import { monthKey } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/dashboard?io=&fy=F26&scope=managed|all
// Métricas agregadas + forecast mensual de ejecución por IO.
// scope=managed (default): solo IOs de mi gestión; las PO de otras áreas
// siguen visibles en el tracker, pero no ensucian KPIs ni forecast.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const ioFilter = sp.get("io")?.trim() || undefined;
  const fy = sp.get("fy")?.trim() || undefined;
  const scope = sp.get("scope") === "all" ? "all" : "managed";

  let lines = await listPos({ io: ioFilter, fy });
  if (scope === "managed") {
    const managed = await managedIoSet();
    // Las líneas sin IO se consideran propias.
    lines = lines.filter((l) => !l.io || managed.has(l.io));
  }

  const currencyCount: Record<string, number> = {};
  for (const p of lines) currencyCount[p.currency] = (currencyCount[p.currency] || 0) + 1;
  const currency =
    Object.entries(currencyCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "CLP";

  const poCount = new Set(lines.map((l) => l.poNumber)).size;
  const committed = lines.reduce((s, p) => s + (p.lineValue || 0), 0);
  const invoiced = lines.reduce((s, p) => s + (p.invoicedAmount || 0), 0);
  const open = lines.reduce((s, p) => s + (p.openAmount || 0), 0);

  const statusMap: Record<string, { count: number; amount: number }> = {};
  for (const p of lines) {
    const k = p.status || "Sin estado";
    statusMap[k] = statusMap[k] || { count: 0, amount: 0 };
    statusMap[k].count++;
    statusMap[k].amount += p.lineValue || 0;
  }
  const byStatus = Object.entries(statusMap).map(([status, v]) => ({ status, ...v }));

  const vendorMap: Record<string, { count: number; amount: number }> = {};
  for (const p of lines) {
    const k = p.vendor || "Sin proveedor";
    vendorMap[k] = vendorMap[k] || { count: 0, amount: 0 };
    vendorMap[k].count++;
    vendorMap[k].amount += p.lineValue || 0;
  }
  const byVendor = Object.entries(vendorMap)
    .map(([vendor, v]) => ({ vendor, ...v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  // Por IO: comprometido, facturado y abierto.
  const ioMap: Record<string, { count: number; committed: number; invoiced: number; open: number }> = {};
  for (const p of lines) {
    const k = p.io || "Sin IO";
    ioMap[k] = ioMap[k] || { count: 0, committed: 0, invoiced: 0, open: 0 };
    ioMap[k].count++;
    ioMap[k].committed += p.lineValue || 0;
    ioMap[k].invoiced += p.invoicedAmount || 0;
    ioMap[k].open += p.openAmount || 0;
  }
  const byIO = Object.entries(ioMap)
    .map(([io, v]) => ({ io, ...v }))
    .sort((a, b) => b.committed - a.committed);

  // Forecast: matriz mes x IO del SALDO ABIERTO (lo pendiente de ejecutar),
  // ubicado en el mes de ejecución (o entrega, o creación como respaldo).
  const monthsSet = new Set<string>();
  const iosSet = new Set<string>();
  const matrix: Record<string, Record<string, number>> = {};
  const totalsByMonth: Record<string, number> = {};

  for (const p of lines) {
    if (!p.openAmount || p.openAmount <= 0) continue;
    const mk = monthKey(p.executionDate) || monthKey(p.deliveryDate) || monthKey(p.poDate);
    if (!mk) continue;
    const io = p.io || "Sin IO";
    monthsSet.add(mk);
    iosSet.add(io);
    matrix[io] = matrix[io] || {};
    matrix[io][mk] = (matrix[io][mk] || 0) + p.openAmount;
    totalsByMonth[mk] = (totalsByMonth[mk] || 0) + p.openAmount;
  }

  const months = Array.from(monthsSet).sort();
  const ios = Array.from(iosSet).sort();

  return NextResponse.json({
    totals: { lineCount: lines.length, poCount, committed, invoiced, open, currency },
    byStatus,
    byVendor,
    byIO,
    forecast: { months, ios, matrix, totalsByMonth },
  });
}
