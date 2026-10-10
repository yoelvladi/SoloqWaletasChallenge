"use client";
import { useState } from "react";

export function AccessForm({ canMail }: { canMail: boolean }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/access/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await response.json();
      setError(!response.ok); setMessage(data.error || data.message);
    } catch { setError(true); setMessage("No pudimos conectar. Inténtalo de nuevo."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="access-form"><label htmlFor="email">Tu correo electrónico</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="tu@correo.com" value={email} onChange={e => setEmail(e.target.value)} disabled={!canMail}/><button className="primary-button" disabled={busy || !canMail}>{busy ? "Solicitando enlace…" : "Recibir enlace de acceso"}</button>{message && <p className={`form-message ${error ? "form-error" : ""}`} role={error ? "alert" : "status"}>{message}</p>}{!canMail && <div className="local-access-note"><strong>Envío de correos pendiente</strong><p>Por ahora, el administrador puede obtener un enlace desde la terminal del proyecto:</p><code>npm run auth:link</code><p>El enlace dura 10 minutos. Esta página sigue disponible solo en este computador.</p></div>}</form>;
}
