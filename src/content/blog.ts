/**
 * /blog — three seed essays, plain data, rendered via src/app/blog/[slug].
 *
 * We keep the corpus in a module (not MDX) so a new essay is a typed edit —
 * no build step, no frontmatter parser, and the existing typecheck catches
 * a missing heading or malformed section. If the corpus grows past ~10, or
 * the operator wants images / embeds, migrate to next-mdx-remote; the
 * public shape (slug + title + description + published + sections[]) should
 * stay compatible with that migration.
 *
 * Voice rule: essays say the same thing the marketing pages say, in longer
 * form. No invented statistics, no fabricated case studies, no "we're
 * revolutionizing X". Honest editorial, in the operator's voice.
 */
export type BlogSection =
  | { kind: "p"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "ul"; items: string[] };

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  published: string; // ISO yyyy-mm-dd, used for <time> + sitemap lastmod
  readingMinutes: number;
  sections: BlogSection[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "what-is-a-baseline",
    title: "What is a Baseline?",
    description:
      "The reference frame Sovereign builds from your birth data — what it is, what it isn't, and why it earns the word 'baseline' instead of 'chart'.",
    published: "2026-10-05",
    readingMinutes: 4,
    sections: [
      {
        kind: "p",
        text: "Most personality systems hand you a picture and tell you it's you. A Baseline is a smaller, stranger claim: a stable, plain-language reference for how you tend to process, decide, and react under pressure — computed once from your birth data, then left in the background of every conversation so the conversation can stay about your actual life.",
      },
      { kind: "h2", text: "What goes in" },
      {
        kind: "p",
        text: "Three numbers, entered once: date of birth, approximate time, and place. Time is useful but not required — a missing birth time costs precision about your rising angle, and nothing else. Place is used to compute the local horizon; a city name is enough.",
      },
      {
        kind: "p",
        text: "Sovereign does the rest of the math against NASA/JPL ephemeris data — the same numbers astronomers use. The Sun's position at the moment of your birth is an observable, not a metaphor. Nothing is 'read'; positions are computed and mapped onto plain-language themes we chose because they've held up in clinical and non-clinical writing for a century.",
      },
      { kind: "h2", text: "What comes out" },
      {
        kind: "ul",
        items: [
          "Sun, Moon, and rising — the three angles most self-understanding frameworks actually use.",
          "Planetary themes: a one-sentence description of what each placement tends to influence, phrased as a tendency (never a verdict).",
          "Human Design type, strategy, and authority — a separate, orthogonal system, kept in its own section so nothing quietly mixes traditions.",
          "Gene Keys flavor for a small handful of prominent gates — the same placements, one layer deeper.",
        ],
      },
      { kind: "h2", text: "What it isn't" },
      {
        kind: "p",
        text: "Not astrology-as-fortune-telling. Not a diagnosis. Not a moral judgment about the parts of you that are hard to live with. Your Baseline is a description of your defaults, and defaults are only useful when you can see them clearly enough to choose differently. That choosing is the actual product — the Baseline is the ground it happens on.",
      },
      {
        kind: "p",
        text: "You can view it any time from the header, edit your birth data from Settings, and download it in the same JSON export you use to leave the platform entirely. It's yours.",
      },
    ],
  },
  {
    slug: "why-we-built-sovereign",
    title: "Why we built Sovereign",
    description:
      "Assistant software got amnesic at exactly the moment it got good. Here's the specific gap we tried to close, and why a solo-operator Cloudflare stack was the right shape for it.",
    published: "2026-10-12",
    readingMinutes: 5,
    sections: [
      {
        kind: "p",
        text: "Sovereign exists because the two dominant shapes of 'AI assistant' each fail at the thing the other does well. The general assistants — the ones with billions in funding — have world-class recall of your questions and none of your life. The self-understanding apps — the journal prompts, the tarot decks, the personality frameworks — have a strong language for what a person is, but no memory of what happened to that person last Tuesday.",
      },
      { kind: "h2", text: "The gap" },
      {
        kind: "p",
        text: "Somewhere in the middle is the thing people actually want when they're trying to make sense of a hard week: a system that knows their specific defaults, remembers their actual history, and won't pretend to be a guru. It should not need to be trained on them. It should not need to sell them something. It should hand them back their own data if they decide to leave.",
      },
      {
        kind: "p",
        text: "Nobody has built that middle lane seriously yet, because the tools for it only got cheap in the last two years. Which is the second half of the title. Why Sovereign. Why now.",
      },
      { kind: "h2", text: "Why the shape is what it is" },
      {
        kind: "p",
        text: "Sovereign is a solo-operated product on Cloudflare Workers, D1, KV, and Vectorize. That's not a compromise; it's the reason the product can honestly say the things it says. A single operator, with a runtime that costs roughly nothing at small scale, doesn't need to monetize your data to break even. There's no venture round that has to be paid back by growing MAU, no ad network to introduce, no telemetry pipeline whose only justification is that it exists.",
      },
      {
        kind: "ul",
        items: [
          "Workers run within 100ms of every populated place on earth; there is no origin server to subpoena, and no cold region to fail over.",
          "D1 is a real relational store; export is a SELECT, delete is a DELETE, and cascade behaviour is verifiable.",
          "Vectorize keeps your semantic recall in a per-user namespace, so 'search across all our past conversations' doesn't leak between accounts by construction.",
          "Workers AI handles embeddings and safety screening natively; the primary model runs through an AI Gateway with a real fallback.",
        ],
      },
      { kind: "h2", text: "Why it's still small" },
      {
        kind: "p",
        text: "Because we refuse to make claims we haven't earned. Sovereign has a waitlist, not a growth chart. It has one human answering support email, not a '24/7 team'. It has three essays on this blog, not a content strategy. The point of shipping it now is to keep it in the shape that made it possible in the first place — small enough to be honest, priced so that the product can be the business.",
      },
      {
        kind: "p",
        text: "If that's the kind of thing you want to use, the free tier is on the landing page. If you want to build a company this way, we'd honestly love the company; hit support@ and start a conversation.",
      },
    ],
  },
  {
    slug: "the-relationship-moat",
    title: "The relationship moat",
    description:
      "Journaling apps are solo tools. Assistants are solo tools. The hard, unpatented thing Sovereign does is hold two Baselines in the same conversation without flattening either.",
    published: "2026-10-19",
    readingMinutes: 4,
    sections: [
      {
        kind: "p",
        text: "Every reflection tool on the market is a mirror in an empty room. That's fine for what it is — writing down what happened to you helps. But it isn't what people actually ask about in the first week of using one, because the questions that keep them up at 3am are never solo questions. They're about someone else.",
      },
      { kind: "h2", text: "What a solo tool can't answer" },
      {
        kind: "ul",
        items: [
          "\"Why does that one conversation always go sideways?\"",
          "\"What role did I inherit in my family that I'm tired of playing?\"",
          "\"Are we actually incompatible, or just regulating stress at different speeds?\"",
        ],
      },
      {
        kind: "p",
        text: "A solo tool can reflect your half. It can't reflect the interaction, because it doesn't have the other half. So it either tells you to accept your half alone, or quietly blames the other person for theirs — neither of which is what understanding a relationship actually feels like.",
      },
      { kind: "h2", text: "The two-sided move" },
      {
        kind: "p",
        text: "Sovereign's invites let a second person build their own Baseline and share it, on purpose, with you — and only with you. Their birth data isn't scraped from anywhere, isn't inferred from a chat log, isn't held in some marketing profile. It's what they typed into their own account and pointed at your thread. When both Baselines are in the room, a Sovereign answer can name the shape of the interaction instead of picking a side. Same moment, from both sides, resolving into common ground.",
      },
      {
        kind: "p",
        text: "That is the moat, and it's unpatented. There's no proprietary model that lets us do it. It's just the product decision to make the second Baseline consented, first-class, and legible to the AI at the moment of the conversation. Most assistants won't do it because they don't have a place for another whole person to be. Most journaling apps won't do it because they'd have to add accounts, invites, and privacy review to a solo tool.",
      },
      { kind: "h2", text: "Why this is worth the friction" },
      {
        kind: "p",
        text: "Inviting someone costs you the awkward two minutes of sending the link. The answer you get back is calibrated to both of you, and neither of you is being described behind the other's back. If your partner, parent, or best friend ever declines — their Baseline is not in the room, and Sovereign will say so plainly instead of quietly guessing. You can decide what to do with a real relationship that has its own real consent.",
      },
      {
        kind: "p",
        text: "If you came here looking for a personality quiz, this isn't it. If you came here because there's a person in your life whose mind you want to actually understand — that's what this is for.",
      },
    ],
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
