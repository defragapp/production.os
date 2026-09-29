import { describe, it, expect } from "vitest";
import { computeHumanDesign, compareDesigns, GATE_WHEEL } from "./sovereign-humandesign";
import type { HumanDesignComputation } from "./sovereign-humandesign";
import { buildRelationalSignals, buildSystemSignals } from "./sovereign-signals";
import { buildReasoningContext, buildReasoningPrompt } from "./sovereign-reasoning";
import { deriveBaseline } from "./sovereign-prompt";
import type { ConsentedPeer } from "./sovereign-types";
import type { ChatMessage } from "./types";

/** Longitude at the middle of a gate's span → deterministic gate/line (line 4). */
function longForGate(gate: number): number {
  const idx = GATE_WHEEL.indexOf(gate);
  if (idx === -1) throw new Error(`unknown gate ${gate}`);
  return idx * (360 / 64) + 360 / 128;
}

function hd(positions: Record<string, number>): HumanDesignComputation {
  const shaped: Record<string, { longitude: number }> = {};
  for (const [body, lon] of Object.entries(positions)) shaped[body] = { longitude: lon };
  return computeHumanDesign(shaped);
}

// Self: Sacral (34) + Ego (21) + G (1) → Generator, Sacral authority.
const SELF = hd({ sun: longForGate(34), moon: longForGate(21), mercury: longForGate(1) });
// Peer A: Ego (21) + Throat (45) + Spleen (44, 48) → Manifestor, Splenic-line authority.
const PEER_A = hd({ sun: longForGate(21), moon: longForGate(45), venus: longForGate(44), mars: longForGate(48) });
// Peer B: Head (63) + Ajna (11) + Spleen (44, 48) → Projector, External authority.
const PEER_B = hd({ sun: longForGate(63), moon: longForGate(11), venus: longForGate(44), mars: longForGate(48) });

const BETWEEN_A = compareDesigns(SELF, PEER_A);

function peerFixture(name: string, role: string, peerHd: HumanDesignComputation, selfHd: HumanDesignComputation): ConsentedPeer {
  return {
    id: `user-${name}`,
    name,
    role,
    derived: {
      sunSign: "Leo", moonSign: "Cancer", qualities: ["curiosity"],
      humanDesignType: peerHd.type, humanDesignStrategy: peerHd.strategy,
      humanDesignAuthority: peerHd.authority,
      humanDesignCenters: peerHd.definedCenters, humanDesignChannels: peerHd.definedChannels.map((c) => c.name),
      geneKeysLabels: [],
    },
    betweenDesign: compareDesigns(selfHd, peerHd).summary.slice(0, 4),
    _hd: peerHd,
    _between: compareDesigns(selfHd, peerHd),
  };
}

describe("buildRelationalSignals (Level 3, pair)", () => {
  const signals = buildRelationalSignals("Alex", SELF, "Sam", PEER_A, BETWEEN_A);

  it("is deterministic — same inputs always produce identical signals", () => {
    const again = buildRelationalSignals("Alex", SELF, "Sam", PEER_A, BETWEEN_A);
    expect(JSON.stringify(again)).toBe(JSON.stringify(signals));
  });

  it("stays bounded at 6 signals and tags every one baseline-supported", () => {
    expect(signals.length).toBeLessThanOrEqual(6);
    for (const s of signals) {
      expect(s.epistemicStatus).toBe("baseline-supported");
      expect(s.peers).toEqual(["Alex", "Sam"]);
      expect(s.description.length).toBeGreaterThan(20);
    }
  });

  it("extracts the shared gate as a mutual-understanding bridge", () => {
    const bridge = signals.find((s) => s.category === "shared-bridge");
    expect(bridge).toBeDefined();
    // Gate 21 is carried by both designs → its theme appears in the bridge.
    expect(bridge!.description).toContain("hunter control");
  });

  it("names the pace and authority differences without HD jargon", () => {
    const pace = signals.find((s) => s.category === "pace-difference");
    expect(pace).toBeDefined();
    expect(pace!.description).toMatch(/Alex.*Sam/);
    const gap = signals.find((s) => s.category === "authority-gap");
    expect(gap).toBeDefined();
    expect(gap!.description).toContain("sleep on it");
    // Plain language, not "Sacral" / "Splenic" verdict-speak.
    expect(gap!.description).not.toMatch(/Splenic|Sacral/);
  });

  it("surfaces the joint 21–45 channel as between-the-two activation", () => {
    const activation = signals.filter((s) => s.category === "channel-activation");
    expect(activation.length).toBeGreaterThan(0);
    expect(activation.some((s) => s.description.includes("Money"))).toBe(true);
  });

  it("detects complementary centers in both directions", () => {
    const complement = signals.find((s) => s.category === "center-complement");
    expect(complement).toBeDefined();
    expect(complement!.description).toContain("Alex");
    expect(complement!.description).toContain("Sam");
  });

  it("produces no signals when both designs are empty", () => {
    const empty = hd({});
    const none = buildRelationalSignals("A", empty, "B", empty, compareDesigns(empty, empty));
    expect(none).toEqual([]);
  });
});

