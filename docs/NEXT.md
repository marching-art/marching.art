# What's next — the living backlog

**This is the only file to read when deciding what to work on.** The audit
documents (`SITE_DEEP_DIVE_2026-07.md`, `CODE_ANALYSIS_2026-07.md`,
`LEAGUES_AUDIT_AND_PLAN.md`) are historical records: every ranked finding in
them has been actioned, and re-verifying them item by item is how a session
burns an hour to conclude "everything's about covered." Don't. If you ship,
cut, or discover something, edit THIS file in the same PR — that's the whole
maintenance contract.

_Last updated: 2026-09-03 (site-review row 14 — weekly XP / win bonus / finish bonus paid per director; row 13 — league weeks decided per show, percentile edge cases; row 12 — server-enforced age gate + consent-gated analytics; AI imagery now built from the full Uniform Studio design + rendered reference image; main ruleset + gazetteer PR flow; site-review Fix-first 1–11 + quick wins shipped)._

## In progress

_(nothing — pick from "Fix first" or the bets below)_

## Fix first — 2026-09 full site review (ranked top 20; each is one PR)

[SITE_REVIEW_2026-09.md](SITE_REVIEW_2026-09.md) is a fresh, independent,
code-first review of the whole product (security, backend, frontend, UX,
a11y, quality, economy, SEO/comms). Its **Part 1 backlog table** is the
queue: work it top-down, and tick items off here as they ship.

_(rows 1–14 — S-H1, B-H1, N-H1, F-H3, B-H3, G-H3, Q-H1, F-H2, F-H1, B-H4,
B-H6/S-M6, S-H2/S-H3, G-H2/G-M10, G-H1/G-H7 — and all eight "Cross-area quick
wins" shipped 2026-09-03; continue from row 15 (U-H4: one auto-interrupt per
Dashboard visit; move achievement/unlock to the inbox) of the Part 1 table.
Left open from G-H1's detail, outside row 14's scope: the league title still
sums a director's Finals night across every class (`leagueArchival.js`
`finalsByUid`) — decide it on a flagship class or the mean class percentile;
and `directorRating.js` placement points are uncapped by field size (a 1st of
2 pays the same 25 as a 1st of 40). Left open from row 8: the Dashboard
still reads the full recap archive once an hour for the ranked classes because
the Season Ledger joins per-show placement from it — store `eventName` on the
standings history entries and the ledger can read standings instead.)_

## Fix first — 2026-09-01 audit, P0/P1 (ranked; each is one PR)

Every item below was verified in source on `776cb43`. Severity: P0 = live
exposure or a crash on a hot path; P1 = real defect players/ops hit today.
Effort: S ≤ half a day, M ≤ two days, L = a week.

_(all 18 actioned — see Recently shipped; the lineup-privacy flip is now an
ops step below)_

## Audit backlog — P2/P3 by area (pick alongside a bet; batch the S ones)

### Security rules & data model

- **P2** `firestore.rules:270-276` owner profile update has no
  `affectedKeys().hasOnly([...])` allowlist — arbitrary junk keys up to the
  1 MiB doc cap, served world-readable. (M)
- **P2** SSRF: `triggers/avatarGeneration.js:77-100` follows redirects to any
  host (metadata endpoint, RFC1918) with four distinct error strings as an
  oracle. Reject private ranges per hop; collapse errors. (M)
- **P3** `firestore.rules:475-478,619-622,642-645,807-826` season/config docs
  are client-writable by admin with no field validation — a stolen admin
  session rewrites the season clock from a console. Route through
  callables. (M)
- **P3** `directorInfo.profileVisibility === 'members'` is honored only by
  the SSR `/d/` page (`helpers/publicProfilePages.js:72`), not by rules —
  don't ship a toggle until it is. (S)

### Backend reliability, scale & cost

- **P2** Sitemap cache doc will pass Firestore's 1 MiB limit at the
  configured caps (`triggers/sitemap.js:35,154,161`); the write failure is a
  `warn`, after which every hit regenerates from two collection-group scans.
  Sitemap index + paged children. (M)
- **P2** `leaderboard/season_rankings/data` is one uid-keyed map
  (`scheduled/lifetimeLeaderboard.js:162-169`) — 1 MiB cap in the low tens of
  thousands of players; fallback is the full scan at `users.js:357-370`.
  Shard, or store rank on the profile. (M)
- **P2** `lifetimeLeaderboard.js:133-137` materializes every profile
  (including `corps`) in memory via `processAllInPages` accumulation. Add a
  streaming variant; fold top-100 per page. (M)
- **P2** Isolated nightly stages swallow pre-lease failures
  (`dropDispatcher.js:692-724`, `dailyProcessors.js:52-92`) so the 4:30 AM
  watchdog sees nothing. Write a failure marker before swallowing. (S)
