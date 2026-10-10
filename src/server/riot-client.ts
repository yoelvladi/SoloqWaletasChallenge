import type { PlayerSnapshot, Ranked, PlayerResult } from "../lib/types";
import { players, type PlayerConfig } from "../lib/players";

const REFRESH_MS = 60_000;
const TIERS = new Set(["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"]);

class RiotError extends Error {
  constructor(public code: string, message: string, public retryMs = REFRESH_MS) {
    super(message);
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseRanked(value: unknown): Ranked | null {
  if (!Array.isArray(value) || value.some(entry => !record(entry) || typeof entry.queueType !== "string")) {
    throw new RiotError("invalid_response", "Riot devolvió una respuesta incompleta. Volveremos a intentarlo.");
  }
  const solo = value.find(entry => entry.queueType === "RANKED_SOLO_5x5");
  if (!solo) return null;
  const lp = solo.leaguePoints ?? 0;
  const wins = solo.wins ?? 0;
  const losses = solo.losses ?? 0;
  if (!TIERS.has(solo.tier) || !["I", "II", "III", "IV"].includes(solo.rank) ||
      ![lp, wins, losses].every(n => Number.isInteger(n) && n >= 0)) {
    throw new RiotError("invalid_response", "Riot devolvió un rango incompleto. Conservamos la última consulta correcta.");
  }
  return { tier: solo.tier, division: solo.rank, lp, wins, losses };
}

// Una sola instancia por proceso comparte resultados entre pestañas y agrupa consultas simultáneas.
// Cada cuenta mantiene su caché y sus errores por separado.
export class RiotClient {
  // Server-only identity for Match-V5. Never included in the scoreboard response.
  getPuuid() { return this.account?.puuid; }
  private lastKey = "";
  private account: { puuid: string; gameName: string; tagLine: string } | null = null;
  private snapshot: PlayerSnapshot | null = null;
  private result: PlayerResult | null = null;
  private nextAttempt = 0;
  private inFlight: Promise<PlayerResult> | null = null;

  constructor(
    private getKey: () => string | undefined,
    private fetcher: typeof fetch = fetch,
    private now: () => number = Date.now,
    private config: PlayerConfig = players[0],
    initialSnapshot: PlayerSnapshot | null = null,
  ) { this.snapshot = initialSnapshot; }

  async getScoreboard(): Promise<PlayerResult> {
    if (this.inFlight) return this.inFlight;
    const key = this.getKey()?.trim() ?? "";
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.account = null;
      this.result = null;
      this.nextAttempt = 0;
    }
    if (!key) return {
      status: "setup", code: "missing_key", message: "Configura la clave para consultar el rango en Riot.",
      player: this.snapshot, stale: Boolean(this.snapshot), nextRefreshAt: null,
    };
    if (this.result && this.now() < this.nextAttempt) return this.result;
    this.inFlight = this.update(key).finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  private async request(url: string, key: string, kind: "account" | "ranked"): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetcher(url, {
        headers: { "X-Riot-Token": key },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
        redirect: "error",
      });
    } catch {
      throw new RiotError("unavailable", "No pudimos conectar con Riot. Volveremos a intentarlo en un minuto.");
    }
    if (response.status === 401 || response.status === 403) {
      throw new RiotError("access_denied", "Riot rechazó la consulta. Revisa la vigencia y los permisos de tu clave.");
    }
    if (response.status === 429) {
      const retry = response.headers.get("Retry-After");
      const seconds = retry ? Number(retry) : NaN;
      const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retry ?? "") - this.now();
      throw new RiotError("rate_limited", "Riot pidió esperar antes de actualizar. La consulta se reintentará automáticamente.", Number.isFinite(delay) ? Math.max(REFRESH_MS, delay) : REFRESH_MS);
    }
    if (response.status === 404 && kind === "account") {
      throw new RiotError("account_not_found", `No encontramos ${this.config.gameName}#${this.config.tagLine}. Comprueba el Riot ID.`);
    }
    if (!response.ok) throw new RiotError("unavailable", "Riot no pudo completar la consulta. Conservamos los últimos datos disponibles.");
    try { return await response.json(); }
    catch { throw new RiotError("invalid_response", "Riot devolvió una respuesta incompleta. Volveremos a intentarlo."); }
  }

  private async update(key: string): Promise<PlayerResult> {
    const player = this.config;
    try {
      if (!this.account) {
        const account = await this.request(`https://${player.routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(player.gameName)}/${encodeURIComponent(player.tagLine)}`, key, "account");
        if (!record(account) || typeof account.puuid !== "string" || !account.puuid) {
          throw new RiotError("invalid_response", "No pudimos validar la cuenta de Riot.");
        }
        this.account = {
          puuid: account.puuid,
          gameName: typeof account.gameName === "string" ? account.gameName : player.gameName,
          tagLine: typeof account.tagLine === "string" ? account.tagLine : player.tagLine,
        };
      }
      const entries = await this.request(`https://${player.platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${encodeURIComponent(this.account.puuid)}`, key, "ranked");
      const ranked = parseRanked(entries);
      this.snapshot = {
        id: player.id, gameName: this.account.gameName, tagLine: this.account.tagLine,
        region: "LAS", ranked, checkedAt: new Date(this.now()).toISOString(),
      };
      this.nextAttempt = this.now() + REFRESH_MS;
      this.result = { status: "ready", message: "Datos consultados en Riot Games.", player: this.snapshot, stale: false, nextRefreshAt: new Date(this.nextAttempt).toISOString() };
    } catch (error) {
      const safe = error instanceof RiotError ? error : new RiotError("unavailable", "No pudimos actualizar los datos. Volveremos a intentarlo.");
      this.nextAttempt = this.now() + safe.retryMs;
      this.result = {
        status: "error", code: safe.code, message: safe.message, player: this.snapshot,
        stale: this.snapshot !== null, nextRefreshAt: new Date(this.nextAttempt).toISOString(),
      };
    }
    return this.result;
  }
}
