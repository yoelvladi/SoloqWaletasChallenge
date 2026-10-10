"use client";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className="access-page"><section className="access-card"><p className="eyebrow">SOLOQ WALETAS CHALLENGE</p><h1>No pudimos abrir esta vista.</h1><p>Inténtalo de nuevo en unos momentos. Si el problema continúa, avisa al administrador.</p><button className="primary-button" onClick={retry}>Reintentar</button><p><a href="/acceso">Volver al acceso</a></p></section></main>;
}
