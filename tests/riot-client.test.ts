import { test } from "node:test";
import assert from "node:assert/strict";
import { RiotClient, parseRanked } from "../src/server/riot-client";

// Solo fixtures de prueba: nunca se muestran en la aplicación.
const account = { puuid: "test-puuid", gameName: "Vurka", tagLine: "LAS" };
const solo = { queueType: "RANKED_SOLO_5x5", tier: "GOLD", rank: "II", leaguePoints: 43, wins: 12, losses: 8 };
const json = (body: unknown, status = 200, headers?: Record<string, string>) => new Response(JSON.stringify(body), { status, headers });

test("sin clave no hay peticiones ni estadísticas inventadas", async () => {
  const client = new RiotClient(() => undefined, async () => { throw new Error("No debe llamar a Riot"); });
  const result = await client.getScoreboard();
  assert.equal(result.status, "setup");
  assert.equal(result.player, null);
});

test("consulta AMERICAS y LA2, selecciona Solo/Duo y no filtra secretos ni PUUID", async () => {
  const calls: string[] = [];
  const client = new RiotClient(() => "test-secret", async (url, init) => {
    calls.push(String(url));
    assert.equal(new Headers(init?.headers).get("X-Riot-Token"), "test-secret");
    return calls.length === 1 ? json(account) : json([{ ...solo, queueType: "RANKED_FLEX_SR", leaguePoints: 99 }, solo]);
  });
  const result = await client.getScoreboard();
  assert.equal(calls[0], "https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Vurka/LAS");
  assert.equal(calls[1], "https://la2.api.riotgames.com/lol/league/v4/entries/by-puuid/test-puuid");
  assert.equal(result.player?.ranked?.lp, 43);
  assert.equal(result.player?.ranked?.wins, 12);
  assert.ok(!JSON.stringify(result).includes("test-secret"));
  assert.ok(!JSON.stringify(result).includes("test-puuid"));
});

test("varias pestañas y actualizaciones manuales comparten la consulta de un minuto", async () => {
  let count = 0;
  let clock = 1_000_000;
  const client = new RiotClient(() => "key", async () => { count++; return count === 1 ? json(account) : json([solo]); }, () => clock);
  await Promise.all([client.getScoreboard(), client.getScoreboard(), client.getScoreboard()]);
  await client.getScoreboard();
  assert.equal(count, 2);
  clock += 60_001;
  await client.getScoreboard();
  assert.equal(count, 3);
});

test("ausencia de Solo/Duo significa sin clasificar; respuesta mal formada significa error", () => {
  assert.equal(parseRanked([]), null);
  assert.equal(parseRanked([{ ...solo, queueType: "RANKED_FLEX_SR" }]), null);
  assert.throws(() => parseRanked({}));
  assert.throws(() => parseRanked([{}]));
  assert.throws(() => parseRanked([{ ...solo, wins: -1 }]));
  assert.equal(parseRanked([{ ...solo, wins: undefined, losses: undefined }])?.wins, 0);
});

test("429 respeta Retry-After y conserva el último rango correcto", async () => {
  let calls = 0;
  let clock = 1_000_000;
  const client = new RiotClient(() => "key", async () => {
    calls++;
    return calls === 1 ? json(account) : calls === 2 ? json([solo]) : json({}, 429, { "Retry-After": "120" });
  }, () => clock);
  const initial = await client.getScoreboard();
  clock += 60_001;
  const limited = await client.getScoreboard();
  assert.equal(limited.code, "rate_limited");
  assert.equal(limited.stale, true);
  assert.deepEqual(limited.player, initial.player);
  clock += 119_000;
  await client.getScoreboard();
  assert.equal(calls, 3);
  clock += 1_001;
  await client.getScoreboard();
  assert.equal(calls, 4);
});

test("clave rechazada se distingue de cuenta no encontrada y no expone respuesta privada", async () => {
  for (const [status, code] of [[403, "access_denied"], [404, "account_not_found"]] as const) {
    const client = new RiotClient(() => "key", async () => json({ diagnostic: "secret" }, status));
    const result = await client.getScoreboard();
    assert.equal(result.code, code);
    assert.equal(result.player, null);
    assert.ok(!JSON.stringify(result).includes("secret"));
  }
});

test("cambiar la clave invalida también el PUUID y los datos en memoria", async () => {
  let key = "old";
  const urls: string[] = [];
  const client = new RiotClient(() => key, async (url) => {
    urls.push(String(url));
    return String(url).includes("/accounts/") ? json({ ...account, puuid: key }) : json([solo]);
  });
  await client.getScoreboard();
  key = "new";
  await client.getScoreboard();
  assert.equal(urls.length, 4);
  assert.ok(urls[3].endsWith("/new"));
});

test("un fallo de red conserva el dato anterior sin presentarlo como actualizado", async () => {
  let calls = 0;
  let clock = 1_000_000;
  const client = new RiotClient(() => "key", async () => {
    calls++;
    if (calls > 2) throw new Error("network");
    return calls === 1 ? json(account) : json([solo]);
  }, () => clock);
  const first = await client.getScoreboard();
  clock += 60_001;
  const second = await client.getScoreboard();
  assert.equal(second.stale, true);
  assert.equal(second.player?.checkedAt, first.player?.checkedAt);
});
