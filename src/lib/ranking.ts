import type { Ranked, Standing } from "./types";

const tiers = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"];
const divisions = ["IV", "III", "II", "I"];

export function compareRank(a: Ranked | null, b: Ranked | null): number {
  if (!a || !b) return a ? -1 : b ? 1 : 0;
  return tiers.indexOf(b.tier) - tiers.indexOf(a.tier)
    || divisions.indexOf(b.division) - divisions.indexOf(a.division)
    || b.lp - a.lp;
}

export function rankPlayers(entries: Standing[]): Standing[] {
  const sorted = [...entries].sort((a, b) => compareRank(a.player?.ranked ?? null, b.player?.ranked ?? null)
    || a.gameName.localeCompare(b.gameName, "es") || a.id.localeCompare(b.id));
  let position = 0;
  return sorted.map((entry, index) => {
    const rank = entry.player?.ranked ?? null;
    if (rank && (index === 0 || compareRank(sorted[index - 1].player?.ranked ?? null, rank) !== 0)) position = index + 1;
    return { ...entry, position: rank ? position : null };
  });
}
