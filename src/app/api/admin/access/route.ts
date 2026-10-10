import { getAccessRuntime } from "@/server/auth";
import { adminPost, privateJson } from "@/server/access-http";
import { mailConfigured } from "@/server/access-mail";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try { return await adminPost(request, await getAccessRuntime(), mailConfigured()); }
  catch { return privateJson({ error: "No se pudo completar la operación. Inténtalo de nuevo." }, 503); }
}
