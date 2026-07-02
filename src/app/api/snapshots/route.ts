import { NextRequest, NextResponse } from "next/server";
import { listSnapshots, createSnapshot } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/snapshots -> lista de respaldos (sin el blob de datos)
export async function GET() {
  return NextResponse.json({ data: await listSnapshots() });
}

// POST /api/snapshots -> crea un respaldo del estado actual de todas las PO
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const label = (body.label && String(body.label).trim()) || defaultLabel();
  const snap = await createSnapshot(label, body.note ? String(body.note).trim() : null);
  return NextResponse.json({ data: snap }, { status: 201 });
}

function defaultLabel(): string {
  const now = new Date();
  return `Respaldo ${now.toLocaleDateString("es-CL")} ${now.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`;
}
