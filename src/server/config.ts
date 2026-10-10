import { isAbsolute, resolve } from "node:path";
import { normalizeEmail } from "./access-store";
import { mailProvider } from "./mail-config";
import { publicScoreboard } from "./access-mode";

export function appConfig(env: Record<string, string | undefined> = process.env) {
  const value = env.APP_URL || "http://127.0.0.1:3000";
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("APP_URL debe contener solo el origen, sin rutas ni credenciales.");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((!local && url.protocol !== "https:") || (local && !["http:", "https:"].includes(url.protocol))) throw new Error("La URL pública debe usar HTTPS.");
  const adminEmail = normalizeEmail(env.ADMIN_EMAIL);
  if (!adminEmail) throw new Error("Falta un ADMIN_EMAIL válido.");
  const secret = env.AUTH_SECRET?.trim() || "";
  if (secret.length < 32 || /^(changeme|example|replace|secret)/i.test(secret) || new Set(secret).size < 8) throw new Error("AUTH_SECRET debe ser aleatorio y tener al menos 32 caracteres.");
  const mail = mailProvider(env);
  const publicBoard = publicScoreboard(env);
  if (!local && !publicBoard && !mail) throw new Error("Configura correo por Resend o SMTP antes de activar el acceso por invitación en una URL pública.");
  if (!local && !env.DATA_DIR) throw new Error("Configura DATA_DIR en un volumen persistente antes de publicar.");
  if (!local && !isAbsolute(env.DATA_DIR!)) throw new Error("DATA_DIR debe ser una ruta absoluta para la instalación pública.");
  // Mutable private data is supplied by the runtime volume, never bundled.
  return { origin: url.origin, local, adminEmail, secret, mail, publicBoard, dataDir: resolve(/* turbopackIgnore: true */ env.DATA_DIR || "data") };
}

export function dataPath(name: string) {
  return resolve(/* turbopackIgnore: true */ process.env.DATA_DIR || "data", name);
}
