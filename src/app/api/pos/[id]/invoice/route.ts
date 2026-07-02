import { NextRequest, NextResponse } from "next/server";
import { registerInvoice } from "@/lib/repo";
import { coerceNumber, coerceText } from "@/lib/coerce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/pos/[id]/invoice { amount, note? }
// Registra una facturación manual (incremental; acepta negativo para corregir).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const amount = coerceNumber(body.amount);
  if (!amount) {
    return NextResponse.json({ error: "Indica un monto distinto de 0" }, { status: 400 });
  }
  const po = registerInvoice(params.id, amount, coerceText(body.note));
  if (!po) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json({ data: po });
}
