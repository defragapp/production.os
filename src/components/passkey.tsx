"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { Button } from "@/components/ui/button";

async function readJson<T>(res: Response): Promise<T | null> {
  try {
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
}

function passkeysSupported(): boolean {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential !== "undefined";
}

/**
 * Passkey-first sign-in. Uses discoverable credentials, so no email is needed.
 * If the browser has no passkey for this site, the ceremony aborts and we fall
 * back to the password form (never a dead end).
 */
export function PasskeySignInButton({ className }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = passkeysSupported();

  const getOptions = async (): Promise<{ requestId: string; options: PublicKeyCredentialRequestOptionsJSON }> => {
    const optRes = await fetch("/api/auth/passkey/authenticate", { method: "POST" });
    const opts = await readJson<{ requestId?: string; options?: PublicKeyCredentialRequestOptionsJSON; error?: string }>(optRes);
    if (!opts?.options || !opts.requestId) throw new Error(opts?.error || "Could not start sign-in.");
    return { requestId: opts.requestId, options: opts.options };
  };

  const finishLogin = async (requestId: string, response: AuthenticationResponseJSON) => {
    const verRes = await fetch("/api/auth/passkey/authenticate", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, response }),
    });
    const data = await readJson<{ error?: string; hasBaseline?: boolean }>(verRes);
    if (!verRes.ok) throw new Error(data?.error || "Passkey sign-in failed.");
    router.push(data?.hasBaseline ? "/chat" : "/baseline");
    router.refresh();
  };

  // Conditional / autofill UI: lets iOS Safari offer the passkey in the
  // keyboard QuickType bar and desktop Chrome in the form autofill dropdown.
  // Needs an <input autocomplete="username webauthn"> on the login form (set in
  // onboard-content.tsx). Best-effort: any failure is ignored, since the
  // explicit button below is always available.
  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    (async () => {
      try {
        const { requestId, options } = await getOptions();
        const response = await startAuthentication({
          optionsJSON: options,
          useBrowserAutofill: true,
          verifyBrowserAutofillInput: true,
        });
        if (cancelled) return;
        await finishLogin(requestId, response);
      } catch {
        /* conditional UI unsupported/no credential — the button is the fallback */
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  if (!supported) return null;

  const onClick = async () => {
    setError(null);
    setBusy(true);
    try {
      const { requestId, options } = await getOptions();
      const response = await startAuthentication({ optionsJSON: options });
      await finishLogin(requestId, response);
    } catch (e) {
      // AbortError = user dismissed the prompt; treat as a soft, retryable state.
      const msg = e instanceof Error ? e.message : "";
      setError(msg && !/abort/i.test(msg) ? msg : "No passkey found on this device — sign in with your email and password.");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" className={className ?? "w-full"} onClick={onClick} disabled={busy}>
        {busy ? "Waiting for your device…" : "Continue with passkey"}
      </Button>
      {error && <p className="text-center text-sm text-muted-foreground">{error}</p>}
    </div>
  );
}

/**
 * "Add a passkey" — shown only inside an authenticated session (account page).
 * Enrollment requires a session so the credential is always bound to a known
 * user; the password stays as the recovery path.
 */
export function AddPasskeyButton({ onDone }: { onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  if (!passkeysSupported()) {
    return <p className="text-sm text-muted-foreground">Passkeys aren&apos;t supported on this browser.</p>;
  }

  const onClick = async () => {
    setMessage(null);
    setBusy(true);
    try {
      const optRes = await fetch("/api/auth/passkey/register", { method: "POST" });
      const opts = await readJson<PublicKeyCredentialCreationOptionsJSON & { error?: string }>(optRes);
      if (!opts?.challenge) throw new Error((opts as { error?: string })?.error || "Could not start passkey setup.");

      const response = await startRegistration({ optionsJSON: opts, useAutoRegister: true });

      const verRes = await fetch("/api/auth/passkey/register", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(response),
      });
      const data = await readJson<{ ok?: boolean; error?: string }>(verRes);
      if (!verRes.ok || !data?.ok) throw new Error(data?.error || "Passkey setup failed.");

      setMessage({ kind: "ok", text: "Passkey added. You can now sign in with Face ID, Touch ID, or your device." });
      onDone?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setMessage({ kind: "error", text: msg && !/abort/i.test(msg) ? msg : "Passkey setup was cancelled." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" className="w-full" onClick={onClick} disabled={busy}>
        {busy ? "Waiting for your device…" : "Add a passkey"}
      </Button>
      {message && (
        <p className={`text-sm ${message.kind === "ok" ? "text-foreground" : "text-destructive"}`}>{message.text}</p>
      )}
    </div>
  );
}
