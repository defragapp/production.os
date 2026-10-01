import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { PageTexture } from "@/components/page-texture";
import { BLOG_POSTS } from "@/content/blog";

export const metadata: Metadata = {
  title: "Field Notes",
  description:
    "Longer-form essays on how Sovereign thinks — the Baseline, the two-sided relationship model, and why a solo operator on Cloudflare is the right shape for this.",
};

function formatMonthDay(iso: string) {
  // Published dates are ISO yyyy-mm-dd; format without a locale-dependent
  // timezone shift that would move the day around for readers outside UTC.
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  return dt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function BlogIndex() {
  // Newest first; ties broken by slug so the order is stable if two essays
  // share a publish date.
  const posts = [...BLOG_POSTS].sort((a, b) =>
    b.published === a.published ? a.slug.localeCompare(b.slug) : b.published.localeCompare(a.published),
  );

  return (
    <>
      <PageTexture />
      <Nav />
      <main
        id="main"
        className="relative mx-auto w-full max-w-2xl px-6 pt-14 pb-24 font-sans text-foreground"
      >
        <div className="app-glow absolute inset-0 -z-10" aria-hidden="true" />
        <div className="section-rule absolute inset-x-0 top-0" aria-hidden="true" />

        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80">
          Field Notes
        </p>
        <h1 className="mb-3 font-display text-4xl font-normal leading-[1.08] tracking-tight text-foreground md:text-[3rem]">
          Longer thoughts, kept <span className="italic">honest</span>.
        </h1>
        <p className="mb-10 max-w-xl text-base leading-7 text-muted-foreground">
          Essays that expand on what the product pages compress — how a Baseline is built, why the
          two-sided relationship model is the actual moat, and what a solo-operated Cloudflare
          stack makes possible that a venture-funded one cannot.
        </p>

        <ol className="divide-y divide-foreground/10">
          {posts.map((post) => (
            <li key={post.slug} className="py-6 first:pt-0 last:pb-0">
              <Link href={`/blog/${post.slug}`} className="group block">
                <time
                  dateTime={post.published}
                  className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70"
                >
                  {formatMonthDay(post.published)} · {post.readingMinutes} min read
                </time>
                <h2 className="mt-1.5 font-display text-xl leading-tight tracking-tight text-foreground md:text-2xl group-hover:underline group-hover:underline-offset-4">
                  {post.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{post.description}</p>
              </Link>
            </li>
          ))}
        </ol>

        <p className="mt-12 text-xs text-muted-foreground/70">
          New essays land here first, then get linked from <Link href="/" className="underline underline-offset-4 hover:text-foreground">the landing page</Link> footer.
        </p>
      </main>
    </>
  );
}
