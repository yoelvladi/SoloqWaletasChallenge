"use client";

import { useState } from "react";
export function AccountHeader({ user, publicBoard = false }: { publicBoard?: boolean; user?: { email: string; role: "admin" | "viewer" } }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setBusy(true); setError("");
    try {
      const result = await fetch("/api/access/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!result.ok) throw new Error();
      window.location.assign("/acceso");
    } catch { setError("No se pudo cerrar la sesión. Inténtalo de nuevo."); setBusy(false); }
  }
  return <header className="topbar account-topbar"><a className="brand" href="/" aria-label="SoloQWaletasChallenge, inicio"><span className="brand-mark">W</span><span>WALETAS<span className="brand-small">SOLOQ CHALLENGE</span></span></a><div className="header-context"><span className="region-pill">LAS</span>{user ? <><span className="account-email" title={user.email}>{user.email}</span>{user.role === "admin" && <a className="header-link" href="/admin">Accesos</a>}<button className="refresh-button" disabled={busy} onClick={() => void logout()}>{busy ? "Saliendo…" : "Salir"}</button>{error && <span role="alert">{error}</span>}</> : <span className="local-label">{publicBoard ? "Acceso público" : "Solo por invitación"}</span>}</div></header>;
}
