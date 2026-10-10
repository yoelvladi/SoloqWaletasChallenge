"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { challenge, players } from "@/lib/players";
import type { ScoreboardResponse, Standing } from "@/lib/types";
import { AccountHeader } from "./account-header";
import { RankEmblem, HextechSigil } from "./rank-emblem";
import { ranks, rankLabel as formatRank } from "@/lib/ranks";
import { CHALLENGE_PERIOD_LABEL, challengeWinrate } from "@/lib/challenge-period";
import { mainRoles } from "@/lib/roles";

const initialPlayers: Standing[] = players.map(p => ({ id: p.id, gameName: p.gameName, tagLine: p.tagLine, position: null, status: "setup", message: "Pendiente de consulta", player: null, stale: false, nextRefreshAt: null }));

function ago(date: string | undefined, now: number) {
  if (!date) return "Sin consultar";
  const minutes = Math.max(0, Math.floor((now - Date.parse(date)) / 60_000));
  return minutes === 0 ? "Hace unos segundos" : `Hace ${minutes} min`;
}
function RefreshIcon({ spinning = false }: { spinning?: boolean }) {
  return <svg className={spinning ? "spin" : ""} width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 17.9 17"/></svg>;
}
function PlayerRow({ entry, now }: { entry: Standing; now: number }) {
  const rank = entry.player?.ranked;
  const record = entry.challengeRecord;
  const totals = record?.totals;
  const winrate = challengeWinrate(totals);
  const roles = mainRoles(totals?.roles);
  const rolesNote = !totals?.roles ? record?.status === "error" ? "Roles no disponibles" : "Calculando roles…" : totals.wins + totals.losses === 0 ? "Sin partidas" : "Roles sin identificar";
  const recordNote = !record ? "Pendiente de historial" : record.status !== "ready" ? (totals ? "Dato anterior · " : "") + record.message : totals && totals.wins + totals.losses === 0 ? "Sin partidas en el período" : "";
  const rankLabel = rank ? formatRank(rank.tier, rank.division) : entry.player ? "Sin clasificar" : entry.code === "account_not_found" ? "Cuenta no encontrada" : entry.status === "error" ? "Consulta pendiente" : "Por consultar";
  return <tr className={`player-row ${entry.position === 1 ? "leader-row" : ""}`}>
    <td className="position">{entry.position ? String(entry.position).padStart(2, "0") : "—"}</td>
    <td><div className="identity"><span className="avatar" aria-hidden="true">{entry.gameName.slice(0, 1).toUpperCase()}</span><div><strong>{entry.gameName}</strong><span className="riot-tag">#{entry.tagLine}<span className="region-inline">LAS</span></span><div className="player-roles" aria-label="Roles más jugados desde el 30 de septiembre de 2026">{roles.length ? roles.map((item, i) => <span key={item.role} className={`role-badge ${i === 0 ? "role-primary" : ""}`} title={`${i === 0 ? "Principal" : "Secundario"}: ${item.games} partidas en ${item.role}${record?.status !== "ready" ? " · Historial anterior" : ""}${totals?.roles?.unknown ? ` · ${totals.roles.unknown} partidas sin rol identificado` : ""}`}>{item.role}<span className="role-games">{item.games}</span></span>) : <span className="role-pending">{rolesNote}</span>}</div></div></div></td>
    <td><div className={`rank-chip ${rank ? "has-rank" : ""}`}><RankEmblem tier={rank?.tier}/><div><strong>{rankLabel}</strong><span>{rank ? `${rank.lp} LP` : entry.player ? "Sin rango Solo/Duo disponible" : "Sin datos confirmados"}</span><span className={`row-freshness ${entry.stale || entry.status === "error" ? "row-warning" : ""}`}>{entry.stale ? "Dato anterior · " : ""}{entry.player ? ago(entry.player.checkedAt, now) : entry.status === "error" ? "Revisar cuenta" : "Esperando a Riot"}</span></div></div></td>
    <td className="number record" title={totals ? `Historial consultado: ${new Date(totals.checkedAt).toLocaleString("es-CL", { timeZone: "America/Santiago" })}` : undefined}>{totals ? <><span className="wins">{totals.wins}</span><span className="record-divider"> / </span><span>{totals.losses}</span></> : "—"}{recordNote && <span className={`record-note ${record?.status === "error" ? "row-warning" : ""}`}>{recordNote}</span>}</td>
    <td className="number"><strong className="winrate">{winrate !== null ? `${winrate}%` : "—"}</strong>{winrate !== null && <div className="winrate-track"><span style={{ width: `${winrate}%` }}/></div>}</td>
  </tr>;
}

