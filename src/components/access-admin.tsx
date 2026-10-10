"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccessGrant } from "@/server/access-store";

export function AccessAdmin({ grants, canMail }: { grants: AccessGrant[]; canMail: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  async function act(action: "invite" | "revoke" | "send", target: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, email: target }) });
      const data = await response.json();
      if (response.status === 401) { window.location.assign("/acceso"); return; }
      setError(!response.ok); setMessage(data.error || data.message);
      if (response.ok) { setEmail(""); setConfirmEmail(null); }
      router.refresh();
    } catch { setError(true); setMessage("No se pudo conectar. Inténtalo de nuevo."); }
    finally { setBusy(false); }
  }
  return <><div className="admin-grid"><section className="access-card"><span className="eyebrow">NUEVO INVITADO</span><h2>Abre la puerta a tu grupo.</h2><p className="access-copy">Los invitados podrán consultar la clasificación. Solo tú puedes gestionar estos accesos.</p><form className="access-form" onSubmit={e => { e.preventDefault(); void act("invite", email); }}><label htmlFor="invite-email">Correo de la persona invitada</label><input id="invite-email" type="email" autoComplete="off" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="amigo@correo.com"/><button disabled={busy} className="primary-button">{busy ? "Guardando…" : canMail ? "Autorizar y enviar enlace" : "Autorizar correo"}</button></form><div className="local-access-note"><strong>{canMail ? "Envío de correos configurado" : "Envío de correos pendiente"}</strong><p>{canMail ? "Los enlaces duran 10 minutos. Cada invitado puede solicitar uno nuevo desde la pantalla de acceso." : "Autorizar un correo no envía un email todavía. Para generar un enlace local, usa la terminal del proyecto:"}</p>{!canMail && <code>npm run auth:link -- correo@ejemplo.com</code>}</div></section><section className="access-list" aria-labelledby="access-list-title"><div className="section-toolbar"><h2 id="access-list-title">Personas con acceso</h2><span className="region-pill">{grants.filter(g => g.active).length} activas</span></div><ul>{grants.map(grant => <li key={grant.email}><div className="access-person"><strong>{grant.email}</strong><span>{grant.role === "admin" ? "Administrador · Tu cuenta" : grant.active ? "Invitado · Acceso autorizado" : "Acceso revocado"}</span></div>{grant.role !== "admin" && <div className="access-actions">{grant.active ? <>{canMail && <button className="refresh-button" disabled={busy} onClick={() => void act("send", grant.email)}>Reenviar enlace</button>}<button className="danger-button" disabled={busy} onClick={() => setConfirmEmail(grant.email)}>Revocar</button></> : <button className="refresh-button" disabled={busy} onClick={() => void act("invite", grant.email)}>Volver a autorizar</button>}</div>}{confirmEmail === grant.email && <div className="revoke-confirm" role="group" aria-label="Confirmar revocación"><p>Se cerrarán sus sesiones y se anularán sus enlaces pendientes.</p><button className="danger-button" disabled={busy} onClick={() => void act("revoke", grant.email)}>Confirmar revocación</button><button className="refresh-button" disabled={busy} onClick={() => setConfirmEmail(null)}>Cancelar</button></div>}</li>)}</ul></section></div>{message && <p className={`form-message ${error ? "form-error" : ""}`} role={error ? "alert" : "status"}>{message}</p>}</>;
}
