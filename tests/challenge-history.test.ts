import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, unlinkSync, rmdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { ChallengeHistory } from "../src/server/challenge-history";
import { CHALLENGE_START_MS, challengeWinrate } from "../src/lib/challenge-period";
import { mainRoles } from "../src/lib/roles";

const identity = { id: "one", puuid: "private-player", routing: "americas" };
const start = CHALLENGE_START_MS;
const json = (value: unknown, status = 200, headers = {}) => Response.json(value, { status, headers });
function match(id: string, win = true, overrides = {}) {
  return { metadata: { matchId: id }, info: { gameStartTimestamp: start, queueId: 420, gameDuration: 1800, participants: [{ puuid: identity.puuid, win, teamPosition: "MIDDLE" }], ...overrides } };
}

test("Chile midnight is inclusive; only Solo/Duo in the period counts, excluding identified remakes", async () => {
  assert.equal(new Date(start).toISOString(), "2026-09-30T03:00:00.000Z");
  const matches = [match("LA2_1"), match("LA2_2", false), match("LA2_3", true, { gameStartTimestamp: start - 1 }), match("LA2_4", true, { queueId: 440 }), match("LA2_5", false, { gameDuration: 180, participants: [{ puuid: identity.puuid, win: false, gameEndedInEarlySurrender: true }] }), match("LA2_6", false, { gameDuration: 600, participants: [{ puuid: identity.puuid, win: false, gameEndedInEarlySurrender: true }] })];
  const fetcher: typeof fetch = async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/ids")) {
      assert.equal(url.searchParams.get("startTime"), String(start / 1000));
      assert.equal(url.searchParams.get("queue"), "420");
      return json(matches.map(m => m.metadata.matchId));
    }
    return json(matches.find(m => url.pathname.endsWith(m.metadata.matchId)));
  };
  const history = new ChallengeHistory(":memory:", () => "key", fetcher, () => start + 86_400_000);
  try {
    await history.sync([identity], 1);
    assert.equal(history.view(identity.id).totals, null, "never expose a partial count");
    await Promise.all([history.sync([identity]), history.sync([identity])]);
    const record = history.view(identity.id);
    assert.equal(record.status, "ready");
    assert.equal(record.totals?.wins, 1); assert.equal(record.totals?.losses, 2);
    assert.deepEqual(mainRoles(record.totals?.roles).map(r => [r.role, r.games]), [["MID", 2]], "outside-period, other queues and remakes never contribute roles");
    assert.equal(record.totals?.roles?.unknown, 1, "unknown roles still contribute V/D");
    assert.equal(challengeWinrate(record.totals), 33);
    assert.equal(challengeWinrate({ wins: 0, losses: 0 }), null);
    assert.equal(challengeWinrate(null), null);
    const stored = JSON.stringify(history.db.prepare("SELECT * FROM history_match").all());
    assert.ok(!stored.includes(identity.puuid));
  } finally { history.db.close(); }
});

test("pagination imports more than 100 games once, shares cached matches, and resumes after restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "waletas-history-")); const file = join(dir, "history.sqlite");
  let now = start + 86_400_000; let details = 0; const offsets: number[] = [];
  const ids = Array.from({ length: 101 }, (_, i) => `LA2_${i}`);
  const fetcher: typeof fetch = async input => {
    const url = new URL(String(input)); now += 2000;
    if (url.pathname.endsWith("/ids")) {
      const offset = Number(url.searchParams.get("start")); offsets.push(offset);
      return json(offset === 0 ? ids.slice(0, 100) : [ids[99], ids[100]]);
    }
    details++; return json(match(url.pathname.split("/").at(-1)!));
  };
  let history = new ChallengeHistory(file, () => "key", fetcher, () => now);
  try {
    await history.sync([identity], 4);
    assert.equal(history.view(identity.id).totals, null);
    history.db.close(); history = new ChallengeHistory(file, () => "key", fetcher, () => now);
    for (let i = 0; i < 100 && !history.view(identity.id).totals; i++) await history.sync([identity]);
    assert.equal(history.view(identity.id).totals?.wins, 101); assert.equal(details, 101);
    assert.deepEqual(offsets, [0, 100]);
    now += 61_000;
    for (let i = 0; i < 5; i++) await history.sync([identity]);
    assert.equal(history.view(identity.id).totals?.wins, 101); assert.equal(details, 101, "recounts reuse match details");
  } finally {
    history.db.close();
    for (const suffix of ["", "-wal", "-shm"]) if (existsSync(file + suffix)) unlinkSync(file + suffix);
    rmdirSync(dir);
  }
});

