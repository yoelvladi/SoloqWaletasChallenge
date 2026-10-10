import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { CHALLENGE_START_MS } from "../lib/challenge-period";
import type { ChallengeRecord } from "../lib/types";
import { gameRole, type GameRole, type RoleHistory } from "../lib/roles";

type Identity = { id: string; puuid: string; routing: string };
type Match = { start: number; queue: number; remake: boolean; outcomes: Record<string, boolean>; positions?: Record<string, GameRole | null> };
type Job = { end: number; offset: number; listed: boolean; ids: string[]; index: number; wins: number; losses: number; roles: RoleHistory };
type State = { version?: number; identity: string; totals: ChallengeRecord["totals"]; job: Job | null; next: number; error?: string };
const identityHash = (puuid: string) => createHash("sha256").update(puuid).digest("hex");
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

export function parseMatch(value: unknown, expectedId: string): Match {
  if (!object(value) || !object(value.metadata) || value.metadata.matchId !== expectedId || !object(value.info)) throw new Error("invalid_match");
  const info = value.info;
  if (!Number.isSafeInteger(info.gameStartTimestamp) || !Number.isInteger(info.queueId) || !Array.isArray(info.participants) || !info.participants.length) throw new Error("invalid_match");
  const outcomes: Record<string, boolean> = {};
  const positions: Record<string, GameRole | null> = {};
  for (const player of info.participants) {
    if (!object(player) || typeof player.puuid !== "string" || typeof player.win !== "boolean") throw new Error("invalid_participant");
    outcomes[identityHash(player.puuid)] = player.win;
    positions[identityHash(player.puuid)] = gameRole(player.teamPosition);
  }
  // Exclude short games explicitly marked as early endings for every participant.
  // Normal early surrender losses still count.
  const remake = typeof info.gameDuration === "number" && info.gameDuration < 300 && info.participants.every(p => p.gameEndedInEarlySurrender === true);
  return { start: Number(info.gameStartTimestamp), queue: Number(info.queueId), remake, outcomes, positions };
}

class HistoryPause extends Error { constructor(readonly delay: number) { super("rate_limit"); } }

