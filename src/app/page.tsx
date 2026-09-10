import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">Sovereign OS</CardTitle>
          <CardDescription>Synthesize your emotional expression based on your baseline data.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Link href="/chat"><Button className="w-full" size="lg">Enter Chat</Button></Link>
          <Link href="/onboard"><Button className="w-full" variant="outline" size="lg">Set Baseline Data</Button></Link>
        </CardContent>
      </Card>
    </main>
  );
}
