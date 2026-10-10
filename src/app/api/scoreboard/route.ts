import { getRiot } from "@/server/riot";
import { getAccessRuntime } from "@/server/auth";
import { authorizedUser } from "@/server/auth-core";
import { privateJson } from "@/server/access-http";
import { after } from "next/server";
import { publicScoreboard } from "@/server/access-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
  if (!publicScoreboard() && !await authorizedUser(await getAccessRuntime(), request.headers)) return privateJson({ error: "Inicia sesión para ver la clasificación." }, 401);
  const riot = getRiot();
  const data = await riot.getScoreboard();
  after(async () => { try { await riot.syncHistory(); } catch { console.error("[history] No se pudo guardar o procesar el historial."); } });
  return Response.json(data, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
  } catch { return privateJson({ error: "El servicio no está disponible. Inténtalo de nuevo." }, 503); }
}