- **P2** `seasonScheduler.js:16-46` runs rollover with no `retryCount`, no
  try/catch, no alert; watchdog doesn't check `season_rollovers`. (S)
- **P2** Scraper: page loop can spend ~990 s against a 300 s timeout so
  `browser.close()` never runs (`functions-scraper/index.js:112-145`); no
  `maxInstances` on 2 GiB functions; `ignoreHTTPSErrors: true` at `:46`;
  `firebase-admin` initialized but unused. Wall-clock deadline, cap at 1-2
  instances, drop the flag and the dep. (S)
- **P3** `helpers/discord.js:134-145` webhook fetch has no timeout; it runs
  before scoring in `dailyProcessors.js:109,180`. `AbortSignal.timeout(10s)`. (S)
- **P3** `helpers/economyStats.js:34-68` is one subcollection query per user
  per week. Mirror ledger writes into a shared indexed collection. (M)
- **P3** `helpers/podium/store.js:72,120` empty catches silently drop the
  hot-tunable balance layer. `logger.warn`. (S)
- **P3** `helpers/weather.js:26` reads `OPEN_METEO_API_KEY` from
  `process.env` outside the `defineSecret` convention. (S)
- **P3** `callable/articleComments.js:236-243` hand-builds a namespaced path;
  use `paths.userProfile`. (S)
- **P3** Ledger entries without `balance`: `callable/seasonLadder.js:386-392`,
  `leaguePools.js:97`. (S)
- **P3** No uptime checks on the five public rewrite targets and no Cloud
  Monitoring alert on scheduled-job failure or error rate; only signal is
  `scoringWatchdog`. `scripts/setup-monitoring.sh` beside the backup script,
  routed to the `#operations` webhook; new OPERATIONS.md section. (M)

### Frontend correctness & performance

- **P2** `public/service-worker.js:239-257` `staleWhileRevalidate` resolves
  to `null` when offline with a cold cache (offline fallback unreachable);
  `maxAge` config at `:43-56` is never read, and version-keyed image/font
  caches purge on every deploy. (M)
- **P3** `api/leagues.ts:551-555` reads all of `matchupHistory` unbounded. (S)
- **P3** Dashboard full-recap read for Season Ledger placement (see the
  Fix-first note above): add `eventName` to `StandingsHistoryEntry` in
  `helpers/standingsMaterializer.js`, build the ledger's place index from
  standings, then pass `skipShows` for the ranked classes. (S)
- **P3** `index.jsx:43-53` has no SW update prompt while the SW
  `skipWaiting`s mid-session. (S)
- **P2** `vendor-firebase` is the largest eager chunk (671 kB / 198 kB
  gzip) — audit which `firebase/*` entry points the first paint really
  needs. (S)

### SEO, accessibility & UX

- **P2** 12 dialogs render `role="dialog" aria-modal` without `useFocusTrap`
  (`Profile/SettingsModal.jsx:361`, `Sidebar/StandingsModal.jsx:33`,
  `Sidebar/YouTubeModal.jsx:45`, `Leagues/CreateLeagueModal.tsx:120`,
  `Leagues/tabs/SettingsTab.tsx:75`, `Dashboard/OnboardingTour.jsx:195`,
  `pages/LeaguesParts.tsx:32`, `pages/CorpsHistory.jsx:784`, …). 32
  icon-only buttons have no accessible name (11 hand-rolled modal close
  buttons under `components/modals/`, `LeagueDetailHeader.tsx:82`, 8 in
  Admin). Dashboard and NotFound have no `<h1>`. This quantifies the
  `ui/Modal` adoption ratchet. (M)
- **P3** `a11y/RouteChangeFocus.tsx:24-33` scrolls `window` (a no-op under
  `game-shell-active`) and focuses `#main-content` before the lazy chunk
  resolves. (M)
- **P2** Deadlines render ET-only (`utils/seasonClock.js:393-425`); push
  digest fires at fixed 08:00 ET (`scheduled/pushNotifications.js:358-362`,
  5 AM Pacific) with no per-user zone anywhere in the profile. Store an IANA
  zone at signup; render viewer-local with ET in parentheses. (M)
- **P2** Daily challenge pool is three items, two served per day, two
  conditionally unavailable (`helpers/dailyChallenges.js:87-133`) — a new
  leagueless director sees one repeating task. Grow to 6-8 verifiable
  verbs. (M)
- **P2** No report control on league chat (`Leagues/tabs/ChatTab.tsx:73-80`
  admits it), profile comments, or instant-publish press releases; only
  article comments have one. Reuse `reportComment`. (M)
