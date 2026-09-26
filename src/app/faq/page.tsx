import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { PageHeader } from "@/components/page-header";
import { PageTexture } from "@/components/page-texture";

export const metadata: Metadata = {
  title: "FAQ — Sovereign OS",
  description: "Answers about Sovereign OS — how the AI works, what we do with your data, and how the free and paid plans compare.",
};

const FAQS = [
  {
    q: "What is Sovereign OS?",
    a: "An AI that helps you think through what's happening in your life — with yourself, in a relationship, or at home. It separates what actually happened from what it started to mean to you, and leaves the deciding to you. It's not fortune-telling: every read is grounded in a personal Baseline computed from your birth date, time, and place using NASA/JPL planetary data.",
  },
  {
    q: "Is this therapy or medical advice?",
    a: "No. Sovereign is a mirror, not a clinician. It doesn't diagnose, treat, or stand in for professional mental-health, medical, financial, or legal advice — and it never tells you who you are. It offers possibilities worth examining and questions that help you think more clearly. If you're struggling, please reach out to a qualified professional.",
  },
  {
    q: "What does the AI actually do?",
    a: "Every answer keeps three things apart: what you said happened, what your Baseline suggests (a tendency, not a verdict about you), and what's only a possibility worth examining. It never claims to know what's going on inside someone else, and it never predicts the future. It usually ends by asking you a question — because understanding is something you do, not something you receive.",
  },
  {
    q: "Where does my Baseline come from?",
    a: "From your birth date, time, and place. We compute the planets' positions from NASA/JPL ephemeris data and combine them with two long-standing reference systems (numerology and Human Design) into one readable profile that the AI brings into your conversations.",
  },
  {
    q: "What do you do with my birth data?",
    a: "One thing only: computing your Baseline. It is never sold or shared. You can delete your entire account — Baseline, chats, and data — in one click from your Account page, and we remove it.",
  },
  {
    q: "What's the difference between Free and Sovereign+?",
    a: "Free includes your full Baseline and 5 AI messages a day. Sovereign+ removes the daily cap and lets you invite people into your relationships — $20/month, or $99/year (save 59%). You can cancel anytime.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Subscriptions run through Stripe — cancel in two clicks from your Account page, and your access continues through the end of the paid period.",
  },
];

export default function FaqPage() {
  return (
    <>
      <PageTexture />
      <Nav />
      <main className="relative mx-auto max-w-3xl px-6 py-14">
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

        <div className="glass-panel px-6 md:px-8">
          {FAQS.map((item) => (
            <details
              key={item.q}
              className="group border-b border-border/70 py-5 last:border-b-0"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-medium text-foreground transition-colors duration-200 hover:text-foreground/80 [&::-webkit-details-marker]:hidden md:text-base">
                {item.q}
                <span aria-hidden="true" className="ml-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-sm text-muted-foreground transition-all duration-200 group-open:rotate-45 group-open:border-foreground/30 group-open:text-foreground">
                  +
                </span>
              </summary>
              <p className="max-w-prose pb-1 pt-3 text-sm leading-7 text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>

        {/* Anything the FAQ didn't cover goes to a human — same lit-band
            treatment as the landing's closing CTA. */}
        <div className="section-rule mt-14" aria-hidden="true" />
        <section className="relative overflow-hidden py-14 text-center">
          <div className="hero-light" aria-hidden="true" />
          <div className="relative">
            <h2 className="font-display text-xl font-normal tracking-tight text-foreground md:text-2xl">
              Questions we didn&apos;t answer?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">Tell us — we read everything, and a person writes back.</p>
            <Link href="/support" className="btn-glass mt-6 inline-block px-6 py-2.5 text-sm font-medium text-foreground">
              Write to the team
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
