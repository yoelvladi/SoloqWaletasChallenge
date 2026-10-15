import { players } from "@/lib/players";
import { mainRoles } from "@/lib/roles";
import type { Standing } from "@/lib/types";

export function PlayerIdentity({ entry }: { entry: Standing }) {
  const alias = players.find(player => player.id === entry.id)?.alias;
  const record = entry.challengeRecord;
  const totals = record?.totals;
  const [primary, secondary] = mainRoles(totals?.roles);
  const rolesNote = !totals?.roles ? record?.status === "error" ? "Roles no disponibles" : "Calculando roles…" : totals.wins + totals.losses === 0 ? "Sin partidas" : "Roles sin identificar";
  const note = `${record?.status !== "ready" ? " · Historial anterior" : ""}${totals?.roles?.unknown ? ` · ${totals.roles.unknown} partidas sin rol identificado` : ""}`;
  const profileUrl = `https://op.gg/es/lol/summoners/las/${encodeURIComponent(entry.gameName)}-${encodeURIComponent(entry.tagLine)}`;
  const roleTitle = (role: NonNullable<typeof primary>, label: string) => `${label}: ${role.role} · ${role.games} ${role.games === 1 ? "partida" : "partidas"} desde el 30 de septiembre de 2026${note}`;

  return <div className="identity">
    <span className="avatar" aria-hidden="true">{entry.gameName.slice(0, 1).toUpperCase()}</span>
    <div className="player-details">
      <div className="player-heading">
        <a className="player-profile" href={profileUrl} target="_blank" rel="noopener noreferrer" title={`Ver ${entry.gameName}#${entry.tagLine} en OP.GG (nueva pestaña)`}>
          <strong>{entry.gameName}{alias && <span className="player-alias"> ({alias})</span>}<span className="profile-arrow" aria-hidden="true">↗</span></strong>
          <span className="sr-only"> · Ver perfil en OP.GG, abre en una nueva pestaña</span>
        </a>
        {primary ? <span className="role-badge role-primary" title={roleTitle(primary, "Línea más jugada")} aria-label={roleTitle(primary, "Línea más jugada")}>{primary.role}<span className="role-games">{primary.games}</span></span> : <span className="role-pending">{rolesNote}</span>}
      </div>
      <div className="player-meta">
        <span className="riot-tag">#{entry.tagLine}<span className="region-inline">LAS</span></span>
        {secondary && <span className="role-badge role-secondary" title={roleTitle(secondary, "Línea secundaria")} aria-label={roleTitle(secondary, "Línea secundaria")}>{secondary.role}<span className="role-games">{secondary.games}</span></span>}
      </div>
    </div>
  </div>;
}
