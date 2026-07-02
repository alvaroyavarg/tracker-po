import { NextRequest, NextResponse } from "next/server";
import { listIos, upsertIo } from "@/lib/repo";
import { coerceText } from "@/lib/coerce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/ios -> todos los IOs con su clasificación y montos
export async function GET() {
  return NextResponse.json({ data: await listIos() });
}

// PATCH /api/ios { io, managed?, area? }
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const io = coerceText(body.io);
  if (!io) return NextResponse.json({ error: "Falta el IO" }, { status: 400 });
  await upsertIo(io, {
    managed: typeof body.managed === "boolean" ? body.managed : undefined,
    area: body.area !== undefined ? coerceText(body.area) : undefined,
  });
  return NextResponse.json({ ok: true });
}
