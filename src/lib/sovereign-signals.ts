/**
 * Deterministic Relational & Group Signal Engine (Levels 3 & 4).
 *
 * Transforms raw Human Design comparison data into structured, plain-language
 * relational signals the reasoning layer feeds to the model as deterministic
 * evidence. The model uses these as grounded context rather than improvising
 * from raw gate numbers.
 *
 * All functions are pure — no I/O, no D1, no env. They operate on the
 * already-computed `BetweenDesigns` + `HumanDesignComputation` shapes.
 *
 * Design principles:
 *  - Non-jargon descriptions: the signals read as relational mechanics a person
 *    can understand, not as "your gate 23–43 channel contacts their root."
 *  - Deterministic: same Baselines always produce the same signals.
 *  - Epistemically honest: every signal is `baseline-supported`, never `observed`
 *    (the user hasn't confirmed it in conversation) and never `interpretive`.
 *  - Bounded: max 6 relational signals per pair; max 8 per group.
 */

import type { HumanDesignComputation, BetweenDesigns } from "./sovereign-humandesign";
import type { RelationalSignal, SystemSignal } from "./sovereign-types";

// ── Human-readable labels for centers (no HD jargon) ───────────────────

const CENTER_MEANING: Record<string, string> = {
  Head: "generating questions and mental pressure",
  Ajna: "making sense of information and forming opinions",
  Throat: "getting things out into the world — speaking, manifesting",
  G: "sense of identity, direction, and self-expression",
  Ego: "willpower, material drive, and self-valuation",
  "Solar Plexus": "emotional waves, desire, and want",
  Sacral: "life-force energy, response, and generative stamina",
  Spleen: "intuitive instinct, timing, and letting go",
  Root: "pressing forward, dealing with limits, and finding freedom through action",
};

// Motor centers produce consistent energy output.
const MOTOR_CENTERS = new Set(["Sacral", "Ego", "Solar Plexus", "Root"]);

// ── Pair-level (Level 3) ───────────────────────────────────────────────

/**
 * Build deterministic relational signals for a dyadic inquiry (Level 3).
 * Called when the user asks about ONE consented peer.
 */
