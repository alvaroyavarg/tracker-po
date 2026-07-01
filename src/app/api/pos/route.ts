import { NextRequest, NextResponse } from "next/server";
import { listPos, createPo } from "@/lib/repo";
import { coerceDate, coerceNumber, coerceText } from "@/lib/coerce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/pos?q=&status=&io=&vendor=&brand=
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const data = listPos({
    q: sp.get("q")?.trim() || undefined,
    status: sp.get("status")?.trim() || undefined,
    io: sp.get("io")?.trim() || undefined,
    vendor: sp.get("vendor")?.trim() || undefined,
    brand: sp.get("brand")?.trim() || undefined,
  });
  return NextResponse.json({ data, count: data.length });
}

// POST /api/pos -> crea una PO manualmente
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.poNumber || String(body.poNumber).trim() === "") {
    return NextResponse.json({ error: "El N° de PO es obligatorio" }, { status: 400 });
  }
  const po = createPo({
    poNumber: String(body.poNumber).trim(),
    io: coerceText(body.io),
    brand: coerceText(body.brand),
    vendor: coerceText(body.vendor),
    description: coerceText(body.description),
    category: coerceText(body.category),
    amount: coerceNumber(body.amount),
    currency: coerceText(body.currency) || "CLP",
    status: coerceText(body.status) || "Pendiente",
    poDate: coerceDate(body.poDate),
    deliveryDate: coerceDate(body.deliveryDate),
    executionDate: coerceDate(body.executionDate),
    notes: coerceText(body.notes),
  });
  return NextResponse.json({ data: po }, { status: 201 });
}
