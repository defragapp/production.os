import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The unified /api/auth POST historically treated every submit as signup:
 * signing in with an unknown (or just-deleted) email silently provisioned a
 * new account. Explicit sign-in must fail instead, so the request carries an
 * intent and the route refuses login for unknown emails. Pinned at source
 * level because the route's Next/D1 bindings are not unit-mockable here.
 */
const authRoute = readFileSync(join(__dirname, "../app/api/auth/route.ts"), "utf8");
const onboard = readFileSync(join(__dirname, "../app/onboard/onboard-content.tsx"), "utf8");

describe("login intent", () => {
  it("rejects login for an unknown email instead of creating an account", () => {
    expect(authRoute).toMatch(/if \(!existing && body\.intent === "login"\)/);
    expect(authRoute).toContain("No account found for this email");
  });

  it("keeps the signup path able to authenticate existing users (best-effort union)", () => {
    // Signup with a known email must still verify the password and sign in —
    // the pre-existing contract the invite flow relies on.
    expect(authRoute).toMatch(/if \(existing\)[\s\S]*?verifyPassword/);
  });

  it("the onboard form sends the intent the server branches on", () => {
    expect(onboard).toContain('intent: isLogin ? "login" : "signup"');
  });
});
