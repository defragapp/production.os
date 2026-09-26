import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regression pins for the audit's P0/P1 blockers (React #418 family):
 * pages that branch on URL search params must render a neutral first paint,
 * because SSR cannot see the query string and a text mismatch between the
 * server HTML and the first client render invalidates interactivity —
 * which made the Sign In form and the invite "Accept & connect" button inert.
 */
const onboard = readFileSync(join(__dirname, "../app/onboard/onboard-content.tsx"), "utf8");
const invite = readFileSync(join(__dirname, "../app/invite/page.tsx"), "utf8");

describe("onboard hydration safety", () => {
  it("gates mode/reset branching behind a mounted flag, not raw search params", () => {
    expect(onboard).toContain("const [mounted, setMounted] = useState(false);");
    expect(onboard).toContain("const isLogin = mounted && mode === \"login\";");
    // The reset screen branch must not fire during the SSR-matching render.
    expect(onboard).toMatch(/if \(!mounted\)[\s\S]*?if \(resetToken\)/);
  });

  it("carries the ?invite= token through signup and into the accept flow", () => {
    expect(onboard).toContain("searchParams.get(\"invite\")");
    // After account creation and after the baseline is saved, the token wins.
    const inviteRoutes = onboard.match(/\/invite\?token=/g) ?? [];
    expect(inviteRoutes.length).toBeGreaterThanOrEqual(4);
  });

  it("surfaces consent errors inline instead of via a native required bubble", () => {
    const consentBlock = onboard.match(/id="consent"[\s\S]*?\/>/)?.[0] ?? "";
    expect(consentBlock).not.toContain("required");
    expect(onboard).toContain("Please agree to the Terms and Privacy Policy to continue.");
  });
});

describe("invite page hydration safety", () => {
  it("renders a neutral loading state until the client reads the token", () => {
    // `undefined` = not yet read; only a client-confirmed empty token may show
    // the "link got cut off" error, so SSR and the first paint always match.
    expect(invite).toContain("useState<string | null | undefined>(undefined)");
    expect(invite).toContain("token === undefined");
    expect(invite).toContain("token === null");
  });
});

describe("unauthenticated redirects", () => {
  it("send people to the login form, not account creation", () => {
    for (const file of ["settings", "account", "chat", "upgrade"]) {
      const dir = file === "chat" ? "chat/chat-client" : `${file}/page`;
      const src = readFileSync(join(__dirname, `../app/${dir}.tsx`), "utf8");
      const bare = src.match(/router\.push\("\/onboard"\)/g) ?? [];
      expect(bare, `bare /onboard pushes in ${file}`).toHaveLength(0);
    }
  });
});
