import { NextRequest, NextResponse } from "next/server";
import { getPo, getHistory, updatePo, deletePo, addStatusChange } from "@/lib/repo";
import { coerceDate, coerceNumber, coerceText } from "@/lib/coerce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const po = getPo(params.id);
  if (!po) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json({ data: { ...po, history: getHistory(params.id) } });
}

// PATCH /api/pos/[id] -> edición parcial. Registra cambios de estado.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const existing = getPo(params.id);
  if (!existing) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const patch: any = {};
  const text = (k: string) => { if (body[k] !== undefined) patch[k] = coerceText(body[k]); };
  const num = (k: string) => { if (body[k] !== undefined) patch[k] = coerceNumber(body[k]); };
  const date = (k: string) => { if (body[k] !== undefined) patch[k] = coerceDate(body[k]); };

  if (body.poNumber !== undefined) patch.poNumber = String(body.poNumber).trim();
  text("poLine"); text("io"); text("vendor"); text("description");
  text("glAccount"); text("glDescription"); text("requisitioner"); text("owner");
  text("reportingFY"); text("notes");
  num("totalPoValue"); num("lineValue"); num("invoicedAmount"); num("openAmount");
  date("poDate"); date("deliveryDate"); date("executionDate");
  if (body.currency !== undefined) patch.currency = coerceText(body.currency) || "CLP";
  if (body.status !== undefined) patch.status = coerceText(body.status) || existing.status;

  const statusChanged = patch.status && patch.status !== existing.status;
  const po = updatePo(params.id, patch);

  if (statusChanged && po) {
    addStatusChange(po.id, existing.status, patch.status, coerceText(body.statusNote));
  }

  return NextResponse.json({ data: po });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  deletePo(params.id);
  return NextResponse.json({ ok: true });
}
