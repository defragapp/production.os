/**
 * Consent-gated connection context for chat.
 * Builds peer "derived summaries" + between-design notes from connection rows
 * where the OTHER person's sharing flag is on. No birth data crosses this boundary.
 */
import { deriveBaseline } from "./sovereign-prompt";
import { computeHumanDesign, compareDesigns } from "./sovereign-humandesign";
import { loadUser, personName, RelationshipRow } from "./connections";
import type { Baseline } from "./types";
import type { ConsentedPeer } from "./sovereign-types";

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

/**
 * All currently-consented peers: relationship rows in which the other person
 * has their sharing flag ON. Returns name + role + a derived summary of their
 * baseline plus between-design notes against the current user's own chart.
 */
export async function buildConsentedPeers(
  env: { DB: D1Database },
  myId: string,
  myRaw: Record<string, unknown> | undefined,
): Promise<ConsentedPeer[]> {
  const rows = await env.DB.prepare(
    "SELECT id, user_a, user_b, a_label, b_label, a_share_baseline, b_share_baseline, created_at FROM relationships WHERE user_a = ? OR user_b = ?",
  ).bind(myId, myId).all<RelationshipRow>();

  const peers: ConsentedPeer[] = [];
  for (const row of rows.results ?? []) {
    const iAmA = row.user_a === myId;
    const peerConsents = iAmA ? Number(row.b_share_baseline) === 1 : Number(row.a_share_baseline) === 1;
    if (!peerConsents) continue;

    const peerId = iAmA ? row.user_b : row.user_a;
    const [peer, peerBaseline] = await Promise.all([
      loadUser(env, peerId),
      env.DB.prepare("SELECT tob, pob, dob, nasa_jpl_json_data FROM baselines WHERE user_id = ?").bind(peerId).first<Baseline>(),
    ]);
    if (!peer || !peerBaseline?.nasa_jpl_json_data) continue;

    let peerRaw: Record<string, unknown> = {};
    try { peerRaw = JSON.parse(peerBaseline.nasa_jpl_json_data) as Record<string, unknown>; } catch { peerRaw = {}; }
    const derived = deriveBaseline(peerRaw);

    const myHd = computeHumanDesign(positionsFromBaseline(myRaw));
    const peerHd = computeHumanDesign(positionsFromBaseline(peerRaw));
    const between = gateCount(myHd) && gateCount(peerHd)
      ? compareDesigns(myHd, peerHd).summary.slice(0, 4)
      : [];
    if (!between.length) {
      between.push("The two designs couldn't be compared (their chart data is unavailable), so only each person's derived qualities are used.");
    }

    peers.push({
      id: peerId,
      name: personName(peer),
      role: iAmA ? row.a_label : row.b_label,
      derived: {
        sunSign: derived.sunSign,
        moonSign: derived.moonSign,
        qualities: derived.qualities.slice(0, 4),
        humanDesignType: derived.humanDesignType,
        humanDesignStrategy: derived.humanDesignStrategy,
        humanDesignAuthority: derived.humanDesignAuthority,
        humanDesignCenters: derived.humanDesignCenters.slice(0, 6),
        humanDesignChannels: derived.humanDesignChannels.slice(0, 5),
        geneKeysLabels: derived.geneKeysLabels.slice(0, 4),
      },
      betweenDesign: between,
    });
  }
  return peers;
}