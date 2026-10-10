export type Ranked = {
  tier: string;
  division: string;
  lp: number;
  wins: number;
  losses: number;
};

export type PlayerSnapshot = {
  id: string;
  gameName: string;
  tagLine: string;
  region: "LAS";
  ranked: Ranked | null;
  checkedAt: string;
};

export type PlayerResult = {
  status: "ready" | "setup" | "error";
  code?: string;
  message: string;
  player: PlayerSnapshot | null;
  stale: boolean;
  nextRefreshAt: string | null;
};

export type Standing = PlayerResult & {
  id: string;
  gameName: string;
  tagLine: string;
  position: number | null;
  challengeRecord?: ChallengeRecord;
};

export type ChallengeRecord = {
  status: "ready" | "loading" | "error";
  totals: { wins: number; losses: number; checkedAt: string; roles?: import("./roles").RoleHistory } | null;
  message: string;
};

export type ScoreboardResponse = {
  status: "ready" | "partial" | "setup" | "error";
  message: string;
  players: Standing[];
  nextRefreshAt: string | null;
  storageWarning?: string;
};
