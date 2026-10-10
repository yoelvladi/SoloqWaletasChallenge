import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { getMigrations } from "better-auth/db/migration";
import { AccessStore } from "./access-store";

export type AccessMail = { email: string; url: string };
export type AuthConfig = { databasePath: string; baseURL: string; secret: string; adminEmail: string; sendMail: (mail: AccessMail) => Promise<void> };

export async function createAccessRuntime(config: AuthConfig) {
  if (config.secret.length < 32) throw new Error("Configura AUTH_SECRET con al menos 32 caracteres aleatorios.");
  const origin = new URL(config.baseURL).origin;
  if (config.databasePath !== ":memory:") mkdirSync(dirname(config.databasePath), { recursive: true });
  const db = new DatabaseSync(config.databasePath);
  try {
  db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;");
  const access = new AccessStore(db, config.adminEmail);
  const auth = betterAuth({
    appName: "SoloQWaletasChallenge",
    baseURL: origin,
    secret: config.secret,
    database: db,
    trustedOrigins: [origin],
    emailAndPassword: { enabled: false },
    session: { expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
    advanced: { cookiePrefix: "waletas", useSecureCookies: origin.startsWith("https:") },
    logger: { disabled: true },
    databaseHooks: {
      user: { create: { before: async user => Boolean(access.get(user.email)?.active) } },
      session: { create: { before: async session => {
        const user = db.prepare("SELECT email FROM user WHERE id=?").get(session.userId);
        return Boolean(user && access.get(String(user.email))?.active);
      } } },
    },
    plugins: [magicLink({
      expiresIn: 600,
      storeToken: "hashed",
      // New accounts may only be created after the allowlist hook approves them.
      sendMagicLink: async ({ email, token }) => {
        if (!access.get(email)?.active) return;
        // The fragment avoids putting the credential in server/access logs.
        await config.sendMail({ email, url: `${origin}/acceso/confirmar#token=${encodeURIComponent(token)}` });
      },
    })],
  });
  const migrations = await getMigrations(auth.options);
  await migrations.runMigrations();
  return { auth, access, db, origin };
  } catch (error) { db.close(); throw error; }
}
export type AccessRuntime = Awaited<ReturnType<typeof createAccessRuntime>>;

export async function authorizedUser(runtime: AccessRuntime, headers: Headers) {
  const session = await runtime.auth.api.getSession({ headers, query: { disableCookieCache: true } });
  if (!session) return null;
  const grant = runtime.access.get(session.user.email);
  if (!grant?.active) return null;
  return { email: grant.email, role: grant.role };
}
