/**
 * Consent-gated connection context for chat.
 * Builds peer "derived summaries" + between-design notes from connection rows
 * where the OTHER person's sharing flag is on. No birth data crosses this boundary.
 *
 * Two independent consents govern what a peer contributes:
 *   - baseline share (a_/b_share_baseline) → derived chart summary + between-design.
 *   - history share (a_/b_share_history)   → the peer's OWN earlier chat snippets,
 *     surfaced only for a Sovereign+ account in a relational scope, in server-memory
 *     mode. Neither consent → the peer is invisible this turn; either → the peer is
 *     present, carrying only what they authorized.
 */
import { deriveBaseline } from "./sovereign-prompt";
import { computeHumanDesign, compareDesigns } from "./sovereign-humandesign";
import { loadUser, personName, RelationshipRow } from "./connections";
import { sanitizePeerIdentity } from "./peer-identity";
import type { Baseline } from "./types";
import type { ConsentedPeer, RelationshipScope } from "./sovereign-types";
import type { AppEnv } from "./env";
import { searchChat } from "./chat-embeddings";
import { hydrateMatches, resolveScoreFloor, isSettled } from "./chat-recall";

/** Vectorize candidates fetched per peer, and the snippet cap that reaches the prompt. */
const PEER_RECALL_TOP_K = 4;
const PEER_RECALL_MAX_SNIPPETS = 4;
/** At most two peers' histories are woven into a single turn. */
const PEER_RECALL_MAX_PEERS = 2;

/** Extract { body → longitude } from a stored baseline payload (for HD reuse). */
export function positionsFromBaseline(raw: Record<string, unknown> | undefined): Record<string, { longitude: number }> {
  const astrology = (raw?.astrology as Record<string, unknown> | undefined) ?? {};
  const planets = (astrology.planets as Record<string, Record<string, unknown>> | undefined) ?? {};
  const out: Record<string, { longitude: number }> = {};
  for (const [body, p] of Object.entries(planets)) {
    const lon = p?.longitude;
    if (typeof lon === "number" && Number.isFinite(lon)) out[body] = { longitude: lon };
  }
  return out;
}

function gateCount(hd: ReturnType<typeof computeHumanDesign>): number {
  return hd.gates?.length ?? 0;
}

const EMPTY_DERIVED: ConsentedPeer["derived"] = {
  sunSign: "", moonSign: "", qualities: [],
  humanDesignType: "", humanDesignStrategy: "", humanDesignAuthority: "",
  humanDesignCenters: [], humanDesignChannels: [], geneKeysLabels: [],
};

/**
 * Consent-gated peers for this turn. A peer appears if they shared their
 * baseline OR (history sharing is authorized for this context) their history.
 * Baseline derivations render only under baseline consent; recollections only
 * under history consent. Birth data never crosses; recollections are the peer's
 * own past statements, read from the peer's own namespace via the shared recall
 * primitives (same score floor + 7-day freshness gate as self-recall).
 */
