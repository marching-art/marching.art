# What's next — the living backlog

**This is the only file to read when deciding what to work on.** The audit
documents (`SITE_DEEP_DIVE_2026-07.md`, `CODE_ANALYSIS_2026-07.md`,
`LEAGUES_AUDIT_AND_PLAN.md`) are historical records: every ranked finding in
them has been actioned, and re-verifying them item by item is how a session
burns an hour to conclude "everything's about covered." Don't. If you ship,
cut, or discover something, edit THIS file in the same PR — that's the whole
maintenance contract.

_Last updated: 2026-09-01 (program pages shipped)._

## In progress

_(nothing — pick from the bets below)_

## Product bets (owner-ranked; pick deliberately, they're design-heavy)

- **Third league format.** The roadmap promises Survivor- and Pick'em-style
  formats are "on the drawing board." Both are bigger than the two shipped
  formats: Survivor reshapes the season (elimination ≠ a matchup decider);
  Pick'em needs a new prediction-input surface. Write a spec against
  `docs/CAPTION_WARS_SPEC.md` §1's constraints before building.
- **Per-5-level cosmetic unlocks** — the last genuinely unbuilt piece of the
  progression loop (the celebration itself is wired).
- **Expanded Shop tiers** — uniform palettes/emblems, avatar-regeneration
  pricing.
- **Living retirement monuments** beyond plaques.
- **Dynasty meta-achievement set.**

## Operational — owner only, standing until done

- **Flip App Check enforcement**: check Firebase console → App Check metrics
  for Functions; once real traffic shows verified, flip the literal in
  `functions/index.js` (`enforceAppCheck: false → true`) and run a full
  deploy. Flipping blind locks out clients on stale cached bundles.
- **Unfreeze stale league matchups** (production credentials required):
  `node functions/src/scripts/archiveStaleLeagueMatchups.js --dry-run`, read
  the output, then `--commit`.

## Evergreen ratchets (any session, any size)

- `@ts-nocheck` paydown — **97 files** at last update; `npm run
ts-nocheck:next` ranks the cheapest. One per substantive task is the
  CLAUDE.md habit; batches welcome.
- Frontend coverage floor upward (functions are held to 70/80/85; frontend
  floor is far lower).
- React Query migration of the remaining manual-fetch components.
- `ui/Button` / `ui/Modal` adoption; authed-app axe pass.
- The two 700+-line league components (`MatchupsTabParts.tsx`,
  `MatchupDetailView.tsx`) want a split by concern — not by size — when
  next touched.

## Recently shipped (context, newest first — prune when stale)

- 2026-09-01: **corps program pages** shipped (`/d/{username}/{class-slug}`
  SSR pages + OG cards + profile links); docs-honesty pass; NEXT.md created;
  ts-nocheck 106 → 96.
- 2026-08-31: cross-class matchups (audit A8 closed — leagues audit fully
  done); One-Night Slate league format; commissioner close unified onto the
  shared decision rule; `/styleguide` dev-only; root `sharp` dropped;
  design-census gate fixed (Newsroom amber → warning token).
- 2026-08: Uniform Studio blitz (design houses, Exchange, Showcase); Newsroom
  in-review; league invite-code fix.
