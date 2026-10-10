"use client";
import { useEffect, useRef, useState } from "react";

export function ConfirmAccess() {
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const read = useRef(false);
  useEffect(() => {
    if (read.current) return;
    read.current = true;
    setToken(new URLSearchParams(window.location.hash.slice(1)).get("token") || "");
    // Keep the credential out of browser history and subsequent copied URLs.
    window.history.replaceState(null, "", "/acceso/confirmar");
    setReady(true);
  }, []);
  async function confirm() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/access/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error); setBusy(false); return; }
      setToken(""); window.location.assign("/");
    } catch { setError("No se pudo conectar. Inténtalo de nuevo."); setBusy(false); }
  }
  return <div className="access-form">{ready && !token ? <p className="form-message form-error" role="alert">Falta el enlace de acceso. Abre el enlace completo recibido o solicita uno nuevo.</p> : <><p className="access-copy">Confirma para abrir la clasificación. El enlace se usará una sola vez.</p><button className="primary-button" onClick={() => void confirm()} disabled={!ready || busy}>{busy ? "Comprobando acceso…" : "Entrar al desafío"}</button></>}{error && <p className="form-message form-error" role="alert">{error}</p>}<a className="subtle-link" href="/acceso">Solicitar otro enlace</a></div>;
}
