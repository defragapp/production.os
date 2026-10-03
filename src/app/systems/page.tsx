import type { Metadata } from "next";
import { LensPage } from "@/components/lens-page";

export const metadata: Metadata = {
  title: "Systems",
  description: "A lens for the larger room: family, teams, roles, and the hidden rules that shape the whole field.",
};

const CARDS = [
  {
    eyebrow: "The whole room",
    title: "See the dynamic, not just the loudest person in it.",
    body:
      "Systems lensing shows how roles, timing, and expectations interact so you can see the structure instead of getting lost in the drama.",
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
      "Use Systems when the issue is bigger than one person and you need the shape of the whole environment before you act.",
  },
] as const;

export default function SystemsPage() {
  return (
    <LensPage
      eyebrow="Systems"
      title="Understand the room as a whole, not just the loudest voice in it."
      description="A lens for families, teams, and any context where roles and expectations shape the conversation before anyone speaks."
      cards={CARDS}
      cta={{ label: "Open the chat", href: "/chat" }}
      secondaryCta={{ label: "Read the philosophy", href: "/about" }}
      note="Best when the real question is structural: who is carrying what, and how the room keeps arranging itself."
    />
  );
}


