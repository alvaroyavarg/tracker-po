import { NextRequest, NextResponse } from "next/server";
import { listPos, createPo } from "@/lib/repo";
import { coerceDate, coerceNumber, coerceText } from "@/lib/coerce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/pos?q=&status=&io=&vendor=&poNumber=
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const data = await listPos({
    q: sp.get("q")?.trim() || undefined,
    status: sp.get("status")?.trim() || undefined,
    io: sp.get("io")?.trim() || undefined,
    vendor: sp.get("vendor")?.trim() || undefined,
    poNumber: sp.get("poNumber")?.trim() || undefined,
  });
  return NextResponse.json({ data, count: data.length });
}

// POST /api/pos -> crea una línea de PO manualmente
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.poNumber || String(body.poNumber).trim() === "") {
    return NextResponse.json({ error: "El N° de PO es obligatorio" }, { status: 400 });
  }
  const lineValue = coerceNumber(body.lineValue);
  const invoiced = coerceNumber(body.invoicedAmount);
  const po = await createPo({
    poNumber: String(body.poNumber).trim(),
    poLine: coerceText(body.poLine),
    io: coerceText(body.io),
    vendor: coerceText(body.vendor),
    description: coerceText(body.description),
    glAccount: coerceText(body.glAccount),
    glDescription: coerceText(body.glDescription),
    requisitioner: coerceText(body.requisitioner),
    owner: coerceText(body.owner),
    reportingFY: coerceText(body.reportingFY),
    totalPoValue: coerceNumber(body.totalPoValue),
    lineValue,
    invoicedAmount: invoiced,
    openAmount:
      body.openAmount !== undefined && body.openAmount !== ""
        ? coerceNumber(body.openAmount)
        : Math.max(0, lineValue - invoiced),
    currency: coerceText(body.currency) || "CLP",
    status: coerceText(body.status) || "Abierta",
    poDate: coerceDate(body.poDate),
    deliveryDate: coerceDate(body.deliveryDate),
    executionDate: coerceDate(body.executionDate),
    notes: coerceText(body.notes),
  });
  return NextResponse.json({ data: po }, { status: 201 });
}