test("429 waits, errors preserve last complete totals, and retry resumes without double counting", async () => {
  let now = start + 86_400_000; let requests = 0; let mode = "empty";
  const fetcher: typeof fetch = async input => {
    requests++;
    if (mode === "limit") return json({}, 429, { "Retry-After": "120" });
    if (String(input).includes("/ids?")) return json(mode === "empty" ? [] : ["LA2_1", "LA2_2"]);
    if (mode === "broken" && String(input).endsWith("LA2_2")) return json({ invalid: true });
    return json(match(String(input).split("/").at(-1)!));
  };
  const history = new ChallengeHistory(":memory:", () => "key", fetcher, () => now);
  try {
    await history.sync([identity]); assert.equal(history.view(identity.id).totals?.wins, 0);
    now += 61_000; mode = "limit"; await history.sync([identity]);
    const limitedCount = requests; now += 119_000; await history.sync([identity]); assert.equal(requests, limitedCount);
    assert.equal(history.view(identity.id).totals?.wins, 0);
    now += 1001; mode = "broken"; await history.sync([identity]);
    assert.equal(history.view(identity.id).status, "error"); assert.equal(history.view(identity.id).totals?.wins, 0);
    now += 61_000; mode = "valid"; await history.sync([identity]);
    assert.equal(history.view(identity.id).totals?.wins, 2); assert.equal(history.view(identity.id).status, "ready");
  } finally { history.db.close(); }
});

test("future period and no games return zero; rejected API cannot invent empty totals", async () => {
  let now = start - 1; let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return json({}, 403); };
  const history = new ChallengeHistory(":memory:", () => "key", fetcher, () => now);
  try {
    await history.sync([identity]); assert.equal(calls, 0); assert.equal(history.view(identity.id).totals?.wins, 0);
    now = start + 1000; await history.sync([{ ...identity, id: "new" }]);
    assert.equal(history.view("new").totals, null); assert.match(history.view("new").message, /rechazó/);
  } finally { history.db.close(); }
});

test("upgrading cached matches backfills roles and restarts old partial jobs without losing completed V/D", async () => {
  const hash = createHash("sha256").update(identity.puuid).digest("hex");
  let now = start + 86_400_000; let requests = 0; let unavailable = true;
  const fetcher: typeof fetch = async input => {
    requests++;
    if (String(input).includes("/ids?")) return json(["LA2_1", "LA2_2"]);
    if (unavailable) return json({}, 503);
    const id = String(input).split("/").at(-1)!;
    return json(match(id, id === "LA2_1", { participants: [{ puuid: identity.puuid, win: id === "LA2_1", teamPosition: id === "LA2_1" ? "JUNGLE" : "UTILITY" }], gameStartTimestamp: start + (id === "LA2_2" ? 1000 : 0) }));
  };
  const history = new ChallengeHistory(":memory:", () => "key", fetcher, () => now);
  try {
    const oldTotals = { wins: 1, losses: 1, checkedAt: new Date(now - 3600_000).toISOString() };
    history.db.prepare("INSERT INTO history_state VALUES (?,?,?)").run(identity.id, start, JSON.stringify({ identity: hash, totals: oldTotals, next: now + 60_000, job: { end: now / 1000, offset: 2, listed: true, ids: ["LA2_1", "LA2_2"], index: 1, wins: 1, losses: 0 } }));
    for (const id of ["LA2_1", "LA2_2"]) history.db.prepare("INSERT INTO history_match VALUES (?,?)").run(id, JSON.stringify({ start, queue: 420, remake: false, outcomes: { [hash]: id === "LA2_1" } }));
    await history.sync([identity]);
    assert.deepEqual(history.view(identity.id).totals, oldTotals, "a failed backfill must retain completed totals");
    assert.equal(history.view(identity.id).status, "error");
    now += 61_000; unavailable = false; await history.sync([identity]);
    const totals = history.view(identity.id).totals!;
    assert.equal(totals.wins, 1); assert.equal(totals.losses, 1);
    assert.deepEqual(mainRoles(totals.roles).map(r => [r.role, r.games]), [["SUPP", 1], ["JG", 1]], "latest game breaks a tie");
    const before = requests; now += 61_000; await history.sync([identity]);
    assert.equal(requests - before, 1, "role-aware cached details are reused on the next listing");
    assert.equal(history.view(identity.id).totals?.roles?.counts.JG?.games, 1);
  } finally { history.db.close(); }
});
