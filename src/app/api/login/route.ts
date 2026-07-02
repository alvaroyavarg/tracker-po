import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/login { password }
export async function POST(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    return NextResponse.json({ ok: true, open: true }); // sin clave configurada
  }
  const body = await req.json().catch(() => ({}));
  if (String(body.password ?? "") !== password) {
    return NextResponse.json({ error: "Clave incorrecta" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await sessionToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 días
  });
  return res;
}
