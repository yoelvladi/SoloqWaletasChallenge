import { authorizedUser, type AccessRuntime } from "./auth-core";
import { normalizeEmail } from "./access-store";

export function privateJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
function sameOrigin(request: Request, origin: string) {
  return request.headers.get("origin") === origin && request.headers.get("content-type")?.split(";")[0] === "application/json";
}
async function smallBody(request: Request) {
  // Bound the actual streamed body, not just the client-controlled length header.
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_BODY");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2048) { await reader.cancel(); throw new Error("INVALID_BODY"); }
    chunks.push(value);
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_BODY");
  return value as Record<string, unknown>;
}

export async function accessPost(request: Request, action: string, runtime: AccessRuntime, canMail: boolean) {
  if (!sameOrigin(request, runtime.origin)) return privateJson({ error: "Solicitud no permitida." }, 403);
  let body: Record<string, unknown>;
  try { body = await smallBody(request); if (!body || Array.isArray(body)) throw new Error(); }
  catch { return privateJson({ error: "Revisa los datos enviados." }, 400); }
  if (action === "logout") {
    const response = await runtime.auth.api.signOut({ headers: request.headers, asResponse: true });
    if (!response.ok) return privateJson({ error: "No se pudo cerrar la sesión. Inténtalo de nuevo." }, 503);
    const result = privateJson({ ok: true });
    for (const cookie of response.headers.getSetCookie()) result.headers.append("set-cookie", cookie);
    return result;
  }
  if (action === "confirm") {
    if (!runtime.access.allow("confirm-global", 30, 60_000)) return privateJson({ error: "Demasiados intentos. Espera un minuto." }, 429);
    if (typeof body.token !== "string" || !/^[a-zA-Z0-9]{32}$/.test(body.token)) return privateJson({ error: "El enlace no es válido." }, 400);
    try {
      const response = await runtime.auth.api.magicLinkVerify({ headers: request.headers, query: { token: body.token }, asResponse: true });
      if (response.status !== 200) return privateJson({ error: "El enlace caducó, ya se usó o el acceso fue revocado. Solicita uno nuevo." }, 400);
      const result = privateJson({ ok: true });
      for (const cookie of response.headers.getSetCookie()) result.headers.append("set-cookie", cookie);
      return result;
    } catch { return privateJson({ error: "No se pudo validar el enlace. Solicita uno nuevo." }, 400); }
  }
  if (action === "request") {
    if (!canMail) return privateJson({ error: "El envío de correos aún no está configurado. Usa el acceso local desde la terminal." }, 503);
    const email = normalizeEmail(body.email);
    if (!email) return privateJson({ error: "Introduce un correo válido." }, 400);
    if (!runtime.access.allow("mail-global", 20, 900_000) || !runtime.access.allow(`mail:${email}`, 3, 900_000)) return privateJson({ error: "Demasiadas solicitudes. Inténtalo en 15 minutos." }, 429);
    if (runtime.access.get(email)?.active) {
      try { await runtime.auth.api.signInMagicLink({ headers: request.headers, body: { email } }); }
      catch { /* Same response for unknown emails and delivery failures; no account enumeration. */ }
    }
    return privateJson({ ok: true, message: "Si tu correo está autorizado, recibirás un enlace. Revisa también la carpeta de spam." });
  }
  return privateJson({ error: "Ruta no encontrada." }, 404);
}

export async function adminPost(request: Request, runtime: AccessRuntime, canMail: boolean) {
  if (!sameOrigin(request, runtime.origin)) return privateJson({ error: "Solicitud no permitida." }, 403);
  const user = await authorizedUser(runtime, request.headers);
  if (!user) return privateJson({ error: "Inicia sesión." }, 401);
  if (user.role !== "admin") return privateJson({ error: "Solo el administrador puede gestionar accesos." }, 403);
  let body: Record<string, unknown>;
  try { body = await smallBody(request); } catch { return privateJson({ error: "Datos no válidos." }, 400); }
  const email = normalizeEmail(body?.email);
  if (!email || !["invite", "revoke", "send"].includes(String(body?.action))) return privateJson({ error: "Revisa el correo y la acción." }, 400);
  if (runtime.access.get(email)?.role === "admin") return privateJson({ error: "La cuenta administradora se gestiona desde la configuración local." }, 400);
  if (body.action === "revoke") { runtime.access.revoke(email); return privateJson({ ok: true, message: "Acceso revocado. Sus sesiones y enlaces pendientes quedaron anulados." }); }
  if (body.action === "invite") runtime.access.invite(email);
  if (body.action === "send" && !runtime.access.get(email)?.active) return privateJson({ error: "Autoriza primero ese correo." }, 400);
  if (!canMail) return privateJson({ ok: true, message: "Correo autorizado. No se envió ningún email: falta configurar el envío. Puedes generar su enlace desde la terminal." });
  if (!runtime.access.allow(`mail:${email}`, 3, 900_000)) return privateJson({ error: "Correo autorizado. Espera 15 minutos antes de reenviar otro enlace." }, 429);
  try {
    await runtime.auth.api.signInMagicLink({ headers: request.headers, body: { email } });
    return privateJson({ ok: true, message: "Correo autorizado y enlace entregado al servicio de correo. Caduca en 10 minutos." });
  } catch { return privateJson({ error: "El correo quedó autorizado, pero no pudimos enviar el enlace. Revisa la configuración de correo y vuelve a intentarlo." }, 502); }
}
