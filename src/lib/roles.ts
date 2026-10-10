export const gameRoles = ["TOP", "JG", "MID", "ADC", "SUPP"] as const;
export type GameRole = typeof gameRoles[number];
export type RoleHistory = { counts: Partial<Record<GameRole, { games: number; lastPlayedAt: number }>>; unknown: number };

export function gameRole(position: unknown): GameRole | null {
  switch (position) {
    case "TOP": return "TOP";
    case "JUNGLE": return "JG";
    case "MIDDLE": return "MID";
    case "BOTTOM": return "ADC";
    case "UTILITY": return "SUPP";
    default: return null;
  }
}

export function mainRoles(history: RoleHistory | undefined) {
  if (!history) return [];
  return gameRoles.flatMap(role => {
    const count = history.counts[role];
    return count && count.games > 0 ? [{ role, ...count }] : [];
  }).sort((a, b) => b.games - a.games || b.lastPlayedAt - a.lastPlayedAt || gameRoles.indexOf(a.role) - gameRoles.indexOf(b.role)).slice(0, 2);
}
