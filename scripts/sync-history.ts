import { setTimeout } from "node:timers/promises";
import { players } from "../src/lib/players";
import { RiotClient } from "../src/server/riot-client";
import { ChallengeHistory } from "../src/server/challenge-history";
import { dataPath } from "../src/server/config";

async function main() {
  const clients = players.map(player => new RiotClient(() => process.env.RIOT_API_KEY, fetch, Date.now, player));
  const accounts = await Promise.all(clients.map(client => client.getScoreboard()));
  if (accounts.some(account => account.status !== "ready")) {
    console.error("No se pudo validar todo el grupo. Comprueba la clave y la conexión con npm run riot:check.");
    process.exitCode = 1; return;
  }
  const identities = clients.map((client, index) => ({ id: players[index].id, puuid: client.getPuuid()!, routing: players[index].routing }));
  const history = new ChallengeHistory(dataPath("history.sqlite"), () => process.env.RIOT_API_KEY);
  const requestedAt = Math.floor(Date.now() / 1000) * 1000;
  const deadline = Date.now() + 20 * 60_000;
  let nextReport = 0;
  try {
    while (Date.now() < deadline) {
      await history.sync(identities);
      const results = players.map(player => ({ riotId: `${player.gameName}#${player.tagLine}`, ...history.view(player.id) }));
      // A previous complete import can be stale; finish only after a new listing.
      if (results.every(result => result.totals?.roles && Date.parse(result.totals.checkedAt) >= requestedAt)) {
        console.log(JSON.stringify(results, null, 2)); return;
      }
      if (Date.now() >= nextReport) {
        console.log(JSON.stringify(results.map(result => ({ riotId: result.riotId, imported: Boolean(result.totals), message: result.message }))));
        nextReport = Date.now() + 30_000;
      }
      if (results.some(result => result.message.includes("rechazó"))) { process.exitCode = 1; return; }
      await setTimeout(1500);
    }
    console.error("Importación incompleta. El avance quedó guardado; vuelve a ejecutar el comando para continuar."); process.exitCode = 1;
  } finally { history.db.close(); }
}
main().catch(() => { console.error("No se pudo completar la importación. Comprueba la conexión y los archivos de datos."); process.exitCode = 1; });
