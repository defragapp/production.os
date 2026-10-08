import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PageShell } from "@/components/page-shell";
import { SiteFooter } from "@/components/site-footer";
import { BLOG_POSTS, getPost, type BlogSection } from "@/content/blog";

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

function formatMonthDay(iso: string) {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  return dt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Not found" };
  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.published,
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.description },
  };
}

function Section({ section }: { section: BlogSection }) {
  if (section.kind === "h2") {
    return (
      <h2 className="mt-10 mb-3 font-display text-2xl font-normal leading-tight tracking-tight text-foreground md:text-[1.75rem]">
        {section.text}
      </h2>
    );
  }
  if (section.kind === "ul") {
    return (
      <ul className="my-5 space-y-2 pl-5 text-base leading-7 text-muted-foreground marker:text-foreground/60">
        {section.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  }
  return (
    <p className="mt-4 text-base leading-7 text-muted-foreground md:text-[1.05rem] md:leading-8">
      {section.text}
    </p>
  );
}

export default async function BlogArticle({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <>
    <PageShell center={false} wide="prose" rule>
        <Link
          href="/blog"
          className="tap-line mb-6 inline-flex items-center gap-1 text-muted-foreground/80 hover:text-foreground"
        >
          <Eyebrow as="span">← Field Notes</Eyebrow>
        </Link>

        <article>
          {/* <time> stays for the machine-readable publish date; the label's
              look still comes from the single <Eyebrow> recipe. */}
          <time dateTime={post.published}>
            <Eyebrow as="span" className="text-muted-foreground/70">
              {formatMonthDay(post.published)} · {post.readingMinutes} min read
            </Eyebrow>
          </time>
          <h1 className="mt-3 font-display text-4xl font-normal leading-[1.08] tracking-tight text-foreground md:text-[3rem]">
            {post.title}
          </h1>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">{post.description}</p>

          <div className="mt-8">
            {post.sections.map((s, i) => (
              <Section key={i} section={s} />
            ))}
          </div>

          <div className="mt-12 border-t border-foreground/10 pt-6 text-sm text-muted-foreground">
            <p>
              Written for <Link href="/" className="underline underline-offset-4 hover:text-foreground">Sovereign OS</Link> — a private AI platform for understanding yourself and the people around you.{" "}
              <Link
                href="/onboard?mode=signup"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Start free
              </Link>
              .
            </p>
          </div>
        </article>
    </PageShell>
    <SiteFooter />
    </>
  );
}
