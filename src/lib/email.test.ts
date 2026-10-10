import { describe, it, expect, vi, afterEach } from "vitest";
import { sendTemplate } from "./email";
import type { AppEnv } from "./env";

// The webhook route (src/app/api/webhooks/stripe/route.ts) is the only real
// producer of these three templates in production. These tests pin what it
// sends — subject, sender, and rendered body variables — so a template edit
// that drops the amount, the retry nudge, or the resubscribe CTA fails here
// instead of silently degrading the paying customer's email.
const env = {
  RESEND_API_KEY: "re_test",
  FROM_EMAIL: "sovereign@defrag.app",
} as unknown as AppEnv;

const ORIGINAL_FETCH = global.fetch;
afterEach(() => { global.fetch = ORIGINAL_FETCH; });

function mockResendOk() {
  global.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ id: "email_test_1" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  ) as unknown as typeof fetch;
}
const resendBody = () => JSON.parse(String((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body));

describe("sendTemplate — payment-received (receipt, fired by invoice.paid / payment_succeeded)", () => {
  it("renders amount, date, and next billing date into the body and sends the pinned subject", async () => {
    mockResendOk();
    const ok = await sendTemplate(env, "payment-received", "payer@example.com", {
      origin: "https://sovereign.defrag.app", amount: "20.00", date: "October 6, 2026", next: "November 6, 2026",
    });
    expect(ok).toBe(true);
    const body = resendBody();
    expect(body.subject).toBe("Your payment was received");
    expect(body.from).toBe("Sovereign OS <sovereign@defrag.app>");
    expect(body.to).toEqual(["payer@example.com"]);
    expect(body.html).toContain("$20.00");
    expect(body.html).toContain("October 6, 2026");
    expect(body.html).toContain("November 6, 2026");
    expect(body.html).toContain("https://sovereign.defrag.app/account?tab=billing");
  });

  it("falls back to the generic confirmation line when no amount vars are passed", async () => {
    mockResendOk();
    await sendTemplate(env, "payment-received", "payer@example.com", { origin: "https://sovereign.defrag.app" });
    const html = resendBody().html as string;
    expect(html).toContain("Your Sovereign+ payment is confirmed");
    expect(html).not.toContain("$");
  });
});

describe("sendTemplate — payment-failed (dunning, fired by invoice.payment_failed / action_required)", () => {
  it("names the attempt number on retries and offers the payment-method CTA", async () => {
    mockResendOk();
    const ok = await sendTemplate(env, "payment-failed", "payer@example.com", {
      origin: "https://sovereign.defrag.app", attempt: 3,
    });
    expect(ok).toBe(true);
    const body = resendBody();
    expect(body.subject).toBe("We couldn't process your payment");
    expect(body.html).toContain("(attempt 3)");
    expect(body.html).toContain("https://sovereign.defrag.app/account?tab=billing");
    expect(body.html).toContain("Update payment method");
  });

  it("omits the attempt clause on the first failure", async () => {
    mockResendOk();
    await sendTemplate(env, "payment-failed", "payer@example.com", {
      origin: "https://sovereign.defrag.app", attempt: 1,
    });
    expect(resendBody().html).not.toContain("attempt 1");
  });
});

describe("sendTemplate — subscription-canceled", () => {
  it("reassures data safety and points the resubscribe CTA at /upgrade", async () => {
    mockResendOk();
    const ok = await sendTemplate(env, "subscription-canceled", "payer@example.com", {
      origin: "https://sovereign.defrag.app",
    });
    expect(ok).toBe(true);
    const body = resendBody();
    expect(body.subject).toBe("Your Sovereign+ subscription has ended");
    expect(body.html).toContain("Your data is safe");
    expect(body.html).toContain("https://sovereign.defrag.app/upgrade");
    expect(body.html).toContain("Resubscribe");
  });
});

describe("sendTemplate — delivery outcomes", () => {
  it("returns false when Resend rejects the send (callers must not fake success)", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "domain not verified" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      }),
    ) as unknown as typeof fetch;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ok = await sendTemplate(env, "payment-received", "payer@example.com", { origin: "https://sovereign.defrag.app" });
    expect(ok).toBe(false);
    spy.mockRestore();
  });

  it("runs in log-only mode when RESEND_API_KEY is unset, without any network call", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const ok = await sendTemplate({} as AppEnv, "payment-received", "payer@example.com", { origin: "https://x" });
    expect(ok).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(logSpy.mock.calls.map((c) => String(c[0])).join("\n")).toContain("Your payment was received");
    logSpy.mockRestore();
  });
});

