import { describe, it, expect } from "vitest";
import { CURRENT_TERMS_VERSION, termsNeedReaccept } from "./terms";

describe("termsNeedReaccept", () => {
  it("is false for a null/undefined stored version (legacy accounts pre-clickwrap)", () => {
    // The login path backfills these silently; the re-acceptance modal must
    // not fire just because a row hasn't been stamped yet.
    expect(termsNeedReaccept(null)).toBe(false);
    expect(termsNeedReaccept(undefined)).toBe(false);
  });

  it("is false when the stored version equals CURRENT_TERMS_VERSION", () => {
    expect(termsNeedReaccept(CURRENT_TERMS_VERSION)).toBe(false);
  });

  it("is true when the stored version is any other string", () => {
    // The material-change case: operator bumped the version after a Terms
    // or Privacy rewrite; every existing account must be re-affirmed.
    expect(termsNeedReaccept("2020-01-01")).toBe(true);
    expect(termsNeedReaccept("2026-09-28")).toBe(true);
    expect(termsNeedReaccept("")).toBe(true);
  });

  it("does not accept a version newer than CURRENT as a no-op", () => {
    // Defensive: if the deployment pipeline shipped an older build after a
    // user had already affirmed a newer version (rollback case), we should
    // ask them to re-affirm for the current build rather than silently
    // trusting the future-dated stamp.
    expect(termsNeedReaccept(CURRENT_TERMS_VERSION + "-future")).toBe(true);
  });
});

describe("CURRENT_TERMS_VERSION format", () => {
  it("is a YYYY-MM-DD string so operators can grep for a specific rewrite", () => {
    expect(CURRENT_TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
