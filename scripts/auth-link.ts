import { createAccessRuntime } from "../src/server/auth-core";
import { normalizeEmail } from "../src/server/access-store";
import { dataPath } from "../src/server/config";

async function main() {
  const origin = process.env.APP_URL || "http://127.0.0.1:3000";
  const parsed = new URL(origin);
  if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || parsed.protocol !== "http:") {
    throw new Error("Este comando es exclusivo para desarrollo local. Usa el correo para un sitio publicado.");
  }
  const email = normalizeEmail(process.argv[2] || process.env.ADMIN_EMAIL);
  if (!email) throw new Error("Indica un correo válido o configura ADMIN_EMAIL.");
  const runtime = await createAccessRuntime({
    baseURL: origin, secret: process.env.AUTH_SECRET || "", adminEmail: process.env.ADMIN_EMAIL || "",
    databasePath: dataPath("access.sqlite"),
    sendMail: async mail => {
      console.log(`\nAcceso LOCAL para ${mail.email}. No se envió un correo.\nAbre este enlace en el navegador (caduca en 10 minutos):\n\n${mail.url}\n\nNo compartas este enlace.\n`);
    },
  });
  try {
    if (!runtime.access.get(email)?.active) throw new Error("Ese correo no está autorizado. Añádelo primero desde el panel Accesos.");
    await runtime.auth.api.signInMagicLink({ headers: new Headers({ origin }), body: { email } });
  } finally { runtime.db.close(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "No se pudo generar el enlace."); process.exitCode = 1; });