// Client-robustness invariants. Every template shares one shell, so a shell that
// relies on CSS alone breaks silently in the clients that ignore it: Outlook
// drops CSS `background` on <body> (cream text lands on white), and Gmail/Outlook
// dark mode re-colours an email that never declared its scheme. A plain-text part
// and a preheader are table stakes for deliverability and inbox legibility.
describe("emailShell — client robustness invariants", () => {
  it("declares bgcolor attributes so Outlook/legacy clients keep the dark surface", async () => {
    mockResendOk();
    await sendTemplate(env, "welcome", "new@example.com", { origin: "https://sovereign.defrag.app" });
    const html = resendBody().html as string;
    expect(html).toMatch(/<body[^>]*bgcolor="#0c0b09"/i);
    expect(html).toMatch(/<table[^>]*bgcolor="#141110"/i);
  });

  it("declares the colour scheme so dark-mode clients do not re-invert the palette", async () => {
    mockResendOk();
    await sendTemplate(env, "welcome", "new@example.com", { origin: "https://sovereign.defrag.app" });
    const html = resendBody().html as string;
    expect(html).toMatch(/name=["']color-scheme["'][^>]*content=["']dark light["']/i);
    expect(html).toMatch(/supported-color-schemes/i);
  });

  it("carries a hidden preheader so the inbox preview line is copy, not footer text", async () => {
    mockResendOk();
    await sendTemplate(env, "payment-failed", "payer@example.com", { origin: "https://sovereign.defrag.app", attempt: 1 });
    const html = resendBody().html as string;
    expect(html).toMatch(/display:none[^>]*>[^<]{10,}/i);
  });
});

describe("sendTemplate — plain-text alternative", () => {
  it("sends a text part derived from the rendered body, so no client sees a blank mail", async () => {
    mockResendOk();
    await sendTemplate(env, "payment-received", "payer@example.com", {
      origin: "https://sovereign.defrag.app", amount: "20.00", date: "October 6, 2026", next: "November 6, 2026",
    });
    const body = resendBody();
    expect(typeof body.text).toBe("string");
    expect((body.text as string).length).toBeGreaterThan(40);
    expect(body.text).toContain("$20.00");
    expect(body.text).toContain("November 6, 2026");
    // The converter must not leak markup or leave the wordmark glued together.
    expect(body.text).not.toContain("<");
    expect(body.text).not.toContain("&nbsp;");
    expect(body.text).toContain("https://sovereign.defrag.app/account?tab=billing");
  });

  // The support form is public, so its plain-text mirror of an escaped payload must
  // not replay live tag syntax. Same words, defused shape (mirrors gate F-D).
  it("defuses tag-shaped input from the public support form", async () => {
    mockResendOk();
    await sendTemplate(env, "support-notification", "ops@example.com", {
      name: "Eve <script>alert(1)</script>",
      email: "eve@evil.com",
      topic: 'Billing <a href="https://evil.example">click here</a>',
      message: "<img src=x onerror=alert(1)>\n<b>bold</b>",
    });
    const { text } = resendBody();
    expect(text).not.toContain("<script>alert(1)</script>");
    expect(text).not.toContain("<img src=x onerror=alert(1)>");
    expect(text).not.toContain('<a href="https://evil.example">click here</a>');
    expect(text).toContain("[script]alert(1)[/script]");
    expect(text).toContain("eve@evil.com");
  });
});

describe("removed templates — dead and misleading copy is gone, not dormant", () => {
  // billing-success duplicated payment-received with no call site; trial-ending
  // advertised a free trial the product does not have (no scheduler, no call site).
  it.each(["billing-success", "trial-ending"])("%s is no longer a renderable template", async (name) => {
    mockResendOk();
    await expect(sendTemplate(env, name as never, "x@example.com", {} as never)).rejects.toThrow(/Unknown email template/);
  });
});

describe("sendTemplate — receipt names the plan it is for", () => {
  it("shows a structured Sovereign+ summary rather than prose alone", async () => {
    mockResendOk();
    await sendTemplate(env, "payment-received", "payer@example.com", {
      origin: "https://sovereign.defrag.app", amount: "20.00", date: "October 6, 2026", next: "November 6, 2026", interval: "monthly",
    });
    const html = resendBody().html as string;
    expect(html).toContain("Sovereign+");
    expect(html).toContain("Monthly");
  });
});
