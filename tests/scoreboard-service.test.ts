import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { rankPlayers } from "../src/lib/ranking";
import type { PlayerSnapshot, Standing } from "../src/lib/types";
import type { PlayerConfig } from "../src/lib/players";
import { ScoreboardService } from "../src/server/scoreboard-service";
import { FileSnapshotStore, type SnapshotStore } from "../src/server/snapshot-store";

const roster: PlayerConfig[] = ["first", "missing", "diez y siete"].map((name, i) => ({ id: String(i), gameName: name, tagLine: "soloq", platform: "la2", routing: "americas" }));
const league = [{ queueType: "RANKED_SOLO_5x5", tier: "SILVER", rank: "III", leaguePoints: 75, wins: 23, losses: 10 }];
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
class MemoryStore implements SnapshotStore {
  rows: PlayerSnapshot[] = [];
  async load() { return structuredClone(this.rows); }
  async save(rows: PlayerSnapshot[]) { this.rows = structuredClone(rows); }
}
function entry(id: string, tier: string | null, division = "IV", lp = 0): Standing {
  return { id, gameName: id, tagLine: "LAS", position: null, status: "ready", stale: false, message: "ok", nextRefreshAt: null,
    player: { id, gameName: id, tagLine: "LAS", region: "LAS", checkedAt: new Date(1_000_000).toISOString(), ranked: tier ? { tier, division, lp, wins: 1, losses: 0 } : null } };
}

test("rango, división y LP ordenan correctamente; empates comparten posición y sin rango va al final", () => {
  const sorted = rankPlayers([entry("silver", "SILVER", "I", 99), entry("unranked", null), entry("gold-b", "GOLD", "IV", 10), entry("gold-a", "GOLD", "IV", 10), entry("gold-top", "GOLD", "III", 0), entry("master", "MASTER", "I", 5)]);
  assert.deepEqual(sorted.map(s => [s.id, s.position]), [["master", 1], ["gold-top", 2], ["gold-a", 3], ["gold-b", 3], ["silver", 5], ["unranked", null]]);
});

test("un Riot ID incorrecto no impide actualizar otros; nombres con espacios se codifican", async () => {
  const urls: string[] = [];
  const fetcher: typeof fetch = async url => {
    const path = String(url); urls.push(path);
    if (path.includes("/accounts/")) return path.includes("/missing/") ? json({}, 404) : json({ puuid: path.includes("diez%20y%20siete") ? "third" : "first" });
    return json(league);
  };
  const service = new ScoreboardService(roster, () => "test-key", new MemoryStore(), fetcher);
  const [a, b] = await Promise.all([service.getScoreboard(), service.getScoreboard()]);
  assert.deepEqual(a, b);
  assert.equal(a.status, "partial");
  assert.equal(a.players.filter(s => s.status === "ready").length, 2);
  assert.equal(a.players.find(s => s.id === "1")?.code, "account_not_found");
  assert.ok(a.players.find(s => s.id === "1")?.message.includes("missing#soloq"));
  assert.ok(urls.some(url => url.includes("/diez%20y%20siete/soloq")));
  await service.getScoreboard();
  assert.equal(urls.length, 5);
});

test("al reiniciar sin conexión se recuperan los datos de disco y se marcan anteriores", async () => {
  const file = join(tmpdir(), `waletas-test-${randomUUID()}.json`);
  const store = new FileSnapshotStore(file);
  try {
    const online: typeof fetch = async url => String(url).includes("/accounts/") ? json({ puuid: "private-puuid" }) : json(league);
    const first = await new ScoreboardService(roster.slice(0, 1), () => "private-key", store, online).getScoreboard();
    const offline: typeof fetch = async () => { throw new Error("offline"); };
    const restored = await new ScoreboardService(roster.slice(0, 1), () => "new-key", store, offline).getScoreboard();
    assert.equal(restored.players[0].stale, true);
    assert.deepEqual(restored.players[0].player, first.players[0].player);
    const saved = JSON.stringify(await store.load());
    assert.ok(!saved.includes("private-puuid"));
    assert.ok(!saved.includes("private-key"));
  } finally { await unlink(file).catch(() => {}); }
});

test("un error al guardar no hace desaparecer los datos obtenidos", async () => {
  const store: SnapshotStore = { async load() { return []; }, async save() { throw new Error("disk"); } };
  const fetcher: typeof fetch = async url => String(url).includes("/accounts/") ? json({ puuid: "test" }) : json(league);
  const result = await new ScoreboardService(roster.slice(0, 1), () => "key", store, fetcher).getScoreboard();
  assert.equal(result.status, "ready");
  assert.equal(result.players[0].player?.ranked?.lp, 75);
  assert.ok(result.storageWarning);
});

test("429 de una cuenta bloquea nuevas consultas de otras cuentas durante Retry-After", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async url => {
    calls++;
    if (String(url).includes("/first/")) return new Response(null, { status: 429, headers: { "Retry-After": "120" } });
    return json({ puuid: "other" });
  };
  const result = await new ScoreboardService(roster, () => "key", new MemoryStore(), fetcher, () => 1_000_000).getScoreboard();
  assert.equal(calls, 3); // Solo las tres solicitudes ya iniciadas; ninguna consulta posterior de rango.
  assert.ok(result.players.every(p => p.code === "rate_limited"));
  assert.ok(result.players.every(p => p.nextRefreshAt === new Date(1_120_000).toISOString()));
});
