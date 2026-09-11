import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Nav } from "@/components/nav";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center p-6">
        <div className="mx-auto w-full max-w-2xl text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Sovereign OS
          </p>
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Understand your patterns.
            <br />
            <span className="text-muted-foreground">Interrupt them.</span>
          </h1>
          <p className="mx-auto mb-8 max-w-md text-lg text-muted-foreground">
            Sovereign OS reads your baseline — astrology, human design, gene keys, and numerology —
            to synthesize your emotional expression and surface the patterns that hold you back.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/onboard?mode=signup">
              <Button className="w-full sm:w-auto" size="lg">Get Started</Button>
            </Link>
            <Link href="/onboard?mode=login">
              <Button className="w-full sm:w-auto" variant="outline" size="lg">Sign In</Button>
            </Link>
          </div>
        </div>
        <div className="mx-auto mt-16 grid w-full max-w-3xl gap-4 sm:grid-cols-3">
          <Card><CardHeader><CardTitle className="text-base">Baseline</CardTitle><CardDescription>Computed from NASA/JPL planetary data at your exact birth time.</CardDescription></CardHeader></Card>
          <Card><CardHeader><CardTitle className="text-base">Pattern Interruption</CardTitle><CardDescription>Name the recurring pattern. Get a specific, actionable interruption.</CardDescription></CardHeader></Card>
          <Card><CardHeader><CardTitle className="text-base">Private</CardTitle><CardDescription>Your birth data is used only to compute your baseline. Never shared.</CardDescription></CardHeader></Card>
        </div>
        <footer className="mt-16 text-center text-sm text-muted-foreground">
          <p>By signing up, you agree to our <a href="/terms" className="underline hover:text-foreground">Terms</a> and <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>.</p>
        </footer>
      </main>
    </>
  );
}