export async function buildConsentedPeers(
  env: AppEnv,
  myId: string,
  myRaw: Record<string, unknown> | undefined,
  opts: { latestUserText?: string; scope: RelationshipScope; canShareHistory: boolean; memoryMode: "server" | "local" },
): Promise<ConsentedPeer[]> {
  const { latestUserText, scope, canShareHistory, memoryMode } = opts;
  const rows = await env.DB.prepare(
    "SELECT id, user_a, user_b, a_label, b_label, a_share_baseline, b_share_baseline, a_share_history, b_share_history, created_at FROM relationships WHERE user_a = ? OR user_b = ?",
  ).bind(myId, myId).all<RelationshipRow>();

  // Peer-history search only fires for a relational inquiry (scope !== self),
  // from a Sovereign+ account, in server-memory mode (Device-Only must never
  // push the query into Vectorize), and only with a non-empty query.
  const historySearchOn =
    canShareHistory && scope !== "self" && memoryMode === "server" && !!latestUserText && latestUserText.trim().length > 0;

  const myHd = computeHumanDesign(positionsFromBaseline(myRaw));
  const peers: ConsentedPeer[] = [];
  const historyCandidates: Array<{ peer: ConsentedPeer; peerId: string }> = [];

  for (const row of rows.results ?? []) {
    const iAmA = row.user_a === myId;
    const peerId = iAmA ? row.user_b : row.user_a;
    const peerSharesBaseline = iAmA ? Number(row.b_share_baseline) === 1 : Number(row.a_share_baseline) === 1;
    const peerSharesHistory =
      historySearchOn && (iAmA ? Number(row.b_share_history) === 1 : Number(row.a_share_history) === 1);

    // Neither consent → this peer contributes nothing to this turn.
    if (!peerSharesBaseline && !peerSharesHistory) continue;

    const [peer, peerBaseline] = await Promise.all([
      loadUser(env, peerId),
      // Baseline data is only needed when the peer shares their baseline.
      peerSharesBaseline
        ? env.DB.prepare("SELECT tob, pob, dob, nasa_jpl_json_data FROM baselines WHERE user_id = ?").bind(peerId).first<Baseline>()
        : Promise.resolve(null as Baseline | null),
    ]);
    if (!peer) continue;

    let derived: ConsentedPeer["derived"] = EMPTY_DERIVED;
    let between: string[] = [];
    let peerHd: ReturnType<typeof computeHumanDesign> | undefined;
    let betweenDesigns: ReturnType<typeof compareDesigns> | undefined;

    // Baseline derivation strictly under baseline consent. No birth data or
    // chart ever crosses for a history-only peer.
    if (peerSharesBaseline && peerBaseline?.nasa_jpl_json_data) {
      let peerRaw: Record<string, unknown> = {};
      try { peerRaw = JSON.parse(peerBaseline.nasa_jpl_json_data) as Record<string, unknown>; } catch { peerRaw = {}; }
      const d = deriveBaseline(peerRaw);
      peerHd = computeHumanDesign(positionsFromBaseline(peerRaw));
      derived = {
        sunSign: d.sunSign,
        moonSign: d.moonSign,
        qualities: d.qualities.slice(0, 4),
        humanDesignType: d.humanDesignType,
        humanDesignStrategy: d.humanDesignStrategy,
        humanDesignAuthority: d.humanDesignAuthority,
        humanDesignCenters: d.humanDesignCenters.slice(0, 6),
        humanDesignChannels: d.humanDesignChannels.slice(0, 5),
        geneKeysLabels: d.geneKeysLabels.slice(0, 4),
      };
      between = gateCount(myHd) && peerHd && gateCount(peerHd)
        ? (betweenDesigns = compareDesigns(myHd, peerHd), betweenDesigns.summary.slice(0, 4))
        : [];
      if (!between.length) {
        between.push("The two designs couldn't be compared (their chart data is unavailable), so only each person's derived qualities are used.");
      }
    }

    const entry: ConsentedPeer = {
      id: peerId,
      // F-G: the peer's display name and the relationship label are peer/owner-
      // authored free text that crosses into ANOTHER user's reasoning prompt.
      // Delimit them at the single point they enter the context so every
      // downstream consumer (signal builders + renderer) receives safe strings.
      name: sanitizePeerIdentity(personName(peer)),
      role: sanitizePeerIdentity(iAmA ? row.a_label : row.b_label, "connection"),
      derived,
      betweenDesign: between,
      // Carry HD data only when baseline is shared, for the deterministic signal engine.
      _hd: peerSharesBaseline && peerHd ? peerHd : undefined,
      _between: peerSharesBaseline ? betweenDesigns : undefined,
    };
    peers.push(entry);

    if (peerSharesHistory) historyCandidates.push({ peer: entry, peerId });
  }

  // Recollection fan-out is capped and best-effort: a Vectorize/D1 hiccup on one
  // peer must never fail the turn or block the others.
  await Promise.all(
    historyCandidates.slice(0, PEER_RECALL_MAX_PEERS).map(async ({ peer, peerId }) => {
      try {
        const matches = await searchChat(env, peerId, latestUserText ?? "", { topK: PEER_RECALL_TOP_K });
        if (matches.length === 0) return;
        const floor = resolveScoreFloor(env);
        // Same floor + same 7-day freshness gate as the user's own recall.
        const settled = matches.filter((m) => m.score >= floor && isSettled(m.indexedAt));
        if (settled.length === 0) return;
        const hydrated = await hydrateMatches(env, peerId, settled);
        const snippets = hydrated
          .filter((h) => h.role === "user" && h.snippet)
          .slice(0, PEER_RECALL_MAX_SNIPPETS)
          .map((h) => h.snippet);
        if (snippets.length > 0) peer.recollections = snippets;
      } catch (err) {
        console.error("[consent] peer recollection failed:", err instanceof Error ? `${err.name}: ${err.message}` : err);
      }
    }),
  );

  return peers;
}