- **P2** Social proof is auth-gated: `SocialProofBar.jsx:104-116` counts hit
  auth-only collections, `CommunityPulse.jsx:60` returns null for guests.
  Nightly public `community_stats` doc. (S)
- **P3** An inviter cannot cancel a pending league invitation — the former
  `rescindLeagueInvitation` callable had no UI and was deleted (git history
  `b49f583^`); if wanted, ship it with a sent-invites list on the league
  Settings tab. (S)
- **P2** Showcase vote and Weekly Design Brief deadlines are visible only on
  `/exchange`; add a Director's Report row when a deadline is within ~48h
  (needs the showcase/brief state hooks the Exchange cards already use). (M)
- **P3** Between seasons the Schedule empty state has a CTA but still no
  date: the season doc is deleted at rollover, so nothing client-readable
  says when the next one opens. Publish a `nextSeasonStartsAt` on
  `game-settings/season` (or a sibling public doc) and render it there and
  on the dashboard. (S)
- **P3** No referral mechanic exists (zero hits for `referral`) despite share
  cards, program pages, and a Discord bridge — per-director code, CC to both
  sides on completed onboarding. (M)
- **P3** Streak milestones stop at 100 days (`engagementRewards.js:16-23`);
  season-ladder tier 12 (10,800 XP, `utils/seasonLadder.ts:30`) looks
  reachable only multi-class — instrument claim rate by class count. Rename
  "First Blood" / "Two Week Terror!" (`achievements.js:58`,
  `engagementRewards.js:19`) to marching idiom. (S)

### Legal & support

- **P2** Engagement emails ship no `List-Unsubscribe` /
  `List-Unsubscribe-Post` headers (`helpers/emailService.js:81-98`) and the
  only opt-out is login-walled (`:28`). Signed no-login `/unsubscribe`. (M)
- **P2** Terms never mention CorpsCoin (no cash value / non-transferable /
  forfeiture), §6 covers only corps names + show concepts, no governing law
  or copyright-notice path (`pages/Terms.jsx`). (M)

### CI/CD, hosting & dependencies

- **P2** No `permissions:` block on `ci.yml` / `deploy-hosting.yml`;
  `FirebaseExtended/action-hosting-deploy@v0` floating tag receives the
  service account; `firebase-tools` installed unpinned at deploy time
  (`deploy-functions.yml:197,417,464,636`). Least-privilege, SHA-pin,
  pin to the `firestore-tests` version. (S)
- **P2** `security.yml` is weekly `npm audit` only — no CodeQL, no
  `dependency-review-action` on PRs. (M)
- **P2** No www↔apex or trailing-slash redirects in either host config, and
  `checkHostingParity.mjs` doesn't compare redirects. (M)
- **P2** `firestore.indexes.json` is never deployed yet is a deploy-trigger
  path (`deploy-functions.yml:25`), and ~9 of 31 entries target collections
  that don't exist (`staff_auctions`, top-level `lineups`/`users`/`chat`/
  `trades`/`comments`). Prune; drop from the path filter; add an indexes
  diff step. (S)
- **P2** `firebase-admin` major drift: `functions/` on `^13`, scraper /
  `scripts/` / root on `^14`; `functions` `npm audit --omit=dev` reports 11
  transitive vulns (2 high, via `google-gax`/`uuid`) that the bump likely
  clears. `.npmrc` `legacy-peer-deps=true` hides the React 19 peer
  conflicts. (M)
- **P3** `hosting.ignore` doesn't exclude `**/*.map`, so hidden source maps
  are publicly fetchable (`firebase.json:36`, `vite.config.js:55`). (S)
- **P3** No root `engines` / `.nvmrc` (functions pin Node 22, `@types/node`
  is `^26`); `react-firebase-hooks` (unmaintained) exists for one
  `useAuthState`; React 18 → 19 has no explicit line item. (S)
- **P3** Four `workflow_dispatch`-only migration workflows are documented
  nowhere; ARCHITECTURE.md lists 5 of 9. Table + delete the finished ones. (S)

### Repo hygiene, DX & test posture

- **P2** Every e2e spec is unauthenticated (`e2e/*.spec.ts`); the auth
  emulator is wired (`e2e/firebase.json:4`) but no signed-in journey exists.
  One authed core-loop spec (register → lineup → shows → league). (M)
- **P2** Frontend coverage floor lags reality by 13 points: actual 28.9 /
  22.9 / 25.0 / 28.8 (stmts/branches/fns/lines) vs floor 15.9 / 12.5 /
  13.3 / 15.8 in `vite.config.js:145-150`, and it is global-only — add
  per-glob floors for `src/utils/**` and `src/api/**`. (S)
