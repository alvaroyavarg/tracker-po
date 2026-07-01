import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { listPos } from "@/lib/repo";
import { formatDate } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/export?format=xlsx|csv&q=&status=&io=&vendor=&brand=
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const format = sp.get("format") === "csv" ? "csv" : "xlsx";

  const pos = listPos({
    q: sp.get("q")?.trim() || undefined,
    status: sp.get("status")?.trim() || undefined,
    io: sp.get("io")?.trim() || undefined,
    vendor: sp.get("vendor")?.trim() || undefined,
    brand: sp.get("brand")?.trim() || undefined,
  });

  const rows = pos.map((p) => ({
    "N° PO": p.poNumber,
    IO: p.io || "",
    Marca: p.brand || "",
    Proveedor: p.vendor || "",
    Descripción: p.description || "",
    Categoría: p.category || "",
    Monto: p.amount,
    Moneda: p.currency,
    Estado: p.status,
    "Fecha emisión": p.poDate ? formatDate(p.poDate) : "",
    "Fecha entrega": p.deliveryDate ? formatDate(p.deliveryDate) : "",
    "Mes ejecución": p.executionDate ? formatDate(p.executionDate) : "",
    Notas: p.notes || "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "PO");

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(ws);
    return new NextResponse("﻿" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="po-tracker-${stamp}.csv"`,
      },
    });
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="po-tracker-${stamp}.xlsx"`,
    },
  });
}
