import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAccessRuntime, authorizedUser, type AccessRuntime, type AccessMail } from "../src/server/auth-core";
import { accessPost, adminPost } from "../src/server/access-http";
import { normalizeEmail } from "../src/server/access-store";

const origin = "http://127.0.0.1:3000";
const adminEmail = "admin@example.test";
async function setup(databasePath = ":memory:", secret = randomBytes(32).toString("hex")) {
  const mails: AccessMail[] = [];
  const config = { baseURL: origin, adminEmail, secret, databasePath, sendMail: async (mail: AccessMail) => { mails.push(mail); } };
  return { runtime: await createAccessRuntime(config), mails, config };
}
function request(path: string, body: unknown, cookie = "", requestOrigin = origin) {
  return new Request(origin + path, { method: "POST", headers: { origin: requestOrigin, "content-type": "application/json", cookie }, body: JSON.stringify(body) });
}
function cookieFrom(response: Response) {
  return response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
}
async function issue(runtime: AccessRuntime, mails: AccessMail[], email: string) {
  await runtime.auth.api.signInMagicLink({ headers: new Headers({ origin }), body: { email } });
  const mail = mails.at(-1);
  assert.equal(mail?.email, email);
  return new URLSearchParams(new URL(mail!.url).hash.slice(1)).get("token")!;
}
async function login(runtime: AccessRuntime, mails: AccessMail[], email = adminEmail) {
  const token = await issue(runtime, mails, email);
  const response = await accessPost(request("/api/access/confirm", { token }), "confirm", runtime, true);
  assert.equal(response.status, 200);
  return cookieFrom(response);
}

test("private access: invited users only, one-use hashed links, secure session attributes and logout", async () => {
  const { runtime, mails } = await setup();
  try {
    assert.equal(await authorizedUser(runtime, new Headers()), null);
    const unknown = await accessPost(request("/api/access/request", { email: "unknown@example.test" }), "request", runtime, true);
    assert.equal(unknown.status, 200); assert.equal(mails.length, 0);
    const token = await issue(runtime, mails, adminEmail);
    const saved = JSON.stringify(runtime.db.prepare("SELECT * FROM verification").all());
    assert.ok(!saved.includes(token), "plain link credential must not be saved");
    const response = await accessPost(request("/api/access/confirm", { token }), "confirm", runtime, true);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.match(response.headers.get("set-cookie")!, /HttpOnly/i);
    assert.match(response.headers.get("set-cookie")!, /SameSite=Lax/i);
    const cookie = cookieFrom(response);
    assert.deepEqual(await authorizedUser(runtime, new Headers({ cookie })), { email: adminEmail, role: "admin" });
    assert.equal((await accessPost(request("/api/access/confirm", { token }), "confirm", runtime, true)).status, 400);
    const logout = await accessPost(request("/api/access/logout", {}, cookie), "logout", runtime, true);
    assert.equal(logout.status, 200);
    assert.equal(await authorizedUser(runtime, new Headers({ cookie })), null);
  } finally { runtime.db.close(); }
});

test("admin permissions, revocation of all sessions and pending links, and no self-revocation", async () => {
  const { runtime, mails } = await setup();
  try {
    const adminCookie = await login(runtime, mails);
    assert.equal(Object.getPrototypeOf(runtime.access.list()[0]), Object.prototype, "admin data must cross the React server/client boundary");
    const invite = { action: "invite", email: " Viewer@Example.Test " };
    assert.equal((await adminPost(request("/api/admin/access", invite), runtime, false)).status, 401);
    assert.equal((await adminPost(request("/api/admin/access", invite, adminCookie), runtime, false)).status, 200);
    const viewerCookie = await login(runtime, mails, "viewer@example.test");
    assert.equal((await authorizedUser(runtime, new Headers({ cookie: viewerCookie })))?.role, "viewer");
    assert.equal((await adminPost(request("/api/admin/access", { action: "invite", email: "outsider@example.test" }, viewerCookie), runtime, false)).status, 403);
    assert.equal(runtime.access.get("outsider@example.test"), undefined);
    const oldLink = await issue(runtime, mails, "viewer@example.test");
    assert.equal((await adminPost(request("/api/admin/access", { action: "revoke", email: "viewer@example.test" }, adminCookie), runtime, false)).status, 200);
    assert.equal(await authorizedUser(runtime, new Headers({ cookie: viewerCookie })), null);
    runtime.access.invite("viewer@example.test");
    assert.equal((await accessPost(request("/api/access/confirm", { token: oldLink }), "confirm", runtime, true)).status, 400);
    assert.equal((await adminPost(request("/api/admin/access", { action: "revoke", email: adminEmail }, adminCookie), runtime, false)).status, 400);
    assert.equal(runtime.access.get(adminEmail)?.active, 1);
  } finally { runtime.db.close(); }
});

