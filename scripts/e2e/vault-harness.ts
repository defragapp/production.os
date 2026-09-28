/**
 * Deterministic browser harness for the local-memory vault (Part 4 ratchet).
 *
 * Node's vitest run can only prove the "no IndexedDB" degrade path; the actual
 * AES-GCM round-trip needs a real browser (crypto.subtle + IndexedDB). This
 * bundle imports the committed local-memory module verbatim and runs the
 * guarantee the vault exists to provide: the journey is encrypted at rest and
 * decrypts back to the same object. Exposed on `window` for Playwright to call.
 */
import {
  isLocalMemoryAvailable,
  writeRecord,
  readRecord,
  clearLocalMemory,
  LOCAL_DB_NAME,
  LOCAL_DB_VERSION,
  LOCAL_RECORDS_STORE,
  type LocalJourneyRecord,
} from "../../src/lib/local-memory";

export interface VaultResult {
  available: boolean;
  wrote: boolean;
  ciphertextAtRest: boolean;
  plaintextAbsent: boolean;
  roundTripEquals: boolean;
  cleared: boolean;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Read the raw stored envelope (bypassing the module's decrypt) so we can
 *  prove what actually sits on disk. */
async function rawEnvelope(kind: string): Promise<{ iv: string; data: string } | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(LOCAL_RECORDS_STORE, "readonly").objectStore(LOCAL_RECORDS_STORE).get(kind);
    req.onsuccess = () => {
      const value = req.result as { env: { iv: string; data: string } } | undefined;
      db.close();
      resolve(value ? value.env : null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function runVaultRoundTrip(): Promise<VaultResult> {
  const goal = "Recover the footing I lost with my partner";
  const marker = "PLAINTEXT-MARKER-XYZ";
  const rec: LocalJourneyRecord<unknown> = {
    version: 1,
    userScope: "vault-e2e@example.com",
    updatedAt: new Date().toISOString(),
    status: "active",
    state: { hello: goal, marker },
  };

  await clearLocalMemory();
  const available = await isLocalMemoryAvailable();
  if (!available) {
    return { available: false, wrote: false, ciphertextAtRest: false, plaintextAbsent: false, roundTripEquals: false, cleared: true };
  }

  const wrote = await writeRecord("journey", rec);
  const env = await rawEnvelope("journey");
  const storedStr = env ? `${env.iv} ${env.data}` : "";
  // base64url ciphertext of a non-empty buffer => an opaque blob, not JSON.
  const ciphertextAtRest = !!env && env.data.length > 0 && /^[A-Za-z0-9_-]+$/.test(env.data);
  const plaintextAbsent = !!env && !storedStr.includes(goal) && !storedStr.includes(marker);

  const back = await readRecord<{ hello?: string }>("journey", "vault-e2e@example.com");
  const roundTripEquals = !!back && back.state.hello === goal;

  await clearLocalMemory();
  const cleared = (await readRecord("journey", "vault-e2e@example.com")) === null;

  return { available, wrote, ciphertextAtRest, plaintextAbsent, roundTripEquals, cleared };
}

const w = globalThis as unknown as { __sovereignVault: { run: () => Promise<VaultResult> } };
w.__sovereignVault = { run: runVaultRoundTrip };