export function Scoreboard({ user, publicBoard = false }: { user?: { email: string; role: "admin" | "viewer" }; publicBoard?: boolean }) {
  const [data, setData] = useState<ScoreboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const inFlight = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true; setLoading(true);
    try {
      const response = await fetch("/api/scoreboard", { cache: "no-store", signal: AbortSignal.timeout(25_000) });
      if (response.status === 401) { setData(null); window.location.replace("/acceso"); return; }
      if (!response.ok) throw new Error("request_failed");
      const result: ScoreboardResponse = await response.json();
      if (!Array.isArray(result.players)) throw new Error("invalid_response");
      setData(result);
    } catch {
      setData(previous => ({ status: "error", message: "No pudimos conectar con el servidor. Volveremos a intentarlo.", players: (previous?.players ?? initialPlayers).map(entry => ({ ...entry, status: "error", stale: Boolean(entry.player), code: "local_error", message: "No se pudo consultar el servidor.", challengeRecord: entry.challengeRecord ? { ...entry.challengeRecord, status: "error", message: "Sin conexión" } : undefined })), nextRefreshAt: null }));
    } finally { inFlight.current = false; setLoading(false); setNow(Date.now()); }
  }, []);
  useEffect(() => {
    void refresh();
    const polling = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 15_000);
    const clock = setInterval(() => setNow(Date.now()), 1_000);
    return () => { clearInterval(polling); clearInterval(clock); };
  }, [refresh]);

  const entries = data?.players ?? initialPlayers;
  const ready = entries.filter(entry => entry.status === "ready").length;
  const errors = entries.filter(entry => entry.status === "error");
  const hasData = entries.some(entry => entry.player);
  const stale = entries.some(entry => entry.stale);
  const vacancies = Math.max(0, challenge.capacity - players.length);
  const vacancyText = vacancies === 1 ? "Una plaza por completar" : vacancies ? `${vacancies} plazas por completar` : "Grupo completo";
  const checked = entries.flatMap(entry => entry.player ? [entry.player.checkedAt] : []).sort();
  const seconds = data?.nextRefreshAt ? Math.max(0, Math.ceil((Date.parse(data.nextRefreshAt) - now) / 1000)) : 0;
  const stateLabel = data?.status === "ready" ? "Conectado" : data?.status === "partial" ? "Parcial" : data?.status === "error" ? "Revisar" : "Pendiente";

  return <>
    <AccountHeader user={user} publicBoard={publicBoard}/>
    <main id="main-content">
      <div className="challenge-hero"><div className="hero-copy"><div className="eyebrow"><span className="tiny-diamond"/> LEAGUE OF LEGENDS · LAS</div><h1>SOLOQ <span>WALETAS</span><small>CHALLENGE</small></h1><p>Ocho invocadores. Una cima.<br/>Cada partida cuenta. Cada LP importa.</p><div className="hero-tags"><span>RANKED SOLO / DÚO</span><span>{publicBoard ? "ACCESO PÚBLICO" : "ACCESO POR INVITACIÓN"}</span></div></div><HextechSigil/></div>
      <section className="overview" aria-label="Resumen del desafío">
        <div className="overview-item"><span className="overline">INVOCADORES</span><div className="metric">{String(players.length).padStart(2, "0")} <span>/ {String(challenge.capacity).padStart(2, "0")}</span></div><span className="metric-note">{vacancyText}</span></div>
        <div className="overview-item"><span className="overline">REGIÓN</span><div className="metric">LAS<span className="metric-slash"> / </span></div><span className="metric-note">Latinoamérica Sur</span></div>
        <div className="overview-item"><span className="overline">CUENTAS ACTUALIZADAS</span><div className="metric">{data ? String(ready).padStart(2, "0") : "—"} <span>/ {String(players.length).padStart(2, "0")}</span></div><span className="metric-note">Cada jugador se consulta por separado</span></div>
        <div className="overview-item"><span className="overline">CONEXIÓN CON RIOT</span><div className="metric metric-status">{stateLabel}</div><span className="metric-note">{hasData ? "Datos reales de Solo / Dúo" : "A la espera de la primera consulta"}</span></div>
      </section>
      <div className="workspace">
        <section className="leaderboard" aria-labelledby="ranking-title">
          <div className="section-toolbar"><div className="section-title"><span className="section-number">01 /</span><h2 id="ranking-title">Clasificación</h2></div><button className="refresh-button" onClick={() => void refresh()} disabled={loading || seconds > 0}><RefreshIcon spinning={loading}/><span>{loading ? "Consultando…" : seconds > 0 ? `Actualizar · ${seconds}s` : "Actualizar"}</span></button></div>
          <p className="table-hint">Desliza la tabla para ver todas las estadísticas →</p>
          <p className="challenge-period"><span>V / D Y WINRATE</span> {CHALLENGE_PERIOD_LABEL}<small>Solo/Dúo · Por fecha de inicio de la partida · Remakes identificados excluidos</small></p>
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Tabla de clasificación, desplazable horizontalmente"><table><caption className="sr-only">Clasificación Solo/Duo de SoloQWaletasChallenge, región LAS</caption><thead><tr><th scope="col">#</th><th scope="col">JUGADOR</th><th scope="col">RANGO / LP</th><th scope="col" className="number">V / D</th><th scope="col" className="number">VICTORIAS %</th></tr></thead><tbody>
            {entries.map(entry => <PlayerRow key={entry.id} entry={entry} now={now}/>)}
            {Array.from({ length: vacancies }, (_, i) => <tr className="empty-row" key={i}><td className="position">—</td><td><div className="identity"><span className="empty-avatar" aria-hidden="true">+</span><div><span className="empty-name">Plaza disponible</span><span className="empty-caption">Jugador por confirmar</span></div></div></td><td><span className="empty-dash">—</span></td><td className="number empty-dash">—</td><td className="number empty-dash">—</td></tr>)}
          </tbody></table></div>
          <div className="table-footer"><span>Orden por rango actual, división y LP · Winrate = V / (V + D)</span><span>{players.length} de {challenge.capacity} participantes</span></div>
        </section>
        <aside className="sidebar" aria-label="Estado del scoreboard">
          <section className="status-card" aria-live="polite"><div className="section-title"><h3>Historial del desafío</h3></div><p>{entries.filter(entry => entry.challengeRecord?.status === "ready").length} de {players.length} historiales al día.</p><p>Las victorias y derrotas cuentan desde el 30 de septiembre. La primera carga puede tardar varios minutos.</p></section>
          <section className="connection-card"><div className="card-eyebrow"><span className={`status-dot ${data?.status === "ready" ? "connected" : ""}`}/>{data?.status === "ready" ? "CONEXIÓN ACTIVA" : data?.status === "partial" ? "ACTUALIZACIÓN PARCIAL" : "CONEXIÓN CON RIOT"}</div><h2>{players.length} jugadores en LAS.</h2><p>Los rangos se consultan cada minuto mientras esta vista está abierta. {vacancyText}.</p><div className="connection-steps"><div><span className="step-number done">✓</span><span>{players.length} Riot ID registrados</span></div><div><span className={`step-number ${ready === players.length ? "done" : ""}`}>{ready === players.length ? "✓" : "2"}</span><span>{ready} cuentas actualizadas</span></div><div><span className="step-number">3</span><span>{vacancyText}</span></div></div>{user?.role === "admin" && <button className="primary-button" onClick={() => dialog.current?.showModal()}>{hasData ? "Configuración de Riot" : "Cómo conectar Riot"}</button>}</section>
          <section className="status-card" aria-live="polite"><div className="section-title"><h3>Estado de los datos</h3><RefreshIcon spinning={loading}/></div><p className={errors.length ? "error-message" : ""}>{loading && !data ? "Consultando las cuentas registradas…" : data?.message}</p>{stale && <span className="stale-label">Algunos rangos pertenecen a una consulta anterior.</span>}{errors.map(entry => <div className="account-error" key={entry.id}><strong>{entry.gameName}#{entry.tagLine}</strong><p>{entry.message}</p></div>)}{data?.storageWarning && <p className="error-message">{data.storageWarning}</p>}<div className="status-detail"><span>Dato guardado más antiguo</span><strong>{ago(checked[0], now)}</strong></div><div className="status-detail"><span>Fuente</span><strong>Riot Games API</strong></div><div className="status-detail"><span>Copia de últimos datos</span><strong>{data?.storageWarning ? "Revisar" : hasData ? "Guardada localmente" : "Pendiente"}</strong></div></section>
        </aside>
      </div>
      <section className="rank-journey" aria-labelledby="ranks-title"><div className="journey-heading"><span className="eyebrow">CADA ASCENSO, UNA NUEVA META</span><h2 id="ranks-title">El camino a la cima</h2></div><ol>{ranks.map(rank => <li key={rank.tier}><RankEmblem tier={rank.tier} size={76} decorative/><span>{rank.label}</span></li>)}</ol></section>
      <div className="local-notice"><span aria-hidden="true">◈</span><p><strong>Tu grupo. Tu desafío.</strong> {publicBoard ? "Clasificación pública de los Waletas · Comparte el enlace del desafío." : "Clasificación privada de los Waletas · Acceso por invitación."}</p></div>
    </main>
    <footer className="site-footer"><span className="footer-brand">SOLOQ<span>WALETAS</span>CHALLENGE</span><p>SoloQWaletasChallenge isn’t endorsed by Riot Games and doesn’t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</p></footer>
    {user?.role === "admin" && <dialog ref={dialog} className="setup-dialog" aria-labelledby="setup-title"><div className="dialog-heading"><span className="eyebrow">CONFIGURACIÓN LOCAL</span><button className="close-button" onClick={() => dialog.current?.close()} aria-label="Cerrar instrucciones">×</button></div><h2 id="setup-title">Conecta tu clave de Riot.</h2><p>La clave se guarda en tu computador y solo la utiliza el servidor.</p><ol><li>Obtén una clave de desarrollo en el <a href="https://developer.riotgames.com/" target="_blank" rel="noreferrer">portal de Riot Games</a>.</li><li>Abre el archivo <code>.env.local</code> de SoloQWaletasChallenge.</li><li>Pega la clave después de <code>RIOT_API_KEY=</code> y guarda.</li><li>Espera a que el servidor recargue la configuración y pulsa Actualizar. Si no detecta el cambio, reinicia el servidor local.</li></ol><p className="dialog-note">La clave de desarrollo caduca cada 24 horas. No compartas este archivo ni envíes la clave por chat.</p><button className="primary-button" onClick={() => { dialog.current?.close(); void refresh(); }}>Comprobar conexión</button></dialog>}
  </>;
}
