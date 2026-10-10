import { getAccessRuntime } from "@/server/auth";
import { getRiot } from "@/server/riot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!process.env.RIOT_API_KEY?.trim()) throw new Error("missing_key");
    const access = await getAccessRuntime();
    access.db.prepare("SELECT 1").get();
    getRiot(); // Open persistent history storage; no external requests.
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