- **P2** Money and abuse-control helpers with no direct tests:
  `helpers/leagueEconomy.js`, `helpers/rateLimit.js`,
  `helpers/leagueArchival.js`, `helpers/engagementRewards.js`,
  `helpers/xpCalculations.js`, `callable/seasonLadder.js`,
  `callable/dailyOps.js` claim/streak, `scheduled/lifetimeLeaderboard.js`. (M)
- **P3** `lint` has no `--max-warnings` (13 warnings today; the one CI
  signal without a ratchet); `e2e/**`, `scripts/**` match no ESLint block and
  `tsconfig.json` includes only `src`; no type-aware rules
  (`no-floating-promises`) in a codebase that is almost all async I/O. (M)
- **P3** Nine backend files and seven frontend files sit past the 700-line
  `max-lines` warning beyond the two league components already listed:
  `helpers/scoring.js` (1215), `callable/leagues.js`, `callable/lineups.js`,
  `triggers/newsGeneration.js`, `helpers/podium/{processor,career}.js`,
  `triggers/newsSubmissions.js`, `callable/corps.js`, `callable/admin.js`;
  `uniform/uniformFigureParts.tsx`, `Schedule/ShowRegistrationModal.jsx`,
  `pages/Onboarding.jsx`, `hooks/useTickerData.ts`,
  `pages/GuestDashboard.jsx`, `pages/CorpsHistory.jsx`,
  `uniform/StudioEditor.tsx`. Split by concern when next touched. (L)
- **P3** Hygiene: `paydown-cleaned.txt` (empty, tracked) — delete;
  `.gitignore:71` `/admin# React build` is one literal pattern;
  `.runtimeconfig.json` is a tracked UTF-16 Gen-1 leftover;
  `functions/pressboxImporter/output/*.json` is 5.2 MB (~25% of the tree)
  for a dispatch-only job; `scripts/{inspectDatabase,deepInspect}.js`
  require a local service-account key and are referenced nowhere;
  `.env.production.example:19` documents an unused `VITE_YOUTUBE_API_KEY`. (S)
- **P3** Docs: `docs/UNIFORM_STUDIO.md:3` still says "PROPOSED" for a shipped
  system; `GAMIFICATION.md` faucet table and the "800–1,200 CC/week" /
  "~56,250 CC catalogue" figures predate the Studio economy; Journey is
  documented as 9 steps (code has 8); `GAMEPLAY.md` / `captionPricing.js:269`
  / `showSelection.js:29` / `howToPlaySections.jsx:151` give three different
  week-7 show caps; README's doc table omits NEXT.md and four feature docs;
  no `LICENSE`, `SECURITY.md`, or `CONTRIBUTING.md`. (S)

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
- **Referral loop** (from the audit above) — the cheapest growth mechanic the
  site lacks; reuses the invite-code plumbing.

## Operational — owner only, standing until done

