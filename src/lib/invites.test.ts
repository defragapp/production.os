import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isLapsedInvite } from "./invite-status";

describe("isLapsedInvite", () => {
  const peers = new Set(["live@defrag.app"]);

  it("flags an accepted invite whose invitee no longer has a live relationship", () => {
    // Ghost row: the person accepted, then deleted their account (the
    // relationship cascaded away, the owner's invite row did not).
    expect(isLapsedInvite("accepted", "ghost@defrag.app", peers)).toBe(true);
  });

  it("leaves a backed accepted invite alone", () => {
    expect(isLapsedInvite("accepted", "live@defrag.app", peers)).toBe(false);
  });

  it("is case-insensitive on the peer email", () => {
    expect(isLapsedInvite("accepted", "LIVE@defrag.app", new Set(["live@defrag.app"]))).toBe(false);
  });

  it("never flags pending or revoked invites", () => {
    expect(isLapsedInvite("pending", "any@defrag.app", peers)).toBe(false);
    expect(isLapsedInvite("revoked", "any@defrag.app", peers)).toBe(false);
  });
});

describe("account deletion confirmation", () => {
  const account = readFileSync(join(__dirname, "../app/account/page.tsx"), "utf8");

  it("replaces the native confirm with a typed-DELETE in-page dialog", () => {
    // The audit found the first click on the native confirm sometimes produced
    // no dialog; a typed confirmation is unambiguous and can't be dismissed by
    // the browser's "prevent more dialogs" shortcut.
    expect(account).not.toMatch(/window\.confirm\(\s*[\s\S]*?Delete your account/);
    expect(account).toContain('deleteText.trim().toUpperCase() !== "DELETE"');
    expect(account).toContain('role="dialog"');
    expect(account).toContain("Permanently delete");
  });
});

describe("invitation invariants", () => {
  const invitesRoute = readFileSync(join(__dirname, "../app/api/invites/route.ts"), "utf8");
  const acceptRoute = readFileSync(join(__dirname, "../app/api/invites/accept/route.ts"), "utf8");

  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(p));
      else if (entry.name.endsWith(".ts")) out.push(p);
    }
    return out;
  }

  it("acceptance is the only way a relationship is ever created", () => {
    // The owner's consent rule: two baselines meet in a thread only through an
    // accepted invite — no manual entry, no back-door insert anywhere in the API.
    const offenders = walk(join(__dirname, "../app/api")).filter(
      (f) => !f.includes("invites/accept") && readFileSync(f, "utf8").includes("INSERT INTO relationships"),
    );
    expect(offenders).toEqual([]);
  });

  it("creation still requires a valid email and the Sovereign+ tier", () => {
    expect(invitesRoute).toContain("isValidEmail(email)");
    expect(invitesRoute).toContain('code: "plus_required"');
  });

  it("the invitee name is sanitized and stored, never trusted raw", () => {
    expect(invitesRoute).toContain('body.name?.trim().replace(/\\s+/g, " ").slice(0, 80)');
    expect(invitesRoute).toContain("invitee_name");
  });

  it("acceptance binds to the invited email and mints a single-use share link", () => {
    expect(acceptRoute).toContain('code: "email_mismatch"');
    expect(invitesRoute).toContain("${origin}/invite?token=${token}");
  });
});
