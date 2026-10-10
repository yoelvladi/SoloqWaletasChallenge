export function mailProvider(env: Record<string, string | undefined> = process.env): "resend" | "smtp" | null {
  if (!env.MAIL_FROM?.trim()) return null;
  if (env.RESEND_API_KEY?.trim()) return "resend";
  return env.SMTP_HOST?.trim() && [465, 587].includes(Number(env.SMTP_PORT)) && env.SMTP_USER?.trim() && env.SMTP_PASS?.trim() ? "smtp" : null;
}
