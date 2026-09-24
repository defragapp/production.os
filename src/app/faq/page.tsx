import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "FAQ — Sovereign OS",
  description: "Answers about Sovereign OS — how the AI works, what we do with your data, and how the free and paid plans compare.",
};

const FAQS = [
  {
    q: "What is Sovereign OS?",
    a: "Sovereign is an AI that helps you think through what's happening in your life — with yourself, in a relationship, or inside your family. It separates what actually happened from what you may have made it mean, and helps you decide for yourself what to do about it. It is not fortune-telling: it is grounded in a personal Baseline computed from your date, time, and place of birth using NASA/JPL planetary data.",
  },
  {
    q: "Is this therapy or medical advice?",
    a: "No. Sovereign is a tool for self-reflection and awareness. It does not diagnose, treat, or replace professional mental health, medical, financial, or legal advice. Sovereign never tells you who you are — you remain the authority over your own life. It offers possibilities worth examining and asks questions that help you think more clearly. If you are struggling, please reach out to a qualified professional.",
  },
  {
    q: "What does the AI actually do?",
    a: "Every answer keeps three things separate: what you told us (the facts as you described them), what your Baseline suggests (a general tendency, not a verdict about you), and what is only a possibility worth examining. It never claims to know another person's inner reasons, and it never predicts the future. It ends by asking you a question — because understanding is something you do, not something you receive.",
  },
  {
    q: "Where does my Baseline come from?",
    a: "Your Baseline is computed from your date, time, and place of birth. We calculate the position of the planets from NASA/JPL ephemeris data and combine it with two other systems (numerology and Human Design) into a single, readable profile the AI references in your conversations.",
  },
  {
    q: "What do you do with my birth data?",
    a: "One thing only: computing your Baseline. It is never sold or shared. You can delete your entire account — baseline, chats, and data — in one click from your Account page, and we remove it.",
  },
  {
    q: "What's the difference between Free and Sovereign+?",
    a: "Free includes your full Baseline and 5 AI messages per day. Sovereign+ removes the daily cap and lets you invite people into your relationships — $20/month, or $99/year (save 59%). You can cancel anytime.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Subscriptions run through Stripe — cancel in two clicks from your Account page, and your access continues through the end of the paid period.",
  },
];

export default function FaqPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-14">
        <PageHeader
          title="Questions, answered"
          description="What Sovereign is, how it works, and what it means for you."
          center
        />

        <Link
          href="/upgrade"
          className="mx-auto mb-10 block text-center font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground transition-colors duration-[240ms] hover:text-foreground"
        >
          Compare Free vs Sovereign+ →
        </Link>

        <div className="border-t border-border">
          {FAQS.map((item) => (
            <details
              key={item.q}
              className="group border-b border-border py-6"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between text-base font-medium text-foreground [&::-webkit-details-marker]:hidden">
                {item.q}
                <span className="ml-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </main>
    </>
  );
}