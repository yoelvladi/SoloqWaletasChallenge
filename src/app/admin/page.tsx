import { redirect } from "next/navigation";
import { requireUser, getAccessRuntime } from "@/server/auth";
import { mailConfigured } from "@/server/access-mail";
import { AccountHeader } from "@/components/account-header";
import { AccessAdmin } from "@/components/access-admin";

export default async function AdminPage() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  const grants = (await getAccessRuntime()).access.list();
  return <><AccountHeader user={user}/><main><a className="subtle-link" href="/">← Volver a la clasificación</a><div className="page-heading admin-heading"><div><span className="eyebrow">ADMINISTRACIÓN</span><h1>Tu grupo, tus invitados.</h1><p>Gestiona quién puede ver SoloQWaletasChallenge.</p></div></div><AccessAdmin grants={grants} canMail={mailConfigured()}/></main></>;
}
