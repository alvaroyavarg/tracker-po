import { NextRequest, NextResponse } from "next/server";
import { getSnapshot, deleteSnapshot, restoreSnapshot } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/snapshots/[id] -> respaldo completo con sus datos
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const snap = getSnapshot(params.id);
  if (!snap) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ data: snap });
}

// POST /api/snapshots/[id] -> restaura el estado de las PO desde el respaldo
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const restored = restoreSnapshot(params.id);
  if (restored < 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ restored });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  deleteSnapshot(params.id);
  return NextResponse.json({ ok: true });
}