describe("buildSystemSignals (Level 4, group)", () => {
  const signals = buildSystemSignals("Alex", SELF, [
    { name: "Sam", hd: PEER_A },
    { name: "Riley", hd: PEER_B },
  ]);

  it("is deterministic and bounded at 8", () => {
    const again = buildSystemSignals("Alex", SELF, [
      { name: "Sam", hd: PEER_A },
      { name: "Riley", hd: PEER_B },
    ]);
    expect(JSON.stringify(again)).toBe(JSON.stringify(signals));
    expect(signals.length).toBeLessThanOrEqual(8);
    for (const s of signals) expect(s.epistemicStatus).toBe("baseline-supported");
  });

  it("reports how much of the nine-center map the group holds", () => {
    const balance = signals.find((s) => s.category === "center-balance");
    expect(balance).toBeDefined();
    expect(balance!.description).toMatch(/of 9 energy centers/);
  });

  it("names the centers nobody in the group naturally holds", () => {
    const unheld = signals.find((s) => s.category === "unheld-center");
    expect(unheld).toBeDefined();
    // Solar Plexus and Root are absent from all three fixtures.
    expect(unheld!.description).toContain("emotional waves");
    expect(unheld!.description).toContain("pressing forward");
  });

  it("distributes roles across the distinct types present", () => {
    const roles = signals.find((s) => s.category === "role-distribution");
    expect(roles).toBeDefined();
    expect(roles!.description).toContain("Generator");
    expect(roles!.description).toContain("Manifestor");
    expect(roles!.description).toContain("Projector");
    // Each person maps to their own type — not everyone to the first name.
    expect(roles!.description).toMatch(/Alex \(Generator/);
    expect(roles!.description).toMatch(/Sam \(Manifestor/);
    expect(roles!.description).toMatch(/Riley \(Projector/);
  });

  it("flags shared pressure where multiple people carry the same center", () => {
    const shared = signals.find((s) => s.category === "shared-pressure");
    expect(shared).toBeDefined();
    // Ego (Alex + Sam) and Spleen (Sam + Riley) are double-held.
    expect(shared!.description).toMatch(/willpower|intuitive instinct/);
  });

  it("detects the peer-to-peer sub-alliance bridge (Sam & Riley share 44 + 48)", () => {
    const bridge = signals.find((s) => s.category === "group-bridge");
    expect(bridge).toBeDefined();
    expect(bridge!.peers).toEqual(["Sam", "Riley"]);
  });

  it("returns nothing actionable for a single-peer group call", () => {
    const solo = buildSystemSignals("Alex", SELF, [{ name: "Sam", hd: PEER_A }]);
    // Center/role/pressure analysis still runs on 2 people, but no peer-bridge exists.
    expect(solo.some((s) => s.category === "group-bridge")).toBe(false);
  });
});

describe("signal engine wired into the reasoning context", () => {
  const BASELINE = deriveBaseline({});

  it("level-3 inquiry with consented peers gets relationalSignals but no systemSignals", () => {
    const history: ChatMessage[] = [
      { role: "user", content: "My partner and I keep circling the same argument about money." },
    ];
    const ctx = buildReasoningContext({
      history,
      baseline: BASELINE,
      myHd: SELF,
      consented: [peerFixture("Sam", "partner", PEER_A, SELF)],
    });
    expect(ctx.level).toBe(3);
    expect(ctx.relationalSignals?.length).toBeGreaterThan(0);
    expect(ctx.systemSignals).toBeUndefined();
  });

  it("level-4 inquiry with 2+ consented peers also gets group signals", () => {
    const history: ChatMessage[] = [
      { role: "user", content: "My whole family reacts differently — my partner and my sister never align." },
    ];
    const ctx = buildReasoningContext({
      history,
      baseline: BASELINE,
      myHd: SELF,
      consented: [
        peerFixture("Sam", "partner", PEER_A, SELF),
        peerFixture("Riley", "sister", PEER_B, SELF),
      ],
    });
    expect(ctx.level).toBe(4);
    expect(ctx.relationalSignals && ctx.relationalSignals.length > 0).toBe(true);
    expect(ctx.systemSignals && ctx.systemSignals.length > 0).toBe(true);
  });

  it("skips signal computation below level 3 or without myHd", () => {
    const history: ChatMessage[] = [{ role: "user", content: "Why do I always feel rushed on Sunday nights?" }];
    const ctx = buildReasoningContext({
      history,
      baseline: BASELINE,
      myHd: SELF,
      consented: [peerFixture("Sam", "partner", PEER_A, SELF)],
    });
    expect(ctx.level).toBe(1);
    expect(ctx.relationalSignals).toBeUndefined();

    const noHd = buildReasoningContext({
      history: [{ role: "user", content: "My partner and I keep circling the same argument." }],
      baseline: BASELINE,
      consented: [peerFixture("Sam", "partner", PEER_A, SELF)],
    });
    expect(noHd.relationalSignals).toBeUndefined();
  });

  it("renders the deterministic signals into the model prompt with guardrails", () => {
    const history: ChatMessage[] = [
      { role: "user", content: "My partner and I keep circling the same argument about money." },
    ];
    const ctx = buildReasoningContext({
      history,
      baseline: BASELINE,
      myHd: SELF,
      consented: [peerFixture("Sam", "partner", PEER_A, SELF)],
    });
    const messages = buildReasoningPrompt(ctx, history, BASELINE);
    const system = messages[0].content;
    expect(system).toContain("DETERMINISTIC RELATIONAL SIGNALS");
    expect(system).toContain("context, not verdict");
    expect(system).toContain("[shared-bridge]");
    // No raw coordinates may ever leak into the rendered prompt.
    expect(system).not.toMatch(/longitude/i);
  });
});
