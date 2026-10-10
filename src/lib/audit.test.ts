import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { writeAuditLog, type AuditEntry } from "./audit";
import type { AppEnv } from "./env";

/**
 * Locks #49 — the owner audit log. Three of these are pure source/DDL contract
 * reads (the routes and the fresh-D1 apply can't run under plain vitest), the
 * rest drive `writeAuditLog` through fake env stubs, matching the offline
 * gate-3 pattern used across `advisory-hardening.test.ts` / `security-review.test.ts`.
 */

// The exact DDL that MUST appear byte-identical in BOTH schema.sql and the
// migration — schema.sql is what `seedLocalD1()` applies, the migration is what
// an existing database runs; drift between them is the bug this guards.
const CANONICAL_DDL = `CREATE TABLE IF NOT EXISTS admin_audit_log (
  id                TEXT PRIMARY KEY,
  actor_id          TEXT NOT NULL,
  actor_email_hash  TEXT NOT NULL,
  action            TEXT NOT NULL,
  target_type       TEXT,
  target_id         TEXT,
  metadata          TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON admin_audit_log(actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_log(action, created_at);`;

describe("admin_audit_log DDL — identical in schema.sql and migration 0008 (#49)", () => {
  const schema = readFileSync("schema.sql", "utf8");
  const migration = readFileSync("migrations/0008_admin_audit_log.sql", "utf8");

  it("ships the same CREATE/INDEX block in both files", () => {
    expect(schema).toContain(CANONICAL_DDL);
    expect(migration).toContain(CANONICAL_DDL);
  });

  it("migration carries the house-style local + remote apply commands", () => {
    expect(migration).toMatch(/wrangler d1 execute production-os-db --local/);
    expect(migration).toMatch(/wrangler d1 execute production-os-db --remote/);
  });

  it("has NO column named ip / actor_email / target_email (the three forced divergences)", () => {
    const create = CANONICAL_DDL.slice(0, CANONICAL_DDL.indexOf(");") + 2);
    const cols = [...create.matchAll(/^\s{2}(\w+)\s+/gm)].map((m) => m[1]);
    expect(cols.length).toBeGreaterThan(0);
    for (const forbidden of ["ip", "actor_email", "target_email"]) {
      expect(cols).not.toContain(forbidden);
    }
    // actor_email_hash IS present — the divergence is hash-not-raw, not absence.
    expect(cols).toContain("actor_email_hash");
  });

  it("actor_id carries no FK, so an account hard-delete cannot erase its audit trail", () => {
    // The audit table outlives the actor on purpose; REFERENCES on actor_id
    // would let `account/route.ts`'s ON DELETE CASCADE self-erase the log.
    const actorLine = CANONICAL_DDL.split("\n").find((l) => /^\s+actor_id\s/.test(l)) ?? "";
    expect(actorLine).not.toMatch(/REFERENCES/i);
  });
});

describe("writeAuditLog — fail-silent and hash-not-raw (#49)", () => {
  function capturingStub() {
    const calls: unknown[][] = [];
    const env = {
      DB: {
        prepare: () => ({
          bind: (...args: unknown[]) => {
            calls.push(args);
            return { run: async () => ({}) };
          },
        }),
      },
    } as unknown as AppEnv;
    return { env, calls };
  }

  it("never lets a DB failure escape — an audit write must not break a completed mutation", async () => {
    const env = { DB: { prepare: () => { throw new Error("SQLITE_BUSY"); } } } as unknown as AppEnv;
    const entry: AuditEntry = { actorId: "u1", actorEmail: "owner@example.com", action: "promo.grant_mint" };
    await expect(writeAuditLog(env, entry)).resolves.toBeUndefined();
  });

  it("stores a SHA-256 hex of the actor email, never the raw address", async () => {
    const { env, calls } = capturingStub();
    await writeAuditLog(env, {
      actorId: "u1",
      actorEmail: "Owner@Example.com",
      action: "promo.grant_revoke",
      targetType: "promo_grant",
      targetId: "abc123hash",
    });
    expect(calls).toHaveLength(1);
    const args = calls[0] as string[];
    // No bound value is the raw email in any case form.
    for (const a of args) expect(String(a)).not.toMatch(/owner@example\.com/i);
    // One of them is a 64-char lowercase hex digest.
    expect(args.some((a) => /^[0-9a-f]{64}$/.test(String(a)))).toBe(true);
    // action + target_id are recorded verbatim.
    expect(args).toContain("promo.grant_revoke");
    expect(args).toContain("promo_grant");
    expect(args).toContain("abc123hash");
  });

  it("serialises metadata as JSON and tolerates its absence", async () => {
    const { env, calls } = capturingStub();
    await writeAuditLog(env, { actorId: "u1", actorEmail: "o@e.com", action: "promo.grant_mint", metadata: { durationDays: 30 } });
    const last = calls[0]!.map(String);
    expect(last.some((s) => /"durationDays":30/.test(s))).toBe(true);

    const s2 = capturingStub();
    await writeAuditLog(s2.env, { actorId: "u1", actorEmail: "o@e.com", action: "promo.grant_revoke" });
    expect(s2.calls[0]!.includes(null)).toBe(true); // metadata column NULL when omitted
  });
});

describe("AuditAction coverage — every member is reachable from a real route (#49)", () => {
  const promoRoute = readFileSync("src/app/api/owner/promo/route.ts", "utf8");

  it("both mint and revoke actions are wired into the owner promo route", () => {
    expect(promoRoute).toContain('"promo.grant_mint"');
    expect(promoRoute).toContain('"promo.grant_revoke"');
  });
});
