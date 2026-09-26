/**
 * Pure, dependency-free helpers for invitation status. Kept out of
 * `connections.ts` (which imports next/server) so it can be unit-tested in a
 * plain node environment.
 */

/**
 * An accepted invitation only stands for a live connection while a
 * relationship backs it. If the invitee deletes their account, the
 * relationship row cascades away but the sender's `invites` row (keyed by
 * owner + email text, not the invitee's id) survives — leaving a ghost
 * "Accepted" entry for a person who is gone. `peerEmails` is the set of
 * still-connected emails derived from live relationships; an accepted invite
 * to an address outside it has lapsed.
 */
export function isLapsedInvite(
  status: string,
  email: string,
  peerEmails: ReadonlySet<string>,
): boolean {
  return status === "accepted" && !peerEmails.has(email.toLowerCase());
}
