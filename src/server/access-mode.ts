export function publicScoreboard(env: Record<string, string | undefined> = process.env) {
  const value = env.SCOREBOARD_PUBLIC?.trim();
  if (value === undefined || value === "false") return false;
  if (value === "true") return true;
  throw new Error("SCOREBOARD_PUBLIC debe ser true o false.");
}
