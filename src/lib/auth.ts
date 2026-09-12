/**
 * Auth utilities — WebCrypto-based password hashing and JWT session tokens.
 */

const JWT_SECRET_ENV_KEY = "JWT_SECRET";
const SESSION_COOKIE_NAME = "sovereign_session";

/** PBKDF2-HMAC-SHA256 iterations for NEW hashes (OWASP recommended >= 600k). */
export const PBKDF2_ITERATIONS = 600_000;
/** Legacy iterations still used to verify plus parse pre-versioning hashes. */
const PBKDF2_ITERATIONS_LEGACY = 100_000;
/** Prefix marking a versioned hash as `pbkdf2$<iterations>$<hex>`. */
const HASH_PREFIX = "pbkdf2$";

/** Encode a string as an ArrayBuffer for WebCrypto calls. */
function toArrayBuffer(s: string): ArrayBuffer {
  return new TextEncoder().encode(s).buffer as ArrayBuffer;
}

/** Generate a cryptographically random salt as hex. */
export function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** PBKDF2-HMAC-SHA256 over a raw password + salt, returning hex. */
async function computeHash(password: string, salt: string, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey("raw", toArrayBuffer(password), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: toArrayBuffer(salt), iterations, hash: "SHA-256" }, keyMaterial, 256);
  return Array.from(new Uint8Array(derived), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Hash a password with a salt, storing a versioned `pbkdf2$<iterations>$<hex>` string. */
export async function hashPassword(password: string, salt: string, iterations: number = PBKDF2_ITERATIONS): Promise<string> {
  const hex = await computeHash(password, salt, iterations);
  return `${HASH_PREFIX}${iterations}$${hex}`;
}

/**
 * Parse a stored hash, tolerating BOTH the new versioned format and the
 * legacy raw 64-hex format (which hashes were created at 100k iterations).
 */
export function parseStoredHash(storedHash: string): { iterations: number; hex: string } {
  if (storedHash && storedHash.startsWith(HASH_PREFIX)) {
    const [, iterStr, hex] = storedHash.split("$");
    const iterations = parseInt(iterStr, 10);
    return { iterations: Number.isFinite(iterations) && iterations > 0 ? iterations : PBKDF2_ITERATIONS_LEGACY, hex: hex ?? "" };
  }
  return { iterations: PBKDF2_ITERATIONS_LEGACY, hex: storedHash ?? "" };
}

/** True when the stored hash was created with fewer iterations than the target. */
export function passwordNeedsRehash(storedHash: string): boolean {
  return parseStoredHash(storedHash).iterations < PBKDF2_ITERATIONS;
}

/** Verify a password against a stored hash + salt (supports legacy and versioned). */
export async function verifyPassword(password: string, salt: string, storedHash: string): Promise<boolean> {
  const { iterations, hex } = parseStoredHash(storedHash);
  if (!hex) return false;
  const computed = await computeHash(password, salt, iterations);
  return timingSafeEqual(computed, hex);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Generate a UUID v4. */
export function generateUUID(): string {
  return crypto.randomUUID();
}

// ── JWT ──────────────────────────────────────────────────────────────

interface JWTPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

function base64UrlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array<ArrayBuffer> {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function getJwtKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", toArrayBuffer(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/** Create a signed JWT. Expires in 7 days. */
export async function createJWT(userId: string, email: string, secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload = { sub: userId, email, iat: now, exp: now + 7 * 24 * 60 * 60 };
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await getJwtKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, toArrayBuffer(signingInput));
  return `${signingInput}.${base64UrlEncode(sig)}`;
}

/** Verify a JWT and return its payload, or null if invalid/expired. */
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await getJwtKey(secret);
  const sigBytes = base64UrlDecode(sigB64);
  const valid = await crypto.subtle.verify("HMAC", key, sigBytes, toArrayBuffer(signingInput));
  if (!valid) return null;
  const payload: JWTPayload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

// ── Password reset tokens ────────────────────────────────────────────

/** Generate a cryptographically random reset token (hex). */
export function generateResetToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Hash a reset token for storage (so a leaked DB doesn't expose usable tokens). */
export async function hashResetToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export { SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY };
