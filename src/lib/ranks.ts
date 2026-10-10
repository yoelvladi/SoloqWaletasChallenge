export const ranks = [
  { tier: "IRON", label: "Hierro", image: "/ranks/iron.png" },
  { tier: "BRONZE", label: "Bronce", image: "/ranks/bronze.png" },
  { tier: "SILVER", label: "Plata", image: "/ranks/silver.png" },
  { tier: "GOLD", label: "Oro", image: "/ranks/gold.png" },
  { tier: "PLATINUM", label: "Platino", image: "/ranks/platinum.png" },
  { tier: "EMERALD", label: "Esmeralda", image: "/ranks/emerald.png" },
  { tier: "DIAMOND", label: "Diamante", image: "/ranks/diamond.png" },
  { tier: "MASTER", label: "Maestro", image: "/ranks/master.png" },
  { tier: "GRANDMASTER", label: "Gran Maestro", image: "/ranks/grandmaster.png" },
  { tier: "CHALLENGER", label: "Retador", image: "/ranks/challenger.png" },
] as const;

export function rankLabel(tier: string, division: string) {
  const name = ranks.find(rank => rank.tier === tier)?.label ?? tier;
  return ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(tier) ? name : `${name} ${division}`;
}
