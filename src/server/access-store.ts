import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export type AccessGrant = { email: string; role: "admin" | "viewer"; active: number; invitedAt: string; revokedAt: string | null };
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export class AccessStore {
  constructor(readonly db: DatabaseSync, adminEmail: string) {
    db.exec(`CREATE TABLE IF NOT EXISTS access_grant (
      email TEXT PRIMARY KEY, role TEXT NOT NULL CHECK(role IN ('admin','viewer')),
      active INTEGER NOT NULL, invitedAt TEXT NOT NULL, revokedAt TEXT
    ); CREATE TABLE IF NOT EXISTS access_limit (
      key TEXT PRIMARY KEY, count INTEGER NOT NULL, expiresAt INTEGER NOT NULL
    );`);
    const email = normalizeEmail(adminEmail);
    if (!email) throw new Error("Configura ADMIN_EMAIL con un correo válido.");
    const existing = db.prepare("SELECT email FROM access_grant WHERE role='admin'").get();
    if (existing && existing.email !== email) throw new Error("ADMIN_EMAIL no coincide con el administrador guardado.");
    db.prepare("INSERT OR IGNORE INTO access_grant VALUES (?, 'admin', 1, ?, NULL)").run(email, new Date().toISOString());
  }
  get(email: string) {
    return this.db.prepare("SELECT * FROM access_grant WHERE email=?").get(email.toLowerCase()) as AccessGrant | undefined;
  }
  list() {
    // node:sqlite returns null-prototype records; React Server Components need plain objects.
    return this.db.prepare("SELECT * FROM access_grant ORDER BY role ASC, invitedAt DESC").all().map(row => ({ ...row })) as AccessGrant[];
  }
  invite(email: string) {
    if (this.get(email)?.role === "admin") return;
    this.db.prepare(`INSERT INTO access_grant VALUES (?, 'viewer', 1, ?, NULL)
      ON CONFLICT(email) DO UPDATE SET active=1, revokedAt=NULL, invitedAt=excluded.invitedAt`).run(email, new Date().toISOString());
  }
  revoke(email: string) {
    if (this.get(email)?.role === "admin") throw new Error("No puedes revocar la cuenta administradora.");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("UPDATE access_grant SET active=0, revokedAt=? WHERE email=?").run(new Date().toISOString(), email);
      this.db.prepare('DELETE FROM session WHERE userId IN (SELECT id FROM user WHERE email=?)').run(email);
      // Remove outstanding links as well: re-inviting must not revive an old link.
      this.db.prepare("DELETE FROM verification WHERE json_valid(value) AND json_extract(value, '$.email')=?").run(email);
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  allow(key: string, max: number, windowMs: number, now = Date.now()) {
    const hash = createHash("sha256").update(key).digest("hex");
    this.db.prepare("DELETE FROM access_limit WHERE expiresAt<=?").run(now);
    const row = this.db.prepare(`INSERT INTO access_limit VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count`).get(hash, now + windowMs);
    return Number(row?.count) <= max;
  }
}
