import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
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
