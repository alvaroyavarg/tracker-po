import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionToken } from "@/lib/auth";

// Protege toda la app con una clave única (APP_PASSWORD).
// Si APP_PASSWORD no está configurada, la app queda abierta (útil en desarrollo).
export async function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname === "/login" || pathname === "/api/login") return NextResponse.next();

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (cookie && cookie === (await sessionToken(password))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Todo excepto estáticos de Next y favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
