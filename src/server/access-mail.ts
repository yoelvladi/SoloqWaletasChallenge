import nodemailer from "nodemailer";
import type { AccessMail } from "./auth-core";
import { createHash } from "node:crypto";
import { mailProvider } from "./mail-config";

export function mailConfigured() {
  return Boolean(mailProvider());
}
export async function sendAccessMail({ email, url }: AccessMail, env: Record<string, string | undefined> = process.env, fetcher: typeof fetch = fetch) {
  const provider = mailProvider(env);
  if (!provider) throw new Error("MAIL_NOT_CONFIGURED");
  const message = {
    from: env.MAIL_FROM!, to: email,
    subject: "Tu acceso a SoloQWaletasChallenge",
    text: `Tienes acceso al desafío de los Waletas.\n\nAbre este enlace y pulsa Entrar al desafío:\n${url}\n\nCaduca en 10 minutos y solo se puede usar una vez. No lo compartas.\nSi no solicitaste este acceso, puedes ignorar este correo.`,
  };
  if (provider === "resend") {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST", headers: { "Authorization": `Bearer ${env.RESEND_API_KEY!.trim()}`, "Content-Type": "application/json", "Idempotency-Key": createHash("sha256").update(email + "\0" + url).digest("hex") },
      body: JSON.stringify({ ...message, to: [email] }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("MAIL_DELIVERY_FAILED");
    const result: unknown = await response.json().catch(() => null);
    if (!result || typeof result !== "object" || !("id" in result) || typeof result.id !== "string" || !result.id) throw new Error("MAIL_DELIVERY_FAILED");
    return;
  }
  const port = Number(env.SMTP_PORT);
  if (![465, 587].includes(port)) throw new Error("SMTP_PORT debe ser 465 o 587.");
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST, port, secure: port === 465, requireTLS: true,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
  });
  await transport.sendMail(message);
}
