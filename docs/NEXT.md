# What's next — the living backlog

**This is the only file to read when deciding what to work on.** The audit
documents (`SITE_DEEP_DIVE_2026-07.md`, `CODE_ANALYSIS_2026-07.md`,
`LEAGUES_AUDIT_AND_PLAN.md`) are historical records: every ranked finding in
them has been actioned, and re-verifying them item by item is how a session
burns an hour to conclude "everything's about covered." Don't. If you ship,
cut, or discover something, edit THIS file in the same PR — that's the whole
maintenance contract.

_Last updated: 2026-09-02 (audit backlog: security-rules + frontend-correctness batches shipped)._

## In progress

_(nothing — pick from "Fix first" or the bets below)_

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
  use `paths.userProfile`. `triggers/sitemap.js:172-177` director scan has
  no namespace filter (advertises `/d/` URLs that 404). (S)
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
- **P3** Non-passive scroll listeners with forced layout in
  `ui/DataTable.tsx:213-232`, `scores/PillTabControl.tsx:37-52`;
  `TrendIndicator` defined inside render at `Layout/GameShell.jsx:341`;
  `hooks/useFeatures.js:21-42` listener never unsubscribes. (S)
- **P3** `ui/Modal.tsx:72-81` body scroll lock has no ref count for nested
  modals; `index.jsx:43-53` has no SW update prompt while the SW
  `skipWaiting`s mid-session. (S)
- **P2** `vendor-firebase` is the largest eager chunk (671 kB / 198 kB
  gzip) — audit which `firebase/*` entry points the first paint really
  needs. (S)

### SEO, accessibility & UX

- **P2** `pages/Studio.tsx:70-73`, `pages/Exchange.tsx:127-130` call `useSEO`
  without `path` → canonical is the homepage; neither is in `robots.txt`
  Disallow (nor `/shop`, `/records`, `/achievements`). `noindex` + robots. (S)
- **P2** Program pages `/d/{username}/{class-slug}` are not in the sitemap
  (`triggers/sitemap.js:111-116`); `/podium` is listed but is a bare
  redirect (`App.jsx:372`). (S)
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
- **P2** Dead/weak deep links: achievements notifications go to
  `/profile?tab=achievements` (`callable/dailyOps.js:314,324`; Profile has
  no `tab` handler); commissioner-promotion notifications have no `link`
  (`callable/leagueAdmin.js:310,416`); weekly matchup push links `/leagues`
  not the league. (S)
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
- **P3** `Schedule.jsx:247-270` off-season empty state has no date/CTA and a
  hard-coded `'2025'`; Podium has no nav entry (`ControlBar.jsx:147`); invite
  copy toasts can print `Code: undefined` (`Leagues/tabs/SettingsTab.tsx:241`). (S)
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
- **P2** Restricted accounts are told to "contact an administrator"
  (`helpers/callableGuards.js:189-192`) but no `/support` route or footer
  contact exists; Privacy/Terms say `contact@`, outgoing mail replies to
  `support@` (`emailService.js:26`). Pick one; put it in the footer. (S)

### CI/CD, hosting & dependencies

- **P2** No `permissions:` block on `ci.yml` / `deploy-hosting.yml`;
  `FirebaseExtended/action-hosting-deploy@v0` floating tag receives the
  service account; `firebase-tools` installed unpinned at deploy time
  (`deploy-functions.yml:197,417,464,636`). Least-privilege, SHA-pin,
  pin to the `firestore-tests` version. (S)
- **P2** `security.yml` is weekly `npm audit` only — no CodeQL, no
  `dependency-review-action` on PRs. (M)
- **P2** `refresh-venue-gazetteer.yml:91` pushes generated files straight to
  `main`, bypassing PR CI and triggering both deploys. Open a PR instead. (S)
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
- **Deploy `storage.rules` once** after the "Fix first" storage-rules item wires it into the
  workflow; confirm in the console that the bucket no longer runs the
  permissive defaults.
- **Prune dead Firestore indexes** in the console after the
  `firestore.indexes.json` cleanup (indexes are deliberately not deployed
  from CI).

## Evergreen ratchets (any session, any size)

- `@ts-nocheck` paydown — **90 files** at
  last update; `npm run ts-nocheck:next` ranks the cheapest (no free wins
  left; cheapest is 10 errors in `Articles/ArticleSidebarAuth.jsx` and
  `scripts/buildPodiumCurves.js`). One per substantive task is the CLAUDE.md
  habit; batches welcome.
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
