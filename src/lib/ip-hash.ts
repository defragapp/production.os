/**
 * Privacy-preserving client-IP token for ephemeral rate-limit KV keys (#62).
 *
 * A raw `cf-connecting-ip` used to appear verbatim inside the
 * `login-rl:` / `signup-ip-rl:` / `pkauth-rl:` / `rl:support-ip:` counters.
 * Those buckets are abuse-brakes, not identity: they only need a value that is
 * STABLE for one client and unreadable-as-an-address by anyone who can list the
 * namespace. So we store HMAC-SHA256(serverSecret, ip), truncated to 128 bits.
 *
 * Keyed rather than a bare SHA-256 on purpose: the IPv4 space is small enough
 * (~4.3B) that an unkeyed digest is trivially reversed by pre-computing every
 * address, so a bare hash would not earn the privacy claim we make on /privacy.
 *
 * Dependency-free (WebCrypto only) so any Worker route can import it.
 */

/** Encode a string as an ArrayBuffer for the strict WebCrypto BufferSource type. */
function toArrayBuffer(s: string): ArrayBuffer {
  return new TextEncoder().encode(s).buffer as ArrayBuffer;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

// 128 bits of keyed digest: short enough to keep KV keys tidy, wide enough that
// a collision between two clients (which merely merges their counters) is a
// rounding error.
const TOKEN_HEX_LENGTH = 32;

/**
 * Derive a stable, non-reversible, secret-keyed token from a client IP for use
 * inside a rate-limit KV key. Never returns the raw address.
 *
 * @param ip     the client address (`cf-connecting-ip`, or the "unknown"
 *               sentinel when the header is absent).
 * @param secret the server secret to key the digest with — pass `JWT_SECRET`.
 *               When it is empty (public routes that run without the session
 *               guard), fall back to a fixed key so the limiter still works and
 *               still never stores the raw IP; production always sets the
 *               secret, so the fallback is a safety net, not the normal path.
 */
export async function hashClientIp(ip: string, secret: string): Promise<string> {
  const keyBytes = toArrayBuffer(secret || "sovereign-ip-hash-fallback-key");
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, toArrayBuffer(ip));
  return toHex(sig).slice(0, TOKEN_HEX_LENGTH);
}
