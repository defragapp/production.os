"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
      const authRes = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      if (!authRes.ok) { const err = await authRes.json(); throw new Error(err.error || "Authentication failed"); }
      const baselineRes = await fetch("/api/baseline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tob, pob, dob }) });
      if (!baselineRes.ok) { const err = await baselineRes.json(); throw new Error(err.error || "Failed to save baseline"); }
      router.push("/chat");
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong"); } finally { setLoading(false); }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set Your Baseline</CardTitle>
          <CardDescription>Enter your birth data to generate your Sovereign OS baseline. Your data is computed using the NASA/JPL Horizons API and never sent to third parties.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div>
            <div className="space-y-2"><Label htmlFor="password">Password (min 8 characters)</Label><Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></div>
            <div className="border-t pt-4" />
            <div className="space-y-2"><Label htmlFor="dob">Date of Birth</Label><Input id="dob" type="date" required value={dob} onChange={(e) => setDob(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="tob">Time of Birth (24h)</Label><Input id="tob" type="time" required value={tob} onChange={(e) => setTob(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="pob">Place of Birth</Label><Input id="pob" type="text" required value={pob} onChange={(e) => setPob(e.target.value)} placeholder="City, Country" /></div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Computing baseline..." : "Create Baseline"}</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