export function buildRelationalSignals(
  selfName: string,
  selfHd: HumanDesignComputation,
  peerName: string,
  peerHd: HumanDesignComputation,
  between: BetweenDesigns,
): RelationalSignal[] {
  const signals: RelationalSignal[] = [];

  // 1. Shared bridges: gates both carry → mutual understanding anchors.
  if (between.sharedGates.length > 0) {
    const themes = between.sharedGates.slice(0, 3).map((s) => s.theme);
    signals.push({
      category: "shared-bridge",
      peers: [selfName, peerName],
      description: `You both carry the same underlying quality around ${themes.join(" and ")}. This creates a natural understanding point — a place where you don't have to explain yourself to each other.`,
      epistemicStatus: "baseline-supported",
    });
  }

  // 2. Pace difference: HD type determines a fundamentally different decision rhythm.
  if (selfHd.type !== peerHd.type) {
    const selfPace = describePace(selfHd);
    const peerPace = describePace(peerHd);
    signals.push({
      category: "pace-difference",
      peers: [selfName, peerName],
      description: `${selfName} tends to move through decisions by ${selfPace}, while ${peerName} tends toward ${peerPace}. This isn't a right/wrong gap — it shapes how each person needs to be met in a conversation.`,
      epistemicStatus: "baseline-supported",
    });
  }

  // 3. Authority gap: decision-making reference point differs.
  if (selfHd.authority !== peerHd.authority) {
    signals.push({
      category: "authority-gap",
      peers: [selfName, peerName],
      description: `When it comes to knowing what's true for them, ${selfName} references ${describeAuthorityPlain(selfHd.authority)}, while ${peerName} references ${describeAuthorityPlain(peerHd.authority)}. In practice, one person may need to sleep on it while the other already knows in their body — neither is wrong.`,
      epistemicStatus: "baseline-supported",
    });
  }

  // 4. Joint channels: what gets "activated between you" when both designs contribute.
  if (between.jointChannels.length > 0) {
    const topChannels = between.jointChannels.slice(0, 2);
    for (const ch of topChannels) {
      signals.push({
        category: "channel-activation",
        peers: [selfName, peerName],
        description: `Your combined designs activate the "${ch.name}" circuit — a shared channel where pressure between the two of you naturally produces a specific kind of output or understanding. It's something that exists in the BETWEEN, not in either person alone.`,
        epistemicStatus: "baseline-supported",
      });
    }
  }

  // 5. Complementary centers: one has what the other lacks, creating natural division of labor.
  const selfCenters = new Set(selfHd.definedCenters);
  const peerCenters = new Set(peerHd.definedCenters);
  const complementSelf = [...peerCenters].filter((c) => !selfCenters.has(c));
  const complementPeer = [...selfCenters].filter((c) => !peerCenters.has(c));
  if (complementSelf.length > 0 && complementPeer.length > 0) {
    const desc = `${selfName} naturally processes ${complementSelf.slice(0, 2).map((c) => CENTER_MEANING[c] ?? c).join(", and ")}, while ${peerName} naturally handles ${complementPeer.slice(0, 2).map((c) => CENTER_MEANING[c] ?? c).join(", and ")}. This can create ease (each fills the other's blind spot) or tension (each assumes the other has it covered).`;
    signals.push({
      category: "center-complement",
      peers: [selfName, peerName],
      description: desc,
      epistemicStatus: "baseline-supported",
    });
  }

  // 6. Friction/ease from motor mismatch: when one has Sacral and the other doesn't.
  const selfHasMotor = selfHd.definedCenters.some((c) => MOTOR_CENTERS.has(c));
  const peerHasMotor = peerHd.definedCenters.some((c) => MOTOR_CENTERS.has(c));
  if (selfHasMotor && !peerHasMotor) {
    signals.push({
      category: "friction-point",
      peers: [selfName, peerName],
      description: `${selfName} carries consistent life-force energy in their design (they can generate and push through). ${peerName} doesn't have that same consistent motor — they need more rest, more spacing, or more external rhythm. This difference in energy availability is a common source of misunderstanding if neither knows it's structural, not personal.`,
      epistemicStatus: "baseline-supported",
    });
  } else if (peerHasMotor && !selfHasMotor) {
    signals.push({
      category: "friction-point",
      peers: [selfName, peerName],
      description: `${peerName} carries a consistent motor center — they have reliable life-force to generate. ${selfName} doesn't operate from the same consistent energy base. In a pair, this can look like one person always pushing to do more and the other needing more time.`,
      epistemicStatus: "baseline-supported",
    });
  }

  return signals.slice(0, 6);
}

// ── Group-level (Level 4) ──────────────────────────────────────────────

/**
 * Build deterministic system/group signals when 2+ consented peers are present
 * and the inquiry is classified Level 4 (System).
 */
