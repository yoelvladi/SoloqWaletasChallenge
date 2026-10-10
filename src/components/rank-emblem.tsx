"use client";
import Image from "next/image";
import { useState } from "react";
import { ranks } from "@/lib/ranks";

export function RankEmblem({ tier, size = 72, decorative = false }: { tier?: string; size?: number; decorative?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  const rank = ranks.find(item => item.tier === tier);
  if (!rank || failed === tier) return <span className="unranked-emblem" style={{ width: size, height: size }} aria-label={decorative ? undefined : "Sin emblema disponible"} aria-hidden={decorative}>◇</span>;
  return <Image className="rank-emblem" src={rank.image} width={size} height={size} sizes={`${size}px`} loading={size >= 200 ? "eager" : "lazy"} alt={decorative ? "" : `Emblema de ${rank.label}`} onError={() => setFailed(tier!)} />;
}

export function HextechSigil() {
  return <div className="hextech-sigil" aria-hidden="true"><div className="sigil-orbit"/><div className="sigil-orbit inner"/><span className="sigil-cross top"/><span className="sigil-cross bottom"/><RankEmblem tier="CHALLENGER" size={250} decorative/><span className="sigil-caption">EL CAMINO A LA CIMA</span></div>;
}