export class ChallengeHistory {
  readonly db: DatabaseSync;
  private running: Promise<void> | null = null;
  private requests: number[] = [];
  private pausedUntil = 0;
  private lastKey = "";
  private keyInitialized = false;
  private cursor = 0;
  constructor(path: string, private key: () => string | undefined, private fetcher: typeof fetch = fetch, private now: () => number = Date.now) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS history_state (id TEXT PRIMARY KEY, period INTEGER NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS history_match (id TEXT PRIMARY KEY, data TEXT NOT NULL);`);
  }
  private load(id: string): State | undefined {
    const row = this.db.prepare("SELECT data FROM history_state WHERE id=? AND period=?").get(id, CHALLENGE_START_MS);
    return row ? JSON.parse(String(row.data)) : undefined;
  }
  private save(id: string, state: State) {
    this.db.prepare("INSERT OR REPLACE INTO history_state VALUES (?,?,?)").run(id, CHALLENGE_START_MS, JSON.stringify(state));
  }
  view(id: string): ChallengeRecord {
    let state: State | undefined;
    try { state = this.load(id); }
    catch { return { status: "error", totals: null, message: "No se pudo leer el historial guardado. Revisa el almacenamiento." }; }
    if (state?.error) return { status: "error", totals: state.totals, message: state.error };
    if (!state?.totals || !state.totals.roles || state.job || this.now() > state.next) return { status: "loading", totals: state?.totals ?? null, message: state?.totals && !state.totals.roles ? "Calculando roles del desafío" : state?.totals ? "Actualizando historial" : state?.job?.listed ? `Cargando historial (${state.job.index}/${state.job.ids.length})` : "Buscando partidas del período" };
    return { status: "ready", totals: state.totals, message: "Solo/Dúo desde el 30 sep 2026" };
  }
  sync(identities: Identity[], budget = 8): Promise<void> {
    if (!this.running) this.running = this.batch(identities, budget).finally(() => { this.running = null; });
    return this.running;
  }
  private async request(url: string) {
    const key = this.key()?.trim();
    if (!key) throw new Error("missing_key");
    const now = this.now();
    this.requests = this.requests.filter(time => now - time < 120_000);
    // Leave headroom for account and rank queries; don't hold the HTTP response open.
    if (now < this.pausedUntil) throw new HistoryPause(this.pausedUntil - now);
    if (this.requests.length >= 70) throw new HistoryPause(120_001 - (now - this.requests[0]));
    const recent = this.requests.filter(time => now - time < 1000);
    if (recent.length >= 10) throw new HistoryPause(1001 - (now - recent[0]));
    this.requests.push(now);
    const response = await this.fetcher(url, { headers: { "X-Riot-Token": key }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) });
    if (response.status === 429) {
      const value = response.headers.get("Retry-After") ?? "60";
      const delay = /^\d+(\.\d+)?$/.test(value) ? Number(value) * 1000 : Date.parse(value) - now;
      this.pausedUntil = now + (Number.isFinite(delay) ? Math.max(1000, delay) : 60_000);
      throw new HistoryPause(this.pausedUntil - now);
    }
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "access_denied" : "unavailable");
    return response.json() as Promise<unknown>;
  }
  private async batch(identities: Identity[], budget: number) {
    if (!identities.length) return;
    const currentKey = this.key() ?? "";
    if (this.keyInitialized && currentKey !== this.lastKey) {
      this.lastKey = currentKey;
      for (const identity of identities) {
        const state = this.load(identity.id);
        if (state?.error) { state.next = 0; delete state.error; this.save(identity.id, state); }
      }
    }
    this.lastKey = currentKey;
    this.keyInitialized = true;
    const deadline = this.now() + 12_000;
    let idle = 0;
    while (budget > 0 && idle < identities.length && this.now() < deadline) {
      const identity = identities[this.cursor++ % identities.length];
      const hash = identityHash(identity.puuid);
      let state = this.load(identity.id);
      if (!state || state.identity !== hash) state = { identity: hash, totals: null, job: null, next: 0 };
      // Upgrade old counts without discarding the last complete V/D. Old jobs
      // restart because their already-processed matches have no role counts.
      if (state.version !== 2) { state.version = 2; state.job = null; state.next = 0; delete state.error; }
      if (this.now() < CHALLENGE_START_MS) {
        state.totals = { wins: 0, losses: 0, checkedAt: new Date(this.now()).toISOString(), roles: { counts: {}, unknown: 0 } };
        state.job = null; state.next = CHALLENGE_START_MS;
        this.save(identity.id, state); idle++; continue;
      }
      if (this.now() < state.next) { idle++; continue; }
      idle = 0;
      state.job ??= { end: Math.floor(this.now() / 1000), offset: 0, listed: false, ids: [], index: 0, wins: 0, losses: 0, roles: { counts: {}, unknown: 0 } };
      const job = state.job;
      try {
        if (!job.listed) {
          budget--;
          const query = new URLSearchParams({ startTime: String(CHALLENGE_START_MS / 1000), endTime: String(job.end), queue: "420", start: String(job.offset), count: "100" });
          const ids = await this.request(`https://${identity.routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(identity.puuid)}/ids?${query}`);
          if (!Array.isArray(ids) || ids.length > 100 || ids.some(id => typeof id !== "string" || !/^[A-Z0-9]+_\d+$/.test(id))) throw new Error("invalid_list");
          job.ids = [...new Set([...job.ids, ...ids])];
          job.offset += ids.length;
          job.listed = ids.length < 100;
        } else if (job.index < job.ids.length) {
          const matchId = job.ids[job.index];
          const saved = this.db.prepare("SELECT data FROM history_match WHERE id=?").get(matchId);
          let match: Match | undefined = saved ? JSON.parse(String(saved.data)) : undefined;
          if (!match?.positions) {
            budget--;
            match = parseMatch(await this.request(`https://${identity.routing}.api.riotgames.com/lol/match/v5/matches/${matchId}`), matchId);
            this.db.prepare("INSERT OR REPLACE INTO history_match VALUES (?,?)").run(matchId, JSON.stringify(match));
          }
          if (match.queue === 420 && match.start >= CHALLENGE_START_MS && match.start <= job.end * 1000 && !match.remake) {
            if (typeof match.outcomes[hash] !== "boolean") {
              this.db.prepare("DELETE FROM history_match WHERE id=?").run(matchId);
              throw new Error("missing_participant");
            }
            if (match.outcomes[hash]) job.wins++; else job.losses++;
            const role = match.positions?.[hash];
            if (role) {
              const previous = job.roles.counts[role];
              job.roles.counts[role] = { games: (previous?.games ?? 0) + 1, lastPlayedAt: Math.max(previous?.lastPlayedAt ?? 0, match.start) };
            } else job.roles.unknown++;
          }
          job.index++;
        }
        if (job.listed && job.index === job.ids.length) {
          state.totals = { wins: job.wins, losses: job.losses, checkedAt: new Date(job.end * 1000).toISOString(), roles: job.roles };
          state.job = null;
          state.next = this.now() + 60_000;
        }
        delete state.error;
      } catch (error) {
        state.next = this.now() + (error instanceof HistoryPause ? error.delay : 60_000);
        state.error = error instanceof HistoryPause ? "Historial en espera por el límite de Riot" : error instanceof Error && error.message === "access_denied" ? "Riot rechazó el historial. Revisa la clave." : "No se pudo completar el historial. Se reintentará.";
        if (error instanceof HistoryPause) this.pausedUntil = Math.max(this.pausedUntil, state.next);
      }
      // Commit progress so restarts don't lose the imported matches or double-count them.
      this.save(identity.id, state);
      if (this.now() < this.pausedUntil) break;
    }
  }
}
