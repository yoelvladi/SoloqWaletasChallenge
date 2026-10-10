import test from "node:test";
import assert from "node:assert/strict";
import { gameRole, mainRoles } from "../src/lib/roles";

test("Riot positions map to TOP, MID, ADC, SUPP or JG; unknown is never guessed", () => {
  assert.deepEqual(["TOP", "MIDDLE", "BOTTOM", "UTILITY", "JUNGLE"].map(gameRole), ["TOP", "MID", "ADC", "SUPP", "JG"]);
  for (const value of [undefined, "", "INVALID", "NONE", "SUPPORT", 1]) assert.equal(gameRole(value), null);
});

test("main roles rank by frequency then recency, return at most two and do not invent a second role", () => {
  assert.deepEqual(mainRoles(undefined), []);
  assert.deepEqual(mainRoles({ counts: {}, unknown: 3 }), []);
  const counts = { TOP: { games: 10, lastPlayedAt: 50 }, MID: { games: 10, lastPlayedAt: 100 }, SUPP: { games: 2, lastPlayedAt: 200 } };
  assert.deepEqual(mainRoles({ counts, unknown: 9 }).map(r => r.role), ["MID", "TOP"]);
  assert.deepEqual(mainRoles({ counts: { ADC: { games: 1, lastPlayedAt: 100 } }, unknown: 0 }).map(r => r.role), ["ADC"]);
});