export function buildSystemSignals(
  selfName: string,
  selfHd: HumanDesignComputation,
  peers: Array<{ name: string; hd: HumanDesignComputation }>,
): SystemSignal[] {
  const signals: SystemSignal[] = [];
  const allNames = [selfName, ...peers.map((p) => p.name)];
  const allHds = [selfHd, ...peers.map((p) => p.hd)];

  // 1. Center coverage: which of the 9 centers are held by at least one person.
  const allDefinedCenters = new Set<string>();
  for (const hd of allHds) {
    for (const c of hd.definedCenters) allDefinedCenters.add(c);
  }
  const ALL_CENTERS = Object.keys(CENTER_MEANING);
  const uncovered = ALL_CENTERS.filter((c) => !allDefinedCenters.has(c));

  if (allDefinedCenters.size >= 3) {
    signals.push({
      category: "center-balance",
      peers: allNames,
      description: `Between ${allNames.length} people, the group naturally holds ${allDefinedCenters.size} of 9 energy centers — including ${[...allDefinedCenters].slice(0, 4).map((c) => CENTER_MEANING[c] ?? c).join(", ")}. This means the group can handle these kinds of experiences without needing one person to do it all.`,
      epistemicStatus: "baseline-supported",
    });
  }

  // 2. Unheld centers: what nobody in the group naturally processes.
  if (uncovered.length > 0 && uncovered.length <= 4) {
    signals.push({
      category: "unheld-center",
      peers: allNames,
      description: `Nobody in this group's design naturally holds ${uncovered.map((c) => CENTER_MEANING[c] ?? c).join(", and ")}. In practice, this means these kinds of experiences either go unprocessed or land on whoever is most stressed — the group tends to avoid or externalize these areas rather than having a natural home for them.`,
      epistemicStatus: "baseline-supported",
    });
  }

  // 3. Role distribution: types present and what strategies coexist.
  const typesPresent = new Map<string, string[]>();
  allHds.forEach((hd, i) => {
    const existing = typesPresent.get(hd.type) ?? [];
    existing.push(allNames[i]);
    typesPresent.set(hd.type, existing);
  });
  if (typesPresent.size >= 2) {
    const typeList = [...typesPresent.entries()].map(([t, names]) =>
      `${names.join(", ")} (${t}, ${t === "Generator" || t === "Manifesting Generator" ? "responds to what shows up" : t === "Projector" ? "waits for invitation" : t === "Manifestor" ? "initiates and informs" : "rides others' energy"})`,
    );
    signals.push({
      category: "role-distribution",
      peers: allNames,
      description: `This group contains different interaction styles: ${typeList.join("; ")}. Confusion often comes not from conflict but from different people waiting for different kinds of signal before they act.`,
      epistemicStatus: "baseline-supported",
    });
  }

  // 4. Shared pressure: centers where MULTIPLE people carry a gate (amplification).
  const centerCounts = new Map<string, number>();
  for (const hd of allHds) {
    for (const c of new Set(hd.definedCenters)) {
      centerCounts.set(c, (centerCounts.get(c) ?? 0) + 1);
    }
  }
  const shared = [...centerCounts.entries()].filter(([, n]) => n >= 2);
  if (shared.length > 0) {
    const names = shared.map(([c]) => CENTER_MEANING[c] ?? c);
    signals.push({
      category: "shared-pressure",
      peers: allNames,
      description: `Multiple people in this group carry energy around ${names.slice(0, 3).join(", and ")}. This amplifies those themes in the group dynamic — they get more attention and can feel louder than they would individually. When more than one person processes the same kind of experience, the group tends to organize around it.`,
      epistemicStatus: "baseline-supported",
    });
  }

  // 5. Group bridges: pairwise shared gates that create sub-alliances.
  if (peers.length >= 2) {
    // Find any peer-to-peer shared gates (excluding self) that form sub-links.
    let bridgeFound = false;
    for (let i = 0; i < peers.length && !bridgeFound; i++) {
      for (let j = i + 1; j < peers.length && !bridgeFound; j++) {
        const gatesI = new Set(peers[i].hd.gates.map((g) => g.gate));
        const sharedIJ = peers[j].hd.gates.filter((g) => gatesI.has(g.gate));
        if (sharedIJ.length >= 2) {
          signals.push({
            category: "group-bridge",
            peers: [peers[i].name, peers[j].name],
            description: `${peers[i].name} and ${peers[j].name} carry overlapping qualities (specifically around ${sharedIJ.slice(0, 2).map((g) => g.theme).join(" and ")}). This creates a natural sub-alliance or understanding channel inside the group that the others may not have access to.`,
            epistemicStatus: "baseline-supported",
          });
          bridgeFound = true;
        }
      }
    }
  }

  return signals.slice(0, 8);
}

// ── Helpers ────────────────────────────────────────────────────────────

function describePace(hd: HumanDesignComputation): string {
  if (hd.type === "Generator" || hd.type === "Manifesting Generator") {
    return "responding to what's actually in front of them — energy comes from engagement, not from pushing";
  }
  if (hd.type === "Projector") {
    return "taking time to read the field and wait for a genuine invitation before committing";
  }
  if (hd.type === "Manifestor") {
    return "initiating from internal pressure and needing to inform others before acting";
  }
  return "mirroring the surrounding energy and needing significant time to know what feels true";
}

function describeAuthorityPlain(authority: string): string {
  if (authority.startsWith("Sacral")) return "a gut yes/no in real time";
  if (authority.startsWith("Emotional")) return "an emotional wave that needs time to ride out before clarity arrives";
  if (authority.startsWith("Splenic")) return "an instantaneous instinct that doesn't repeat";
  if (authority.startsWith("Ego")) return "a body-level drive or want — 'do I want to commit to this?'";
  if (authority.startsWith("Self-Projected")) return "a sense of identity-direction that others confirm back";
  if (authority.startsWith("External")) return "no single defined inner reference — they need to hear their own thinking spoken aloud";
  if (authority.startsWith("Lunar")) return "the moods and energy of the people around them over time";
  return authority.toLowerCase();
}
