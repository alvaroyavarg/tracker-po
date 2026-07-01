import { NextRequest, NextResponse } from "next/server";
import { bulkCreate, clearAllPos, PoInput } from "@/lib/repo";
import { coerceDate, coerceNumber, coerceText } from "@/lib/coerce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/import
// body: { rows: Array<Record<field, value>>, raw?: any[], mode: "append" | "replace" }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const rows: any[] = Array.isArray(body.rows) ? body.rows : [];
  const raws: any[] = Array.isArray(body.raw) ? body.raw : [];
  const mode: string = body.mode === "replace" ? "replace" : "append";

  if (rows.length === 0) {
    return NextResponse.json({ error: "No hay filas para importar" }, { status: 400 });
  }

  const records = rows
    .map((r, i) => {
      const poNumber = coerceText(r.poNumber);
      if (!poNumber) return null;
      return {
        poNumber,
        io: coerceText(r.io),
        brand: coerceText(r.brand),
        vendor: coerceText(r.vendor),
        description: coerceText(r.description),
        category: coerceText(r.category),
        amount: coerceNumber(r.amount),
        currency: coerceText(r.currency) || "CLP",
        status: coerceText(r.status) || "Pendiente",
        poDate: coerceDate(r.poDate),
        deliveryDate: coerceDate(r.deliveryDate),
        executionDate: coerceDate(r.executionDate),
        notes: coerceText(r.notes),
        raw: raws[i] ? JSON.stringify(raws[i]) : null,
      } as PoInput;
    })
    .filter(Boolean) as PoInput[];

  if (records.length === 0) {
    return NextResponse.json(
      { error: "Ninguna fila tenía un N° de PO válido" },
      { status: 400 }
    );
  }

  if (mode === "replace") clearAllPos();
  const imported = bulkCreate(records);
  const skipped = rows.length - records.length;

  return NextResponse.json({ imported, skipped, mode });
}
