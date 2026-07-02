// Sesión simple basada en cookie firmada con la clave de la app.
// Funciona tanto en el middleware (edge) como en rutas Node vía Web Crypto.

export const SESSION_COOKIE = "po_session";

// Token de sesión: HMAC-SHA256 de un texto fijo usando APP_PASSWORD como llave.
// Si la clave cambia, todas las sesiones quedan inválidas automáticamente.
export async function sessionToken(secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("po-tracker-session-v1"));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
