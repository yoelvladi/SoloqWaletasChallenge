import "server-only";
import { join } from "node:path";
import { appConfig } from "./config";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAccessRuntime, authorizedUser, type AccessRuntime } from "./auth-core";
import { sendAccessMail } from "./access-mail";

const globalAuth = globalThis as typeof globalThis & { waletasAuth?: { key: string; value: Promise<AccessRuntime> } };
export function getAccessRuntime() {
  const { origin: baseURL, secret, adminEmail, dataDir } = appConfig();
  const key = JSON.stringify([baseURL, secret, adminEmail, dataDir]);
  if (!globalAuth.waletasAuth || globalAuth.waletasAuth.key !== key) {
    const value = createAccessRuntime({ baseURL, secret, adminEmail, databasePath: join(dataDir, "access.sqlite"), sendMail: sendAccessMail });
    globalAuth.waletasAuth = { key, value };
    value.catch(() => { if (globalAuth.waletasAuth?.value === value) delete globalAuth.waletasAuth; });
  }
  return globalAuth.waletasAuth.value;
}
export async function requireUser() {
  const user = await authorizedUser(await getAccessRuntime(), await headers());
  if (!user) redirect("/acceso");
  return user;
}
