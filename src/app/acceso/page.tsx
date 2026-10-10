import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccountHeader } from "@/components/account-header";
import { AccessForm } from "@/components/access-form";
import { getAccessRuntime } from "@/server/auth";
import { authorizedUser } from "@/server/auth-core";
import { HextechSigil } from "@/components/rank-emblem";
import { challenge } from "@/lib/players";
import { mailConfigured } from "@/server/access-mail";

export default async function AccessPage() {
  if (await authorizedUser(await getAccessRuntime(), await headers())) redirect("/");
  return <><AccountHeader/><main className="access-page"><section className="access-intro"><span className="eyebrow">EL DESAFÍO DE LOS WALETAS</span><h1>La misma grieta.<br/><span>Una sola tabla.</span></h1><p>El camino al siguiente rango, compartido con tu grupo.</p><div className="access-details"><span>{String(challenge.capacity).padStart(2, "0")} INVOCADORES</span><span>LAS</span><span>SOLO / DÚO</span></div><HextechSigil/></section><section className="access-card" aria-labelledby="access-title"><span className="access-lock" aria-hidden="true">◇</span><h2 id="access-title">Tu pase al desafío</h2><p className="access-copy">Solo las personas invitadas pueden entrar. Usa el correo que autorizó el administrador.</p><AccessForm canMail={mailConfigured()}/><p className="access-footnote">Sin contraseñas. Cada enlace caduca en 10 minutos.</p></section></main></>;
}
