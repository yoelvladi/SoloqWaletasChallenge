import { NextRequest, NextResponse } from "next/server";

// Defensa adicional local. Las páginas y APIs comprueban la sesión por separado.
// Los scripts dev/start enlazan exclusivamente a 127.0.0.1.
export function proxy(request: NextRequest) {
  // Railway probes use their own Host. This endpoint returns status only.
  if (request.nextUrl.pathname === "/api/health" && request.method === "GET") return NextResponse.next();
  const host = request.headers.get("host")?.toLowerCase() ?? "";
  const origin = request.headers.get("origin");
  let canonical: URL;
  try { canonical = new URL(process.env.APP_URL || "http://127.0.0.1:3000"); }
  catch { return new NextResponse("Servicio no disponible.", { status: 503 }); }
  const allowedHost = host === canonical.host;
  if (!allowedHost && canonical.hostname === "127.0.0.1" && host === `localhost:${canonical.port}` && request.method === "GET") {
    // Next normalizes loopback redirects against its bind address. A fixed link
    // avoids a relative-redirect loop and keeps authentication on one origin.
    return new NextResponse(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SoloQWaletasChallenge</title><body style="background:#09121d;color:#eee;font:18px system-ui;padding:10vw"><h1>SoloQWaletasChallenge</h1><p>Usa la dirección local del desafío para iniciar sesión.</p><a style="color:#50dce3" href="${canonical.origin}/acceso">Abrir el desafío</a></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }
  let sameOrigin = !origin;
  if (origin) {
    sameOrigin = origin === canonical.origin;
  }
  if (!allowedHost || !sameOrigin) {
    return new NextResponse("Solicitud no permitida.", { status: 403 });
  }
  return NextResponse.next();
}

// Public artwork is also fetched internally by the Next.js image optimizer,
// whose internal requests do not carry the browser's Host header.
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.svg|ranks/).*)"] };
