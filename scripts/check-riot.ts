import { players } from "../src/lib/players";
import { ScoreboardService } from "../src/server/scoreboard-service";
import { FileSnapshotStore } from "../src/server/snapshot-store";
import { dataPath } from "../src/server/config";

async function main() {
  const service = new ScoreboardService(players, () => process.env.RIOT_API_KEY, new FileSnapshotStore(dataPath("scoreboard.json")));
  const result = await service.getScoreboard();
  for (const entry of result.players) console.log(JSON.stringify({
    riotId: `${entry.gameName}#${entry.tagLine}`, status: entry.status, code: entry.code,
    message: entry.message, rank: entry.player?.ranked, stale: entry.stale,
  }));
  if (result.status !== "ready") process.exitCode = 1;
}
main().catch(() => { console.error("No se pudo comprobar Riot. Revisa la conexión y los archivos locales."); process.exitCode = 1; });
