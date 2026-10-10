// America/Santiago: midnight on 2026-09-30 is UTC-03:00.
export const CHALLENGE_START = "2026-09-30T00:00:00-03:00";
export const CHALLENGE_START_MS = Date.parse(CHALLENGE_START);
export const CHALLENGE_PERIOD_LABEL = "Desde el 30 sep 2026 · 00:00 · Chile";
export function challengeWinrate(record: { wins: number; losses: number } | null | undefined) {
  if (!record || record.wins + record.losses === 0) return null;
  return Math.round(record.wins / (record.wins + record.losses) * 100);
}