- **Import the `main` ruleset** (Settings → Rules → Rulesets → New ruleset ▾
  → Import a ruleset → `.github/rulesets/main.json`, or the `gh api` line in
  `.github/rulesets/README.md`). Until it is imported, a PR can still be
  merged before its CI finishes (#1490 landed red on main that way) and the
  gazetteer refresh's PR could be merged without checks. Then confirm the
  next PR shows the seven jobs as required.
- **Re-score the Overture nights scored on hash-ordered history (days 19–23,
  2026-08-27 → 08-31).** The `historical_scores` sharding (a103c8f) returned a
  year's events in document-id order; the projection model read its season
  anchors off the list ends and swung projected captions by up to ±2 points
  (a director with Cadets 2013 ×3 in music posted 21 vs. the 25.5 their
  dashboard showed). Fixed at the read layer and in the model (this PR);
  every projected caption from those five nights is still wrong in
  `fantasy_recaps`, standings and the caption ledger. Decide whether to
  reprocess them with the admin force-rescore (it rewrites recaps, coin and
  XP awards are ledger-idempotent) or leave them and announce; either way
  reply to the Discord report. Real-score nights (day 22 for Cadets 2013)
  were never affected.
- **Flip App Check enforcement**: the CSP fix that was blocking attestation
  shipped 2026-09-01 (needs a hosting deploy). Once live, check Firebase
  console → App Check metrics for Functions; once real traffic shows verified, flip the literal
  in `functions/index.js` (`enforceAppCheck: false → true`) and run a full
  deploy. Flipping blind locks out clients on stale cached bundles.
- **Flip lineup privacy** (production credentials required; two steps, in
  order). The public mirror (`profile/public`, `triggers/profileMirror.js`)
  ships with the next functions deploy and the client already reads it, but
  profiles that predate the trigger have no mirror until they are next
  written. (1) `cd functions && node src/scripts/backfillPublicProfiles.js
--dry-run`, then `--commit`. (2) In `firestore.rules`, change
  `match /profile/data { allow read: if isAuthenticated();` to
  `allow read: if isOwner(userId) || isAdmin();`, update the two
  `profile/data` read assertions in `firestore-tests/rules.test.mjs`
  (third-party read must now FAIL), drop the raw-doc fallbacks in
  `src/api/profile.ts getPublicProfile` and `src/api/leagues.ts
getMemberProfiles`, and add a changelog entry ("your lineup is now private
  to you"). Until (2) lands, lineups remain readable by any signed-in
  director, as before.
- **Unfreeze stale league matchups** (production credentials required):
  `node functions/src/scripts/archiveStaleLeagueMatchups.js --dry-run`, read
  the output, then `--commit`.
- **Set the `VITE_FIREBASE_STORAGE_BUCKET` repository secret to
  `marching.art`** (the domain-verified GCS bucket; the project has no
  Firebase default bucket). `firebase.json`, `mediaService.js` and the env
  examples already name it. On the next Deploy Cloud Functions run,
  `scripts/deployStorageRules.mjs` links the bucket to Firebase and ships
  `storage.rules`; if it prints a `::warning::` instead, use "Import bucket"
  on console.firebase.google.com/project/marching-art/storage or grant the
  deploy SA the Firebase Admin role, then re-run with
  `deploy_target=rules-only`.
- **Prune dead Firestore indexes** in the console after the
  `firestore.indexes.json` cleanup (indexes are deliberately not deployed
  from CI).

## Evergreen ratchets (any session, any size)

- `@ts-nocheck` paydown — **78 files** at
  last update; `npm run ts-nocheck:next` ranks the cheapest (no free wins
  left; `Schedule.jsx` and `Layout/GameShell.jsx` are ~30 errors each). One
  per substantive task is the CLAUDE.md habit; batches welcome.
- Frontend coverage floor upward — actual is ~29% statements against a
  15.9% floor; raise the floor to within a point of actual whenever it's
  touched (functions are held to 70/80/85).
- ESLint warnings downward — 14 today, no ceiling yet (see DX above).
- React Query migration of the remaining manual-fetch components.
- `ui/Button` / `ui/Modal` adoption; authed-app axe pass (12 untrapped
  dialogs + 32 unlabeled icon buttons is the current tally).
- The two 700+-line league components (`MatchupsTabParts.tsx`,
  `MatchupDetailView.tsx`) want a split by concern — not by size — when
  next touched; sixteen more files are past the line (list above).

## Recently shipped (context, newest first — prune when stale)

- 2026-09-03: site-review row 14 (G-H1 / G-H7). Weekly participation XP is
  one grant per director (`payWeeklyParticipationXP`, no `× classes.size`).
  The weekly-win CC + XP bonus is paid once per class per week across every
  league won: new league-less `weeklyWinBonusToken` guards the money, the
  per-league `weeklyWinToken` still guards the `stats.leagueWins` record, and
  a per-run set catches later leagues in the same batch; `awardTokenWrite`
  is variadic. Season finish bonus + completion XP are paid once per director
  for the best-placed corps (`keepBestSeasonAward`; other rows keep placement
  with zero bonus). Earning-opportunities copy, GAMIFICATION tables and the
  client XP guide say so. `ControlBar.jsx` typed (ts-nocheck 79 → 78).
  Changelog entry added.
- 2026-09-03: site-review row 13 (G-H2 / G-M10). A league week is measured
  per show: `buildWeeklyScoreIndex` folds `average` and `perShow` caption
  averages beside the sums, the default format decides on `average` (equal
  averages → fuller week → tie), Caption Wars compares `perShow` and stores
  per-show figures in the `captions` block, and `applyClassPercentiles` ranks
  on the average with mid-rank ties (two level at the top of ten = 95, not
  100 each) and a lone entrant at `LONE_ENTRANT_PERCENTILE` (50). Matchups
  and standings pairs carry `averages` / `player1Average`; notifications quote
  "averaging X – Y per show"; the card and detail view lead with the average
  and show the total underneath; the client's provisional table
  (`buildWeeklyClassAverages`) reads a live week the same way. One-Night
  Slate unchanged. Spec §4 updated. `ActiveLineupTable.jsx` typed (ts-nocheck 80 →
  79). Changelog entry added.
- 2026-09-03: site-review row 12. S-H2: `createUserProfile` refuses a new
  profile without a valid date of birth (`failed-precondition`,
  `reason: birth_date_required`; idempotent retries for an existing profile
  still no-op; 6 tests in `createUserProfile.test.js`), the callable type
  makes `birthDate` required, and the onboarding welcome step asks for it
  when the per-tab sign-up stash is gone; server DOB verdicts route back to
  step 1. S-H3: Google Analytics is consent-gated — `utils/analyticsConsent`
  (localStorage `ma:analyticsConsent`, cross-tab, `useAnalyticsConsent`),
  `api/analytics` creates the SDK only on grant and flips
  `setAnalyticsCollectionEnabled` off on withdrawal, `AnalyticsConsentBanner`
  asks once per browser, Settings → Privacy toggle, Privacy §2/§5/§7 copy
  updated; unit tests for all three plus an e2e spec. `OnboardingSteps.jsx`
  typed (ts-nocheck 81 → 80). Changelog entry added.
- 2026-09-03: AI imagery reproduces the whole Uniform Studio design. New
  `helpers/uniformProse.js` walks every FIGURE_FIELDS key (torso/finish,
  chest + badge, neck, shoulders, waist, per-side arms and legs, feet,
  headwear, plume, cape) into a hex-pinned part-by-part spec that
  `getUniformDetailsFromDesign` exposes as `figureSpec`/`gloves`/`footwear`/
  `absent`/`guardSpec`; every prompt builder embeds it (`uniformSpecSection`)
  and the hardcoded "white gloves / black shoes" lines now defer to the
  design. Equipping sends a rasterized PNG of the figure (`utils/
uniformPreview.ts`) that `equipUniformDesign` re-hosts as `previewUrl`, and
  `helpers/uniformReference.js` attaches it (plus the guard's) as a captioned
  reference image on all five Gemini image call sites (avatar, Fantasy Daily,
  season summary, user-article, admin re-gen). `ArticleManagementParts.jsx`
  typed (ts-nocheck 83 → 82).
- 2026-09-03: `main` branch ruleset in the repo (`.github/rulesets/main.json`)
  requiring the seven CI jobs before merge, no deletes/force-pushes, no bypass
  — the `pull_request` CI run now gates the merge and the `push` run on main
  gates deploys (`ci.yml` header documents the two roles). The annual
  gazetteer refresh opens an `automated/venue-gazetteer` PR and dispatches CI
  on it (`ci.yml` gained `workflow_dispatch`) instead of pushing to `main`.
  `NextDeadlineChip.test.jsx` typed (ts-nocheck 84 → 83).
- 2026-09-03: site-review rows 8–11 + quick wins. F-H2: the Dashboard reads
  rank/score from the materialized standings (classFilter `all` for ranked
  classes, SoundSport keeps its own), skips every scores query on the Podium
  tab, no longer fetches archived seasons, and Recent Results observes the
  bounded `fantasyRecapsRecent` key (the 5-min override on the full-archive
  key is gone). F-H1: `landing_scores/{seasonUid}` written after each scoring
  run (`helpers/landingScoresMaterializer.js`, tests; public-read rule +
  tests); `useLandingScores` reads it and only falls back to the per-year
  fan-out when the doc is missing. B-H4: 8-char look-alike-free invite codes,
  `transaction.create` on `leagueInvites/{code}` in all three writers, and a
  dedicated 10-per-10-min `leagueJoinByCode` budget. B-H6/S-M6: `deleteAccount`
  uses `recursiveDelete` on the user subtree (600-notification test), aborts
  before the Auth delete if that fails, Privacy §8 lists what goes. Quick
  wins: draft-pool copy derives from `DRAFT_POOL_MAX_POINTS`; Podium marketing
  (hero card, How-to-Play section, footer + help-menu links) gated on
  `usePodiumEnabled()`, the guide shows a "not open right now" notice; three
  `<Navigate replace>`; pending deep link cleared only on `user === null`;
  league notification listener drops the un-indexed `in` filter; route change
  scrolls `<main>` too; `Input` wires `aria-describedby`/`aria-invalid`/
  `role="alert"` and the three auth error blocks are alerts; sitemap drops
  `/podium/preview`, `/login`, `/register`. Also fixed the five functions
  tests the previous batch merged red (bye ordering/expectations,
  `assertArticlePath` export). Changelog entry added.
- 2026-09-03: site-review Fix-first 1–7. Rules: new `corps.*` keys must be
  registry classes (`corpsKeysOk`, existing keys grandfathered; 3 rules
  tests); scorer + show-registration index skip unknown classes. `newsAdmin`
  callables accept only `news_hub/{s}/days/{d}/articles/{t}` paths
  (`assertArticlePath`, tests). Email opt-outs honor the Settings modal's
  camelCase keys (`EMAIL_PREFERENCE_MAP` / `isEmailTypeEnabled`, tests). The
  service worker reads FCM's `notification`/`data.url` payload (real
  title/body, deep link, one card per push type); dead
  `firebase-messaging-sw.js` deleted. Streak Freeze covers the next missed
  game day and is held up to 30 days (`helpers/loginStreak.js`, 9 tests;
  panel copy updated). Byes are non-games in standings (`byes` on the record
  and row; `leagueCareer` matches). Both deploy workflows wait for the CI run
  on the commit (`.github/actions/wait-for-ci`) on push events. Changelog
  entry added.
- 2026-09-03: audit backlog, SEO/UX + frontend-perf S batch: `/studio` and
  `/exchange` are `noindex` with their own canonical, and robots disallows
  them plus `/shop`, `/records`, `/achievements`; the sitemap lists corps
  program pages (`directorEntryFromProfile`, projected `corps.*.corpsName`
  only), is pinned to this namespace's `profile/data` docs (no mirror
  duplicates), and drops the bare `/podium` redirect; achievement, matchup
  and commissioner notifications deep-link to `/achievements`,
  `/leagues/{id}/matchups`, `/leagues/{id}/settings`; one support address
  (`support@`) in SiteFooter, SiteLinksMenu, the SSR results footer,
  Terms/Privacy and the restricted-account error; Schedule between-seasons
  CTA + no hard-coded year; invite copy never prints `undefined`; passive
  scroll/resize listeners, hoisted `TrendIndicator`, feature-flag listener
  released when unused, ref-counted Modal scroll lock (nested test).
  Changelog entry added. ts-nocheck → 87.
- 2026-09-02: the `functions-deploy/*` rollback tag is now created through
  the GitHub REST API (`gh api .../git/refs`) instead of `git push`. Every
  auto-deploy on `main` had been failing at "Tag deployed ref" with
  "refusing to allow a GitHub App to create or update workflow ... without
  `workflows` permission" — `GITHUB_TOKEN` can't be granted `workflows`, and
  the receive hook applies it to any new ref pushed by an App. Deploy plan /
  function list moved from the tag message to the run's step summary.
- 2026-09-02: projected caption scores no longer depend on archive order —
  `historicalScores.mergeEventLists` (server) and `utils/historicalEvents`
  (client) return every year chronologically, and `projectCaptionScore` sorts
  its own input, with an order-independence suite over the real 2013/2019
  corpus (`scoringMath.order.test.js`). Root cause of the 2026-09-01 Discord
  "music score 4.5 off my dashboard" report; re-score decision is the ops
  item above.
- 2026-09-02: audit backlog, frontend-correctness batch: `PageErrorBoundary`
  resets on path change and every public/auth/onboarding route has a
  boundary; `import.meta.env.DEV` replaces the client's only `process.env`;
  `friendlyCallableError` at the 14 player-facing toast sites; landing
  social-proof caches moved into React Query (cleared on sign-out);
  `profileStore` skips metadata-only snapshots and lost the caller-less
  `updateProfile`; `MatchupDetailView` dropped from the barrel so its lazy
  split lands; `paths.features()`; `authErrorMessage` replaces four
  hand-rolled auth switches; `utils/economyMirrors.test.ts` pins the four CC
  mirrors to server source; onboarding quotes the real 1,000 CC grant
  (`NEW_DIRECTOR_CORPSCOIN`, also the welcome-email default) and the right
  Championship-week caption rule. Changelog entry added. ts-nocheck → 90.
- 2026-09-02: audit backlog, security-rules batch (all S items + the rules
  test-coverage M): comment edits are body-only and bounded; `private/**`
  owner writes are limited to the FCM token keys (no delete); the `articles`
  collection group is scoped to `news_hub` (get by path, list by
  `isPublished`); `directorInfo.yearsDirecting`/`specialties` are typed and
  capped; `submitPrediction` validates pick + class against the canonical
  sets; `assertDocId` on every interpolated league/pool/joint id;
  `getRecentNews` rejects bad cursors as `invalid-argument` and budgets the
  cursored branch per uid/IP; `checkUsername` needs auth + the profile
  budget; `castFanFavoriteVote` honors restriction. 42 new rules tests (190
  total), 13 new functions tests. ts-nocheck → 91.
- 2026-09-01: audit fix 1 (mirror half) — `profile/public` projection
  (`helpers/publicProfileMirror.js`, allowlist + corps denylist, tests),
  `onProfileDataWritten` trigger, `backfillPublicProfiles.js`, rules + rules
  tests, and every cross-director client read (`useProfile` public view,
  league rosters, hosted-event names) now prefers the mirror. The rules flip
  is the ops item above.
- 2026-09-01: audit fixes 16 + 18 — sign-up asks for a date of birth
  (client + server `ageGate` with a parity test; attestation recorded on the
  private doc), Privacy policy rewritten for today's processors, generated
  content, Discord republication, integrity checks, retention, GDPR/CCPA;
  onboarding distinguishes "between seasons" from a fetch failure and lets
  the director found a corps without a lineup.
- 2026-09-01: audit fix 17 — `deploy-functions.yml` has a queued (never
  cancelled) concurrency group.
- 2026-09-01: audit fix 15 — `streakAtRiskPushJob` (7 PM ET): inbox entry
  - opt-out push for directors whose streak is alive but unclaimed, deep
    linked to the now-routed `/dashboard?panel=streak`; Settings toggle;
    changelog + GAMIFICATION note.
- 2026-09-01: audit fix 14 — the offline lineup queue keeps a save on
  transient replay failures (timeouts, `unavailable`, `internal`), dequeuing
  only on a decisive backend code or after five tries; 6 new tests.
- 2026-09-01: audit fixes 12–13 — erasure rewrites of recap days are
  stamped and the news trigger bails on them (plus `maxInstances: 2`);
  `processAllInPages` takes a `concurrency` option and the three league
  jobs run 20 leagues at a time instead of a whole 500-league page.
- 2026-09-01: audit fix 11 — Exchange saves check `assertNotRestricted` and
  only pay the creator when the saver's account is a few days old (copy and
  counter unaffected); `assertNotRestricted` accepts a preloaded profile.
  Changelog (balance) entry added.
