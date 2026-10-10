import assert from "node:assert/strict";
import { request } from "node:http";
import { publicScoreboard } from "../src/server/access-mode";

async function main() {
  const base = process.env.APP_URL || "http://127.0.0.1:3000";
  const url = new URL(base);
  if (url.hostname !== "127.0.0.1" || url.protocol !== "http:") throw new Error("Esta comprobación está restringida a la instalación local HTTP en 127.0.0.1.");
  const isPublic = publicScoreboard();
  for (const path of isPublic ? ["/admin"] : ["/", "/admin"]) {
    const res = await fetch(base + path, { redirect: "manual" });
    assert.equal(res.status, 307); assert.equal(new URL(res.headers.get("location")!, base).pathname, "/acceso");
  }
  const api = await fetch(base + "/api/scoreboard");
  assert.equal(api.status, isPublic ? 200 : 401); assert.match(api.headers.get("cache-control")!, /no-store/);
  if (isPublic) {
    const home = await fetch(base + "/", { redirect: "manual" });
    assert.equal(home.status, 200);
    const html = await home.text(); assert.match(html, /ACCESO PÚBLICO/);
    assert.doesNotMatch(html, /account-email|Tu pase al desafío/);
    const data = await api.json(); assert.equal(data.players.length, 8);
    assert.doesNotMatch(JSON.stringify(data), /"(?:puuid|email|token|apiKey|secret|session|grants)"\s*:/i);
    assert.ok(!JSON.stringify(data).includes(process.env.RIOT_API_KEY!));
  }
  const page = await fetch(base + "/acceso");
  assert.equal(page.status, 200); assert.equal(page.headers.get("x-frame-options"), "DENY");
  assert.equal(page.headers.get("x-content-type-options"), "nosniff");
  assert.match(page.headers.get("content-security-policy")!, /frame-ancestors 'none'/);
  assert.ok(!page.headers.get("x-powered-by"));
  assert.equal((await fetch(base + "/api/admin/access", { method: "POST", headers: { origin: base, "content-type": "application/json" }, body: "{}" })).status, 401);
  assert.equal((await fetch(base + "/api/access/request", { method: "POST", headers: { origin: "https://evil.test", "content-type": "application/json" }, body: "{}" })).status, 403);
  const rawGet = (path: string, host: string) => new Promise<{ status?: number; location?: string }>((resolve, reject) => {
    const req = request({ hostname: url.hostname, port: url.port, path, headers: { host } }, res => {
      res.resume(); res.on("end", () => resolve({ status: res.statusCode, location: res.headers.location }));
    });
    req.setTimeout(8000, () => req.destroy(new Error("timeout"))); req.on("error", reject); req.end();
  });
  assert.equal((await rawGet("/acceso", "evil.test")).status, 403);
  assert.equal((await rawGet("/api/health", "healthcheck.railway.app")).status, 200);
  const health = await fetch(base + "/api/health"); assert.deepEqual(await health.json(), { status: "ok" });
  const canonical = await rawGet("/acceso", `localhost:${url.port}`);
  assert.equal(canonical.status, 200); assert.equal(canonical.location, undefined);
  const safe = await rawGet("//evil.test/path", `localhost:${url.port}`);
  assert.ok(!safe.location || new URL(safe.location, base).host === url.host);
  assert.equal((await fetch(base + "/missing-page")).status, 404);
  assert.equal((await fetch(base + "/ranks/gold.png")).status, 200);
  console.log(`Correcto: tablero ${isPublic ? "público sin sesión" : "privado"}, administración protegida, datos sin secretos, origen y host, cabeceras, 404 y emblemas.`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : "No se pudo comprobar la página local."); process.exitCode = 1; });
