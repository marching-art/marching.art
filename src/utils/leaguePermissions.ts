// src/utils/leaguePermissions.ts
// Client mirror of functions/src/helpers/leaguePermissions.js.
//
// The commissioner check used to be written inline as `league.creatorId ===
// userId` in every component that needed it. With co-commissioners that is no
// longer the rule, and a component still using the old test would hide controls
// from someone the backend will happily let through — the worst kind of
// permission drift, because it looks like a bug in the feature rather than in
// the check.
//
// The two tiers, and why: only the OWNER can hand the league over or change who
// the co-commissioners are, because a co-commissioner who could do either could
// take the league over from the inside. Everything else is open to any
// commissioner.

export interface LeagueLikePermissions {
  creatorId?: string;
  commissioners?: string[];
  members?: string[];
}

/** The one director who owns the league. */
export function isLeagueOwner(
  league: LeagueLikePermissions | null | undefined,
  uid: string | undefined
): boolean {
  return Boolean(uid) && league?.creatorId === uid;
}

/** Anyone who can run the league day to day. */
export function isLeagueCommissioner(
  league: LeagueLikePermissions | null | undefined,
  uid: string | undefined
): boolean {
  if (!uid || !league) return false;
  if (league.creatorId === uid) return true;
  return Array.isArray(league.commissioners) && league.commissioners.includes(uid);
}

/** Everyone with commissioner powers, owner first, de-duplicated. */
export function listCommissioners(league: LeagueLikePermissions | null | undefined): string[] {
  const extras = Array.isArray(league?.commissioners) ? league!.commissioners! : [];
  return [...new Set([league?.creatorId, ...extras].filter(Boolean))] as string[];
}