test("expiry, concurrent redemption, forged cookies and verification allowlist hooks", async () => {
  const { runtime, mails } = await setup();
  try {
    const expired = await issue(runtime, mails, adminEmail);
    runtime.db.prepare("UPDATE verification SET expiresAt=?").run(Date.now() - 60_000);
    assert.equal((await accessPost(request("/api/access/confirm", { token: expired }), "confirm", runtime, true)).status, 400);
    const token = await issue(runtime, mails, adminEmail);
    const results = await Promise.all([1, 2].map(() => accessPost(request("/api/access/confirm", { token }), "confirm", runtime, true)));
    assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
    assert.equal(await authorizedUser(runtime, new Headers({ cookie: "waletas.session_token=forged" })), null);
    runtime.access.invite("revoked@example.test");
    const revoked = await issue(runtime, mails, "revoked@example.test");
    // Leave the token in place to test the independent user/session creation hook.
    runtime.db.prepare("UPDATE access_grant SET active=0 WHERE email=?").run("revoked@example.test");
    assert.equal((await accessPost(request("/api/access/confirm", { token: revoked }), "confirm", runtime, true)).status, 400);
  } finally { runtime.db.close(); }
});

test("CSRF, body size, rate limits and missing mail provider fail safely", async () => {
  const { runtime, mails } = await setup();
  try {
    const foreign = request("/api/access/request", { email: adminEmail }, "", "https://other.test");
    assert.equal((await accessPost(foreign, "request", runtime, true)).status, 403);
    const noOrigin = new Request(origin + "/api/access/request", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal((await accessPost(noOrigin, "request", runtime, true)).status, 403);
    assert.equal((await accessPost(request("/api/access/request", { email: "x".repeat(3000) }), "request", runtime, true)).status, 400);
    assert.equal((await accessPost(request("/api/access/request", { email: adminEmail }), "request", runtime, false)).status, 503);
    assert.equal(mails.length, 0);
    const adminCookie = await login(runtime, mails);
    for (const body of [null, [], "text", 42]) {
      assert.equal((await adminPost(request("/api/admin/access", body, adminCookie), runtime, false)).status, 400);
      assert.equal((await accessPost(request("/api/access/request", body), "request", runtime, true)).status, 400);
    }
    mails.length = 0;
    for (let i = 0; i < 3; i++) assert.equal((await accessPost(request("/api/access/request", { email: adminEmail }), "request", runtime, true)).status, 200);
    assert.equal((await accessPost(request("/api/access/request", { email: adminEmail }), "request", runtime, true)).status, 429);
    assert.equal(mails.length, 3);
    assert.equal(normalizeEmail(" Admin@Example.Test "), adminEmail);
    assert.equal(normalizeEmail("x\r\nBcc: other@test.com"), null);
  } finally { runtime.db.close(); }
});

test("SMTP failure does not claim delivery or disclose whether an email is invited", async () => {
  const fixture = await setup(); fixture.runtime.db.close();
  const runtime = await createAccessRuntime({ ...fixture.config, sendMail: async () => { throw new Error("private-smtp-password"); } });
  try {
    const invited = await accessPost(request("/api/access/request", { email: adminEmail }), "request", runtime, true);
    const unknown = await accessPost(request("/api/access/request", { email: "unknown@example.test" }), "request", runtime, true);
    assert.equal(invited.status, 200); assert.equal(await invited.text(), await unknown.text());
  } finally { runtime.db.close(); }
});

test("HTTPS issues Secure HttpOnly cookies and links for the configured origin", async () => {
  const secureOrigin = "https://challenge.example.test"; const mails: AccessMail[] = [];
  const runtime = await createAccessRuntime({ databasePath: ":memory:", baseURL: secureOrigin, adminEmail, secret: randomBytes(32).toString("hex"), sendMail: async mail => { mails.push(mail); } });
  try {
    await runtime.auth.api.signInMagicLink({ headers: new Headers({ origin: secureOrigin }), body: { email: adminEmail } });
    const link = new URL(mails[0].url); assert.equal(link.origin, secureOrigin);
    const token = new URLSearchParams(link.hash.slice(1)).get("token");
    const response = await accessPost(new Request(secureOrigin + "/api/access/confirm", { method: "POST", headers: { origin: secureOrigin, "content-type": "application/json" }, body: JSON.stringify({ token }) }), "confirm", runtime, true);
    assert.equal(response.status, 200); assert.match(response.headers.get("set-cookie")!, /; Secure/i); assert.match(response.headers.get("set-cookie")!, /; HttpOnly/i);
  } finally { runtime.db.close(); }
});

test("access and sessions survive reopening the database, with persistent revocation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "waletas-auth-"));
  let runtime: AccessRuntime | undefined;
  try {
    const fixture = await setup(join(directory, "access.sqlite"));
    runtime = fixture.runtime;
    runtime.access.invite("viewer@example.test");
    const cookie = await login(runtime, fixture.mails, "viewer@example.test");
    runtime.db.close(); runtime = undefined;
    runtime = await createAccessRuntime(fixture.config);
    assert.equal((await authorizedUser(runtime, new Headers({ cookie })))?.email, "viewer@example.test");
    runtime.access.revoke("viewer@example.test");
    runtime.db.close(); runtime = undefined;
    runtime = await createAccessRuntime(fixture.config);
    assert.equal(await authorizedUser(runtime, new Headers({ cookie })), null);
    assert.equal(runtime.access.get("viewer@example.test")?.active, 0);
  } finally {
    runtime?.db.close();
    for (const name of ["access.sqlite", "access.sqlite-wal", "access.sqlite-shm"]) {
      await unlink(join(directory, name)).catch(error => { if (error.code !== "ENOENT") throw error; });
    }
    await rmdir(directory);
  }
});
