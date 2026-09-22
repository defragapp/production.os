export const dynamic = "force-static";

export function GET() {
  return new Response(
    "Contact: mailto:sovereign@defrag.app\n" +
      "Expires: 2027-09-22T00:00:00.000Z\n" +
      "Canonical: https://sovereign.defrag.app/.well-known/security.txt\n" +
      "Preferred-Languages: en\n" +
      "Policy: https://sovereign.defrag.app/terms\n",
    {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    },
  );
}