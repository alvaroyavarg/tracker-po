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
  if (body.poNumber !== undefined) patch.poNumber = String(body.poNumber).trim();
  if (body.io !== undefined) patch.io = coerceText(body.io);
  if (body.brand !== undefined) patch.brand = coerceText(body.brand);
  if (body.vendor !== undefined) patch.vendor = coerceText(body.vendor);
  if (body.description !== undefined) patch.description = coerceText(body.description);
  if (body.category !== undefined) patch.category = coerceText(body.category);
  if (body.amount !== undefined) patch.amount = coerceNumber(body.amount);
  if (body.currency !== undefined) patch.currency = coerceText(body.currency) || "CLP";
  if (body.status !== undefined) patch.status = coerceText(body.status) || existing.status;
  if (body.poDate !== undefined) patch.poDate = coerceDate(body.poDate);
  if (body.deliveryDate !== undefined) patch.deliveryDate = coerceDate(body.deliveryDate);
  if (body.executionDate !== undefined) patch.executionDate = coerceDate(body.executionDate);
  if (body.notes !== undefined) patch.notes = coerceText(body.notes);

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
