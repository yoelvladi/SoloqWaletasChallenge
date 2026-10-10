export const challenge = {
  name: "SoloQWaletasChallenge",
  capacity: 8,
  region: "LAS",
  platform: "la2",
  routing: "americas",
  queue: "RANKED_SOLO_5x5",
} as const;

export type PlayerConfig = { id: string; gameName: string; tagLine: string; platform: string; routing: string };

export const players: readonly PlayerConfig[] = [
  { id: "vurka-las", gameName: "Vurka", tagLine: "LAS", platform: "la2", routing: "americas" },
  { id: "nexklee-las", gameName: "Nexklee", tagLine: "LAS", platform: "la2", routing: "americas" },
  { id: "nunc4gano-las", gameName: "Nunc4gano", tagLine: "LAS", platform: "la2", routing: "americas" },
  { id: "diez-y-siete-soloq", gameName: "diez y siete", tagLine: "soloq", platform: "la2", routing: "americas" },
  { id: "vntcr47lanovaera-soloq", gameName: "VNTCR47LaNovaEra", tagLine: "SOLOQ", platform: "la2", routing: "americas" },
  { id: "ANGOL-BrunoSex7-las", gameName: "ANGOL BrunoSex7", tagLine: "LAS", platform: "la2", routing: "americas" },
  { id: "zerogokii-las", gameName: "ZeroGokii", tagLine: "LAS", platform: "la2", routing: "americas" },
  { id: "thanatossp-las", gameName: "ThanaTosSP", tagLine: "LAS", platform: "la2", routing: "americas" },
] as const;
