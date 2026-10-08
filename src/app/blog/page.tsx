import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PageShell } from "@/components/page-shell";
import { SiteFooter } from "@/components/site-footer";
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
    <PageShell center={false} wide="prose" rule>
        <Eyebrow className="mb-3">Field Notes</Eyebrow>
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

        {/* Reading is the warm end of the funnel — offer the next step here,
            not only in the header. */}
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <p className="font-display text-lg text-foreground">Try the questions on your own life.</p>
          <Link href="/onboard?mode=signup" className="btn-focal px-7 py-3 text-sm font-semibold">
            Start free
          </Link>
        </div>

        <p className="mt-12 text-xs text-muted-foreground/70">
          New essays land here first, then get linked from <Link href="/" className="underline underline-offset-4 hover:text-foreground">the landing page</Link> footer.
        </p>
    </PageShell>
    <SiteFooter />
    </>
  );
}