- 2026-09-01: audit fix 10 — Uniform Studio + Design Exchange added to the
  shared Explore links (desktop menu, signed-in header, mobile More sheet);
  prefetch map covers `/studio`, `/exchange`, `/guide`, `/updates`.
- 2026-09-01: audit fix 9 — deep links survive the whole auth funnel: the
  bounced route is stashed per tab (`lib/pendingRedirect`), honored by the
  landing sign-in, `/login`, `/register`, and consumed at onboarding
  completion; cleared on arrival and on sign-out. Changelog entry added.
- 2026-09-01: audit fix 8 — both registration screens derive class budgets
  and unlock levels from the class registry (`CLASS_TABLE`), with a test
  pinning them to the JSON; changelog entry added.
- 2026-09-02: Deploy Cloud Functions no longer dies on the missing Firebase
  default bucket. Storage now targets the domain-verified `marching.art`
  bucket: named in `firebase.json` (array form, so the CLI skips the
  default-bucket lookup), used by `mediaService.js` uploads, and linked to
  Firebase by `scripts/deployStorageRules.mjs` (REST `addFirebase`) before
  the rules deploy — which warns instead of failing if it can't.
  `ProfileDoc.displayName` is typed; ts-nocheck 90 → 89.
- 2026-09-01: audit fix 7 — eight caller-less callables deleted
  (`getPublicProfile`, `getLineupAnalytics`, `rescindLeagueInvitation`,
  `migrateUserProfiles`, `updateRivalsNow`, `refreshScheduleWeatherNow`,
  `refreshScheduleRunningOrderNow`, `regenerateAllAvatars`; the index.js edit
  forces a full deploy, which prunes them); `adminRemoveExchangeDesign` now
  has an admin takedown button on the Exchange.
