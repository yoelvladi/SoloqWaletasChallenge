export const challenge = {
  name: "SoloQWaletasChallenge",
  capacity: 8,
  region: "LAS",
  platform: "la2",
  routing: "americas",
  queue: "RANKED_SOLO_5x5",
} as const;

export type PlayerConfig = { id: string; gameName: string; tagLine: string; platform: string; routing: string; alias?: string };

export const players: readonly PlayerConfig[] = [
  { id: "vurka-las", gameName: "Vurka", tagLine: "LAS", platform: "la2", routing: "americas", alias: "tarea" },
  { id: "nexklee-las", gameName: "Nexklee", tagLine: "LAS", platform: "la2", routing: "americas", alias: "whyron" },
  { id: "nunc4gano-las", gameName: "Nunc4gano", tagLine: "LAS", platform: "la2", routing: "americas", alias: "kiltrovich" },
  { id: "diez-y-siete-soloq", gameName: "diez y siete", tagLine: "soloq", platform: "la2", routing: "americas", alias: "naxo" },
  { id: "vntcr47lanovaera-soloq", gameName: "VNTCR47LaNovaEra", tagLine: "SOLOQ", platform: "la2", routing: "americas", alias: "enso" },
  { id: "ANGOL-BrunoSex7-las", gameName: "ANGOL BrunoSex7", tagLine: "LAS", platform: "la2", routing: "americas", alias: "bruno d" },
  { id: "zerogokii-las", gameName: "ZeroGokii", tagLine: "LAS", platform: "la2", routing: "americas", alias: "renunu" },
  { id: "thanatossp-las", gameName: "ThanaTosSP", tagLine: "LAS", platform: "la2", routing: "americas", alias: "vlad" },
] as const;
