import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { PlayerSnapshot } from "../lib/types";
import { parseRanked } from "./riot-client";

export interface SnapshotStore {
  load(): Promise<PlayerSnapshot[]>;
  save(snapshots: PlayerSnapshot[]): Promise<void>;
}

export class FileSnapshotStore implements SnapshotStore {
  constructor(private path: string) {}
  async load(): Promise<PlayerSnapshot[]> {
    try {
      const body = JSON.parse(await readFile(this.path, "utf8"));
      if (body.version !== 1 || !Array.isArray(body.players)) throw new Error("invalid_store");
      return body.players.map((value: PlayerSnapshot) => {
        if (!value || ![value.id, value.gameName, value.tagLine, value.checkedAt].every(s => typeof s === "string" && s.length > 0)
          || value.region !== "LAS" || !Number.isFinite(Date.parse(value.checkedAt))) throw new Error("invalid_snapshot");
        const rank = value.ranked;
        const ranked = rank === null ? null : parseRanked([{ queueType: "RANKED_SOLO_5x5", tier: rank.tier, rank: rank.division, leaguePoints: rank.lp, wins: rank.wins, losses: rank.losses }]);
        return { id: value.id, gameName: value.gameName, tagLine: value.tagLine, region: "LAS", checkedAt: value.checkedAt, ranked };
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw new Error("snapshot_read_failed");
    }
  }
  async save(snapshots: PlayerSnapshot[]) {
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    // Solo información visible del scoreboard. No se guardan PUUID, claves ni respuestas brutas.
    await writeFile(temporary, JSON.stringify({ version: 1, players: snapshots }, null, 2), "utf8");
    await rename(temporary, this.path);
  }
}
