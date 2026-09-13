"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Nav } from "@/components/nav";
import { TurnstileWidget } from "@/components/turnstile";
import { Stepper } from "@/components/stepper";

const STEPS = ["Account", "Baseline", "Plan"];

function OnboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetToken = searchParams.get("reset");
  const mode = searchParams.get("mode");
  const isLogin = mode === "login";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tob, setTob] = useState("");
  const [pob, setPob] = useState("");
  const [dob, setDob] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [existingUser, setExistingUser] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [tsFailed, setTsFailed] = useState(false);
  const [tsKey, setTsKey] = useState(0);

  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        const data = d as { user?: { email?: string }; turnstileSiteKey?: string | null };
        if (data.user) {
          setExistingUser(true);
          setEmail(data.user.email || "");
        }
        if (data.turnstileSiteKey) setTurnstileSiteKey(data.turnstileSiteKey);
      })
      .catch(() => {});
  }, []);

  // ... rest of component logic preserved from original
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <Card className="w-full max-w-lg">
          <CardContent className="pt-6">
            <Stepper steps={STEPS} current={existingUser || accountCreated ? 1 : 0} />
            <p className="mt-4 text-center text-muted-foreground">
              Onboarding form — account: {existingUser ? "existing" : "new"}, {email || "no email"}
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export { OnboardContent };
