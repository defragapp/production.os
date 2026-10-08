import type { Metadata } from "next";
import { LensPage } from "@/components/lens-page";
import { SystemDynamics } from "@/components/system-dynamics";
import { resolveLensState } from "@/lib/lens-state";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Family & Teams",
  description: "A lens for the larger room: family, teams, roles, and the hidden rules that shape the whole field.",
};

const CARDS = [
  {
    eyebrow: "The whole room",
    // Was "See the dynamic, not just the loudest person in it." — the same
    // sentence as the H1 above it, twice on one screen.
    title: "See how the room actually works.",
    body:
      "The Family & Teams lens shows how roles, timing, and expectations interact so you can see the structure instead of getting lost in the drama.",
  },
  {
    eyebrow: "Beyond blame",
    title: "Map the dynamic that keeps everyone in place.",
    body:
      "The goal is clarity: where the pressure lands, what each person is protecting, and which change is actually yours to make.",
  },
  {
    eyebrow: "Good for",
    title: "Family dynamics, team tension, and the rules no one says out loud.",
    body:
      "Use the Family & Teams lens when the issue is bigger than one person and you need the shape of the whole environment before you act.",
  },
] as const;

export default async function FamilyTeamsPage() {
  const { isAuthed, hasBaseline } = await resolveLensState();
  return (
    <LensPage
      eyebrow="Family & Teams"
      title="Understand the room as a whole, not just the loudest voice in it."
      description="A lens for families, teams, and any context where roles and expectations shape the conversation before anyone speaks."
      cards={CARDS}
      cta={{ label: "Open the chat", href: "/chat" }}
      secondaryCta={{ label: "Read the philosophy", href: "/about" }}
      note="Best when the real question is structural: who is carrying what, and how the room keeps arranging itself."
      isAuthed={isAuthed}
      hasBaseline={hasBaseline}
    >
      <SystemDynamics />
    </LensPage>
  );
}


