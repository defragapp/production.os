"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function OnboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tob, setTob] = useState("");
  const [pob, setPob] = useState("");
  const [dob, setDob] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const authRes = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!authRes.ok) {
        const err = await authRes.json() as { error?: string };
        throw new Error(err.error || "Authentication failed");
      }

      const baselineRes = await fetch("/api/baseline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tob, pob, dob }),
      });

      if (!baselineRes.ok) {
        const err = await baselineRes.json() as { error?: string };
        throw new Error(err.error || "Failed to save baseline");
      }

      router.push("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="mb-1 text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Sovereign OS
          </p>
          <h1 className="text-2xl font-bold">Set Your Baseline</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your birth data to generate your baseline. Computed using the NASA/JPL Horizons
            API. Your data is never sent to third parties.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password (min 8 characters)</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <div className="border-t pt-4" />

              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  required
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tob">Time of Birth (24h)</Label>
                <Input
                  id="tob"
                  type="time"
                  required
                  value={tob}
                  onChange={(e) => setTob(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pob">Place of Birth</Label>
                <Input
                  id="pob"
                  type="text"
                  required
                  value={pob}
                  onChange={(e) => setPob(e.target.value)}
                  placeholder="City, Country"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Computing baseline..." : "Create Baseline"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