- 2026-09-01: audit fix 6 — `consumeRateBudget` is transactional; a same-uid
  burst now denies instead of admitting every call (5 new tests).
- 2026-09-01: audit fixes 3–5 — `storage.rules` now deploys with the
  Firestore rules; CSP admits reCAPTCHA/App Check on both hosts; production
  error reports go to a new same-origin `/api/errors` function
  (`triggers/clientErrors.js` → Cloud Logging → Error Reporting) with the
  commit SHA stamped as the release.
- 2026-09-01: audit fix 2 (enumeration half) — `profile/data` read now
  requires auth; the `profile` collection group is admin-only (league rosters
  fetch members by path); `usernames` is get-only, never listable. 7 new
  rules tests (148 total). ts-nocheck → 94.
- 2026-09-01: audit fix 1 — `/api/news` cache HIT now returns (regression
  test added); ts-nocheck 96 → 95.
- 2026-09-01: **full-site audit** (rules, backend, frontend, CI, product,
  legal) folded into this file — 18 P0/P1 items in "Fix first", ~70 P2/P3
  by area. Baseline at audit time: typecheck clean, lint 0 errors / 13
  warnings, 1339 app tests + 2283 functions tests green, root `npm audit`
  clean, functions `npm audit` 11 transitive.
- 2026-09-01: **corps program pages** shipped (`/d/{username}/{class-slug}`
  SSR pages + OG cards + profile links); docs-honesty pass; NEXT.md created;
  ts-nocheck 106 → 96.
- 2026-08-31: cross-class matchups (audit A8 closed — leagues audit fully
  done); One-Night Slate league format; commissioner close unified onto the
  shared decision rule; `/styleguide` dev-only; root `sharp` dropped;
  design-census gate fixed (Newsroom amber → warning token).
- 2026-08: Uniform Studio blitz (design houses, Exchange, Showcase); Newsroom
  in-review; league invite-code fix.
