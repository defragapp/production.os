import type { Metadata } from "next";
import { LensPage } from "@/components/lens-page";
import { AnswerAnatomy } from "@/components/answer-anatomy";
import { resolveLensState, lensChatHref } from "@/lib/lens-state";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Self",
  description: "A private lens for understanding yourself, grounded in your Baseline — what happened, what it came to mean, and the next honest step.",
};

const CARDS = [
  {
    eyebrow: "Why this lens",
    title: "Start with the part that keeps repeating.",
    body:
      "Use this space when you want a clearer view of your own reactions, pressure points, and the questions that keep coming back.",
  },
  {
    eyebrow: "What it keeps apart",
    title: "What happened is not the same as what you made it mean.",
    body:
      "Sovereign keeps observation, interpretation, and next steps separate so the answer stays clear without becoming clinical.",
  },
  {
    eyebrow: "What to do next",
    title: "Ask for the next smallest step.",
    body:
      "When you need a way forward, this lens turns what you are living through into a short, honest sequence you can actually act on.",
  },
] as const;

export default async function SelfPage() {
  const { isAuthed, hasBaseline } = await resolveLensState();
  return (
    <LensPage
      eyebrow="Self"
      title="See yourself clearly, without turning it into a verdict."
      description="A quiet place to ask what keeps happening, what you actually feel, and what the next honest step could be."
      cards={CARDS}
      cta={{ label: "Open the full chat", href: lensChatHref(isAuthed) }}
      secondaryCta={{ label: "Build your Baseline", href: "/baseline", stateAware: true }}
      note="Best when you want to name the shape of something before you bring anyone else into it."
      isAuthed={isAuthed}
      hasBaseline={hasBaseline}
    >
      <AnswerAnatomy />
    </LensPage>
  );
}


