import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Legacy alias for the password-reset entry point. Older reset emails linked
 * to `/reset?token=…`; the canonical flow lives at `/onboard?reset=…`. Forward
 * the token along so those links keep working, and fall back to sign-in when
 * no token is present.
 */
export default async function ResetAliasPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (token) redirect(`/onboard?reset=${encodeURIComponent(token)}`);
  redirect("/onboard?mode=login");
}
