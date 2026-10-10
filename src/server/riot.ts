import "server-only";
import { dataPath } from "./config";
import { players } from "../lib/players";
import { FileSnapshotStore } from "./snapshot-store";
import { ScoreboardService } from "./scoreboard-service";
import { ChallengeHistory } from "./challenge-history";

const runtime = globalThis as typeof globalThis & { waletasBoardV2?: { roster: string; service: ScoreboardService } };
export function getRiot() {
  const roster = JSON.stringify([players, dataPath("history.sqlite"), "challenge-history-v2"]);
  if (!runtime.waletasBoardV2 || runtime.waletasBoardV2.roster !== roster) {
    runtime.waletasBoardV2 = { roster, service: new ScoreboardService(players, () => process.env.RIOT_API_KEY,
      new FileSnapshotStore(dataPath("scoreboard.json")), fetch, Date.now,
      new ChallengeHistory(dataPath("history.sqlite"), () => process.env.RIOT_API_KEY)) };
  }
  return runtime.waletasBoardV2.service;
}
