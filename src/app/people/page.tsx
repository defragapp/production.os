import type { Metadata } from "next";
import { LensPage } from "@/components/lens-page";
import { PerspectiveSwitch } from "@/components/perspective-switch";
import { resolveLensState, lensChatHref, lensInviteHref } from "@/lib/lens-state";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "People",
  description: "A lens for understanding what happens between people, with consented context and clear boundaries.",
};

const CARDS = [
  {
    eyebrow: "Relationship lens",
    title: "Hold both sides without losing your own.",
    body:
      "This lens helps separate the moment, the meaning, and the boundary so a tense exchange stops collapsing into a verdict.",
  },
  {
    eyebrow: "Consent first",
    title: "Only the context people actually shared belongs here.",
    body:
      "The system keeps consented context distinct from private inference, so you can think clearly without overreaching into someone else's inner world.",
  },
  {
    eyebrow: "Use it for",
    title: "The recurring argument, the hard text thread, the slow drift.",
    body:
      "Use People when a connection feels stuck and you want the next question, not a relationship verdict.",
  },
] as const;

export default async function PeoplePage() {
  const { isAuthed, hasBaseline } = await resolveLensState();
  return (
    <LensPage
      eyebrow="People"
      title="Understand what happens between you and someone else."
      description="A lens for the moment that keeps repeating, the meaning each person brings to it, and the boundary that stays yours."
      cards={CARDS}
      cta={{ label: "Open the chat", href: lensChatHref(isAuthed) }}
      secondaryCta={{ label: "Invite someone", href: lensInviteHref(isAuthed) }}
      note="Use this when the question is relational, but you want to stay honest about what you know and what you do not."
      isAuthed={isAuthed}
      hasBaseline={hasBaseline}
    >
      <PerspectiveSwitch />
    </LensPage>
  );
}


