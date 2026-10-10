import { RiotClient } from "./riot-client";
import type { PlayerConfig } from "../lib/players";
import type { PlayerSnapshot, ScoreboardResponse, Standing } from "../lib/types";
import { rankPlayers } from "../lib/ranking";
import type { SnapshotStore } from "./snapshot-store";
import type { ChallengeHistory } from "./challenge-history";

export class ScoreboardService {
  private clients: RiotClient[] | null = null;
  private pending: Promise<ScoreboardResponse> | null = null;
  private blockedUntil = 0;
  private saved = "";
  private storageWarning: string | undefined;
  constructor(
    private roster: readonly PlayerConfig[],
    private key: () => string | undefined,
    private store: SnapshotStore,
    private fetcher: typeof fetch = fetch,
    private now: () => number = Date.now,
    private history?: ChallengeHistory,
  ) {}

  // Una respuesta 429 pausa las nuevas solicitudes de todas las cuentas.
  private sharedFetch: typeof fetch = async (url, options) => {
    if (this.now() < this.blockedUntil) return new Response(null, { status: 429, headers: { "Retry-After": String(Math.ceil((this.blockedUntil - this.now()) / 1000)) } });
    const response = await this.fetcher(url, options);
    if (response.status === 429) {
      const header = response.headers.get("Retry-After");
      const seconds = header ? Number(header) : NaN;
      const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header ?? "") - this.now();
      this.blockedUntil = this.now() + (Number.isFinite(delay) ? Math.max(60_000, delay) : 60_000);
    }
    return response;
  };

  getScoreboard(): Promise<ScoreboardResponse> {
    if (!this.pending) this.pending = this.update().finally(() => { this.pending = null; });
    return this.pending;
  }

  async syncHistory() {
    if (!this.history || !this.clients) return;
    const identities = this.clients.flatMap((client, index) => {
      const puuid = client.getPuuid();
      return puuid ? [{ id: this.roster[index].id, routing: this.roster[index].routing, puuid }] : [];
    });
    await this.history.sync(identities);
  }

  private async update(): Promise<ScoreboardResponse> {
    if (!this.clients) {
      let initial: PlayerSnapshot[] = [];
      try { initial = await this.store.load(); }
      catch { this.storageWarning = "No se pudo recuperar la copia local. Se consultarán de nuevo los datos de Riot."; }
      this.clients = this.roster.map(config => new RiotClient(this.key, this.sharedFetch, this.now, config,
        initial.find(snapshot => snapshot.id === config.id) ?? null));
    }
    const results = await Promise.all(this.clients.map(client => client.getScoreboard()));
    const entries: Standing[] = results.map((result, i) => ({
      ...result, id: this.roster[i].id,
      gameName: result.player?.gameName ?? this.roster[i].gameName,
      tagLine: result.player?.tagLine ?? this.roster[i].tagLine,
      position: null,
      challengeRecord: this.history?.view(this.roster[i].id),
    }));
    const snapshots = results.flatMap(result => result.player ? [result.player] : []);
    const serialized = JSON.stringify(snapshots);
    if (snapshots.length && serialized !== this.saved) {
      try { await this.store.save(snapshots); this.saved = serialized; this.storageWarning = undefined; }
      catch { this.storageWarning = "No se pudo guardar la copia local. Los datos actuales siguen disponibles, pero podrían perderse al reiniciar."; }
    }
    const ready = results.filter(result => result.status === "ready").length;
    const status = results.every(result => result.status === "setup") ? "setup" : ready === results.length ? "ready" : ready ? "partial" : "error";
    const attempts = results.flatMap(result => result.nextRefreshAt ? [result.nextRefreshAt] : []).sort();
    return {
      status,
      message: status === "setup" ? "Configura la clave para conectar las cuentas con Riot."
        : status === "ready" ? `${ready} cuentas consultadas correctamente en Riot.`
        : `${ready} de ${results.length} cuentas actualizadas. Revisa el estado de cada jugador.`,
      players: rankPlayers(entries), nextRefreshAt: attempts[0] ?? null, storageWarning: this.storageWarning,
    };
  }
}
