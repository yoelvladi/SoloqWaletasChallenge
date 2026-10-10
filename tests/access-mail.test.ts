import test from "node:test";
import assert from "node:assert/strict";
import { sendAccessMail } from "../src/server/access-mail";
import { mailProvider } from "../src/server/mail-config";

const env = { RESEND_API_KEY: "private-test-key", MAIL_FROM: "Waletas <access@example.test>" };
const mail = { email: "viewer@example.test", url: "https://challenge.example/acceso/confirmar#token=private-test-token" };
test("Resend sends the access link over HTTPS with a private header and consistent idempotency", async () => {
  const keys: string[] = [];
  const fetcher: typeof fetch = async (input, options) => {
    assert.equal(String(input), "https://api.resend.com/emails");
    assert.equal(options?.method, "POST"); assert.equal(options?.redirect, "error");
    const headers = new Headers(options?.headers);
    assert.equal(headers.get("authorization"), "Bearer " + env.RESEND_API_KEY);
    const key = headers.get("idempotency-key")!; assert.match(key, /^[a-f0-9]{64}$/); keys.push(key);
    const body = JSON.parse(String(options?.body));
    assert.deepEqual(body.to, [mail.email]); assert.equal(body.from, env.MAIL_FROM); assert.ok(body.text.includes(mail.url));
    assert.ok(!String(input).includes(env.RESEND_API_KEY)); assert.ok(!String(options?.body).includes(env.RESEND_API_KEY));
    return Response.json({ id: "message-id" });
  };
  await sendAccessMail(mail, env, fetcher); await sendAccessMail(mail, env, fetcher);
  assert.equal(keys[0], keys[1]);
});

test("missing provider, rejected delivery and malformed success fail without exposing provider details", async () => {
  assert.equal(mailProvider({ RESEND_API_KEY: "key" }), null);
  assert.equal(mailProvider({ MAIL_FROM: env.MAIL_FROM, SMTP_HOST: "smtp.test", SMTP_PORT: "25", SMTP_USER: "user", SMTP_PASS: "pass" }), null);
  assert.equal(mailProvider(env), "resend");
  await assert.rejects(sendAccessMail(mail, {}, async () => { throw new Error("must not send"); }), /MAIL_NOT_CONFIGURED/);
  for (const response of [Response.json({ message: "private-provider-details" }, { status: 403 }), Response.json({ error: "invalid" }), new Response("not-json")]) {
    await assert.rejects(sendAccessMail(mail, env, async () => response), /^Error: MAIL_DELIVERY_FAILED$/);
  }
});
