import { getAccessRuntime } from "@/server/auth";
import { accessPost, privateJson } from "@/server/access-http";
import { mailConfigured } from "@/server/access-mail";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  try { return await accessPost(request, (await context.params).action, await getAccessRuntime(), mailConfigured()); }
  catch { return privateJson({ error: "El acceso no está disponible. Inténtalo de nuevo." }, 503); }
}
