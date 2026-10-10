import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { appConfig } from "../src/server/config";
import { publicScoreboard } from "../src/server/access-mode";

const local = { APP_URL: "http://127.0.0.1:3000", ADMIN_EMAIL: "admin@example.test", AUTH_SECRET: "f8e770b2aa764590ac76c1e93708babc" };
test("public configuration requires HTTPS, SMTP and an absolute data path", () => {
  assert.equal(appConfig(local).local, true);
  assert.throws(() => appConfig({ ...local, APP_URL: "http://challenge.example" }), /HTTPS/);
  assert.throws(() => appConfig({ ...local, APP_URL: "https://challenge.example" }), /SMTP/);
  const remote = { ...local, APP_URL: "https://challenge.example", SMTP_HOST: "smtp.example", SMTP_PORT: "587", SMTP_USER: "user", SMTP_PASS: "pass", MAIL_FROM: "mail@example.test" };
  assert.throws(() => appConfig(remote), /DATA_DIR/);
  assert.throws(() => appConfig({ ...remote, DATA_DIR: "data" }), /absoluta/);
  assert.equal(appConfig({ ...remote, DATA_DIR: resolve("data") }).local, false);
  const resend = appConfig({ ...local, APP_URL: "https://challenge.example", RESEND_API_KEY: "test-key", MAIL_FROM: "mail@example.test", DATA_DIR: resolve("data") });
  assert.equal(resend.mail, "resend"); assert.equal(resend.local, false);
  assert.throws(() => appConfig({ ...local, APP_URL: "http://user:pass@127.0.0.1:3000" }), /origen/);
  assert.throws(() => appConfig({ ...local, AUTH_SECRET: "a".repeat(64) }), /aleatorio/);
  assert.throws(() => appConfig({ ...local, ADMIN_EMAIL: "invalid" }), /ADMIN_EMAIL/);
});

test("public viewing needs no mail provider and does not remove configuration protections", () => {
  assert.equal(publicScoreboard({}), false);
  assert.equal(publicScoreboard({ SCOREBOARD_PUBLIC: "false" }), false);
  assert.equal(publicScoreboard({ SCOREBOARD_PUBLIC: "true" }), true);
  assert.throws(() => publicScoreboard({ SCOREBOARD_PUBLIC: "yes" }), /true o false/);
  const remote = { ...local, APP_URL: "https://challenge.example", SCOREBOARD_PUBLIC: "true", DATA_DIR: resolve("data") };
  const config = appConfig(remote);
  assert.equal(config.publicBoard, true); assert.equal(config.mail, null);
  assert.throws(() => appConfig({ ...remote, APP_URL: "http://challenge.example" }), /HTTPS/);
  assert.throws(() => appConfig({ ...remote, DATA_DIR: "data" }), /absoluta/);
  assert.throws(() => appConfig({ ...remote, AUTH_SECRET: "weak" }), /aleatorio/);
  assert.throws(() => appConfig({ ...remote, SCOREBOARD_PUBLIC: "false" }), /correo/);
});
