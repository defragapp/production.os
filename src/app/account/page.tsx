"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Nav } from "@/components/nav";
import { PageHeader } from "@/components/page-header";

interface UserData {
  email: string;
  subscription_tier: string;
  stripe_customer_id: string | null;
  created_at: string;
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        const data = d as { user?: UserData };
        if (!data.user) {
          router.push("/onboard");
          return;
        }
        setUser(data.user);
      })
      .catch(() => router.push("/onboard"))
      .finally(() => setLoading(false));
  }, [router]);

  const handleSignOut = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
  };

  if (loading) {
    return (
      <>
        <Nav />
        <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </main>
      </>
    );
  }

  if (!user) return null;

  const isPlus = user.subscription_tier === "sovereign+";
  const memberSince = new Date(user.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <Nav />
      <main className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden p-6">
        <div className="app-glow absolute inset-0 -z-10" aria-hidden="true" />
        <div className="w-full max-w-lg">
          <PageHeader title="Account" description="Your plan, profile, and account preferences." />
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Subscription</CardTitle>
                <CardDescription>Your current plan and benefits</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Plan</span>
                  <span className={`rounded-full px-3 py-1 text-sm font-medium ${isPlus ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {isPlus ? "Sovereign+" : "Free"}
                  </span>
                </div>
                {isPlus ? (
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>✓ Unlimited AI messages</li>
                    <li>✓ Full chat history & threads</li>
                    <li>✓ Advanced pattern analysis</li>
                    <li>✓ Priority AI inference</li>
                  </ul>
                ) : (
                  <>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>5 AI messages per day</li>
                      <li>Baseline computation</li>
                      <li>Basic chat history</li>
                    </ul>
                    <Button className="w-full" onClick={() => router.push("/upgrade")}>
                      Upgrade to Sovereign+
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Profile</CardTitle>
                <CardDescription>Your account information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <span className="text-sm font-medium">{user.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Member since</span>
                  <span className="text-sm font-medium">{memberSince}</span>
                </div>
              </CardContent>
            </Card>
            <div className="flex flex-col gap-2">
              <Button variant="outline" className="w-full" onClick={() => router.push("/chat")}>Back to Chat</Button>
              <Button variant="outline" className="w-full" onClick={() => router.push("/")}>Home</Button>
              <Button variant="ghost" className="w-full text-destructive" onClick={handleSignOut}>Sign Out</Button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
