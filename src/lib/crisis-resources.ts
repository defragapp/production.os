/**
 * Crisis & abuse resources — a fixed, human-reviewed registry.
 *
 * Every contact a user sees in the escalate/grounded safety responses comes
 * from here, with provenance attached. The invariant (ported from the legacy
 * `safety-resources.ts`): a contact is never model-generated. The registry is
 * static, each entry names the official source behind it, and selection says
 * how it was made — this product has no verified connection-country signal,
 * so selection never pretends to know where the user is: the list is
 * jurisdiction-labeled and the unknown-jurisdiction path is always present.
 */

export type CrisisResourcePurpose = "crisis" | "abuse" | "fallback";
export type CrisisResourceProvenance = "official_government" | "official_service" | "curated";

export interface CrisisResource {
  id: string;
  /** Short region label that starts the bullet ("US", "Canada", "UK", "International"). */
  jurisdiction: string;
  /** Exact user-facing bullet, e.g. "- US: … (988lifeline.org)". */
  line: string;
  purpose: CrisisResourcePurpose;
  provenance: CrisisResourceProvenance;
  /** The official source backing this line — never invented. */
  officialSource: string;
  /** Date the entry was last reviewed. Completeness-tested, never recency-tested: the gate must not go red on its own calendar. */
  reviewedOn: string;
}

export interface CrisisResourcesSelection {
  version: "sovereign-crisis-resources.v1";
  /**
   * How this list was chosen. Always "static_registry": no connection-country
   * signal exists in this product, so selection never claims to know the
   * user's location.
   */
  selectionSource: "static_registry";
  /** Honest, user-facing note about how the list works + the unknown-jurisdiction path. */
  selectionNotice: string;
  resources: CrisisResource[];
}

const REVIEWED = "2026-10-09";

/** Single source of truth for every contact line in the safety responses. */
export const CRISIS_RESOURCES: CrisisResource[] = [
  {
    id: "us-988-lifeline",
    jurisdiction: "US",
    line: "- US: National Suicide Prevention Lifeline — call or text 988 (988lifeline.org)",
    purpose: "crisis",
    provenance: "official_government",
    officialSource: "https://988lifeline.org/get-help/",
    reviewedOn: REVIEWED,
  },
  {
    id: "us-crisis-text",
    jurisdiction: "US",
    line: "- US: Crisis Text Line — text HOME to 741741",
    purpose: "crisis",
    provenance: "official_service",
    officialSource: "https://www.crisistextline.org/",
    reviewedOn: REVIEWED,
  },
  {
    id: "ca-988",
    jurisdiction: "Canada",
    line: "- Canada: call or text 988",
    purpose: "crisis",
    provenance: "official_government",
    officialSource: "https://www.canada.ca/en/public-health/services/suicide-prevention.html",
    reviewedOn: REVIEWED,
  },
  {
    id: "uk-samaritans",
    jurisdiction: "UK",
    line: "- UK: Samaritans — call 116 123",
    purpose: "crisis",
    provenance: "official_service",
    officialSource: "https://www.samaritans.org/how-we-can-help/contact-samaritan/",
    reviewedOn: REVIEWED,
  },
  // The unknown-jurisdiction path: the one fallback that is always present.
  {
    id: "intl-findahelpline",
    jurisdiction: "International",
    line: "- International: find help near you at findahelpline.com",
    purpose: "fallback",
    provenance: "curated",
    officialSource: "https://findahelpline.com/",
    reviewedOn: REVIEWED,
  },
  {
    id: "us-dv-hotline",
    jurisdiction: "US",
    line: "- US: National Domestic Violence Hotline — call 800-799-7233 or text START to 88788 (thehotline.org)",
    purpose: "abuse",
    provenance: "official_service",
    officialSource: "https://www.thehotline.org/",
    reviewedOn: REVIEWED,
  },
  {
    id: "ca-crisis-services",
    jurisdiction: "Canada",
    line: "- Canada: Crisis Services Canada — 800-363-9010 (crisisservicescanada.ca)",
    purpose: "abuse",
    provenance: "official_service",
    officialSource: "https://www.crisisservicescanada.ca/",
    reviewedOn: REVIEWED,
  },
  {
    id: "uk-national-da-helpline",
    jurisdiction: "UK",
    line: "- UK: National Domestic Abuse Helpline — 0808 2000 247 (nationaldahelpline.org.uk)",
    purpose: "abuse",
    provenance: "official_service",
    officialSource: "https://www.nationaldahelpline.org.uk/",
    reviewedOn: REVIEWED,
  },
];

/** Per-mode bullet order. Every id must resolve in CRISIS_RESOURCES (tested). */
export const SELECTION_ORDER: Record<"escalate" | "grounded", string[]> = {
  escalate: ["us-988-lifeline", "us-crisis-text", "ca-988", "uk-samaritans", "intl-findahelpline"],
  grounded: ["us-dv-hotline", "ca-crisis-services", "uk-national-da-helpline", "intl-findahelpline"],
};

const NOTICE =
  "These lines are a fixed, human-reviewed list — this space never invents a contact. " +
  "If none of them serves your region, local emergency services can help.";

export function selectCrisisResources(mode: "escalate" | "grounded"): CrisisResourcesSelection {
  const resources = SELECTION_ORDER[mode].map((id) => {
    const entry = CRISIS_RESOURCES.find((r) => r.id === id);
    // A missing id would silently drop a required helpline; fail loudly.
    if (!entry) throw new Error(`crisis registry is missing required entry: ${id}`);
    return entry;
  });
  return {
    version: "sovereign-crisis-resources.v1",
    selectionSource: "static_registry",
    selectionNotice: NOTICE,
    resources,
  };
}