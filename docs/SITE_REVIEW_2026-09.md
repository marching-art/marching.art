# marching.art — Full Site Review (September 2026)

An independent, code-first review of the whole product: frontend, backend,
security rules, game economy, UX, accessibility, SEO/communications, and
engineering quality. It deliberately does not build on the earlier audit
documents; every finding below was verified against the code at commit
`961cf35` on `main`, and each carries a `file:line` reference.

## How to read this

- **Part 1** is the executive summary and a single prioritised backlog across
  all areas (the "if you only fix twenty things" list).
- **Part 2** holds the detailed findings by area. Severity is per-area:
  _Critical_ = exploitable or money/trust-breaking now; _High_ = real user or
  cost impact today; _Med_ = degrades quality or will bite soon; _Low_ =
  hygiene.
- Quick-win lists at the end of each area are ≤1 hour each.

## Baseline (what is verifiably healthy)

All gates pass on `main` at the time of review:

| Gate                                         | Result                                           |
| -------------------------------------------- | ------------------------------------------------ |
| `npm run lint`                               | 0 errors, 14 warnings (all `no-explicit-any`)    |
| `npm run typecheck` (app + functions)        | clean                                            |
| `npm test` (vitest)                          | 121 files, 1,367 tests pass                      |
| `functions` unit tests                       | 2,337 tests pass                                 |
| Playwright e2e (unauthenticated smoke + axe) | 68 pass, 2 skipped                               |
| `npm run build`                              | OK; 165 JS chunks, 16 MB assets incl. sourcemaps |

Repo shape: 628 files under `src/` (204 ts, 159 tsx, 172 jsx, 86 js; 121 test
files), 251 non-test modules under `functions/src` with 180 test files, 157
callables, 43 scheduled jobs, 13 HTTP endpoints, 7 Firestore/Pub/Sub
triggers, 192 security-rules assertions. 89 files still carry `@ts-nocheck`.

Things that are genuinely well done and should be protected: server-authoritative
economy with transactional balance checks and per-user award ledgers;
lease-guarded nightly scoring with a watchdog; admin gated purely on a custom
claim; deny-by-default rules with a MapDiff protected-field guard and an
emulator regression suite in CI; consistent HTML/XML escaping on every
server-rendered public page; `timingSafeEqual` on the BMAC webhook; a design
census and `@ts-nocheck` ratchet that only fall.

---

# Part 1 — Executive summary and prioritised backlog

_(filled in at the end of the review — see the bottom of Part 2 for the raw
material)_

---

# Part 2 — Detailed findings by area

## A. Security, rules, config, and CI

### Posture as implemented

The SPA talks to Firestore directly for reads and a handful of owner-scoped
writes; every economy/progression mutation goes through callables. Admin is
determined solely by the `admin` custom claim (`firestore.rules:10`,
`functions/src/helpers/callableGuards.js:31`, `src/api/client.ts:216`).
Rules are deny-by-default with per-collection matches and a MapDiff-based
protected-field guard on `profile/data`. Storage is fully client-denied
(`storage.rules:31`). CSP/HSTS/XFO/nosniff are set identically on Vercel and
Firebase Hosting (`vercel.json:63-88`, `firebase.json:86-140`); there are no
inline scripts in `index.html`. No secrets were found in source or history.

Weak spots: economy guards that enumerate five class keys while the scorer
iterates all keys, App Check unenforced, a privacy page whose consent and
deletion claims outrun the code, an optional server-side age gate, and CI
patterns (long-lived SA JSON, unpinned actions, `${{ inputs }}` in shell).

### Findings

**High**

- **S-H1 · A client can add an unguarded `corps.<anyKey>` with a lineup and
  `selectedShows`, and the scorer scores it.** `firestore.rules:159-190`
  (`touchesProtectedCorpsFields`) only inspects
  `worldClass/openClass/aClass/podiumClass/soundSport`. A write of
  `corps.fakeClass = {corpsName, lineup, selectedShows:{week3:[…every show]}}`
  passes. `functions/src/helpers/scoring.js:234` iterates
  `Object.keys(userCorps)` with no registry check;
  `showRegistrations.js:49` does the same for the public "who's attending"
  index. Impact: bypass of per-week show caps, forged entries in public recaps
  and the registration index (coin is 0 for an unknown class via
  `scoring.js:309`, so no minting). Fix: in the rule require
  `request.resource.data.corps.keys().hasOnly([...five classes])`; in the
  scorer skip keys not in `classRegistry`.
- **S-H2 · The age gate is client-only in practice.**
  `functions/src/callable/users.js:94-98`: `birthDate` is optional — absent →
  profile still created as "not attested". The Auth account exists before any
  server check (`Register.jsx:65-99` validates client-side then stashes the DOB
  in `sessionStorage`; `Onboarding.jsx:345` reads it back). Clearing
  sessionStorage or calling `createUserProfile` directly yields an account
  with no DOB, while `Privacy.jsx:321-323` and `Terms.jsx:66` promise no
  under-13 accounts. Fix: make `birthDate` required in `createUserProfile` and
  block onboarding without it.
- **S-H3 · The privacy policy says analytics is consent-based; GA initialises
  unconditionally.** `Privacy.jsx:225,289` vs `src/api/analytics.ts:17-25`
  (`getAnalytics(app)` on module import, no gate). `FEATURE_FLAGS.analytics`
  (`src/config/index.ts:196`) is never referenced; no consent UI exists. Fix:
  gate `getAnalytics` behind a stored consent flag (or
  `setAnalyticsCollectionEnabled(false)` until consent) and add a toggle in
  Settings.

**Medium**

- **S-M1 · `profile/data` is readable by any signed-in user despite carrying
  lineups/picks.** `firestore.rules:290-296`; the comment at `:270-279` and
  `publicProfileMirror.js:4-9` acknowledge lineups are meant to be secret from
  opponents and a `profile/public` mirror exists. Rules test #128 pins the
  leak. Fix: flip to `isOwner(userId) || isAdmin()` once backfill is
  confirmed; point rosters at `profile/public`.
- **S-M2 · App Check is not enforced.** `functions/index.js:47`
  `enforceAppCheck:false`; client only initialises when a site key is present
  (`client.ts:94-113`). Callables rely solely on `assertWriteBudget`. Fix:
  complete the monitor→enforce rollout, high-value callables first.
- **S-M3 · Anonymous sign-in code path shipped but unused.** `client.ts:172`,
  `App.jsx:253`; no UI caller. If the Anonymous provider is enabled in the
  console, anyone can mint an `isAuthenticated()` session and read every
  `profile/data` (S-M1). Fix: remove the path; confirm the provider is off.
- **S-M4 · No top-level key allowlist or size cap on owner profile writes.**
  `firestore.rules:296-299` guards specific keys; `textFieldOk` caps only five
  fields. An owner can write any new top-level key up to 1 MiB on a doc every
  signed-in client may read under a live listener. Fix:
  `request.resource.data.keys().hasOnly([...])` or a size guard on new keys.
- **S-M5 · SoundSport `corpsName`/`name` are client-writable with no length
  cap.** `corpsClassUntouched` (`:127-133`) guards `corpsName` only for the
  four named classes; `Onboarding.jsx:359-360` writes
  `corps.soundSport.corpsName` client-side. Names render in public recaps and
  feed Gemini prompts. Fix: freeze after creation, or cap size/charset.
- **S-M6 · `deleteAccount` leaves user subcollections behind.**
  `functions/src/callable/profile.js:365-370` deletes `corps`,
  `notifications`, `profile`, `private`; not `seasonDetail` (world-readable,
  `rules:311`), `captionLedger`, `wardrobe`, `podium`, `corpsCoinHistory`,
  `email_log`, `comments` (`functions/src/helpers/paths.js` lists all eleven).
  `Privacy.jsx:238-241` does not disclose the orphaned data. Fix:
  `recursiveDelete(userDocRef)` after the targeted anonymisations; update the
  policy. (See also B-H6 — the batch also overflows for active users.)
- **S-M7 · Workflow shell injection via `${{ inputs.* }}`.**
  `.github/workflows/deploy-functions.yml:447,449,459,599,634` interpolate
  `function_names`, `historical_import_args`, `archive_name_import_args` into
  `run:`. Fix: pass via `env:` and reference `"$VAR"`.
- **S-M8 · An automated workflow pushes directly to `main`, bypassing PR and
  CI.** `refresh-venue-gazetteer.yml:30` (`contents: write`), `:91`
  `git push origin HEAD:main`; `:53` installs `all-the-cities` unpinned at run
  time and harvests third-party content into a file `require`d by production
  functions. Fix: open a PR instead; pin the package.
- **S-M9 · One long-lived service-account JSON is the god-secret** for
  hosting, functions, rules, Secret Manager writes and five migration
  workflows (`deploy-functions.yml:224,252,332,441,488,522,556,593,628,657`).
  Fix: Workload Identity Federation with per-job SAs; deploys behind a GitHub
  Environment with required reviewers.
- **S-M10 · Actions pinned by mutable tag, not SHA** (all workflows;
  `FirebaseExtended/action-hosting-deploy@v0` at `deploy-hosting.yml:89`).
- **S-M11 · Missing workflow-level `permissions:`** in `ci.yml`,
  `deploy-hosting.yml`, and the top of `deploy-functions.yml`.
- **S-M12 · `public/firebase-messaging-sw.js` hard-codes a second Firebase
  config that disagrees with the app** (`:15-22`: sender `764429988123`,
  bucket `marching-art.firebasestorage.app`, compat SDK 10.7.0) vs
  `.runtimeconfig.json` appId `1:278086562126…` and `firebase.json:33`. The
  file is also never registered (see F-H3). Fix: delete it, or generate SW
  config at build from `VITE_FIREBASE_*`.

**Low**

- S-L1 · `seasonDetail` world-readable + `usernames` get-public
  (`rules:311-313`, `:772-776`): unauthenticated username→uid→archived full
  lineups. Consider `isAuthenticated()`.
- S-L2 · Profile `comments` world-readable including `authorUid`
  (`rules:325`).
- S-L3 · `comments` update leaves `updatedAt`/`edited` untyped
  (`rules:331-337`).
- S-L4 · Rules-test gaps (`firestore-tests/rules.test.mjs`): no case for
  S-H1, S-M4, S-M5, non-owner read of `private/data`, `profile/public` write
  denial, list-denial on `seasonDetail`/`podium`/`podium-fan/ballots`/
  `admin-stats`/`supporters`/`usernames`, or the `articles` group rule.
- S-L5 · `/api/errors` accepts cross-origin POSTs with no origin check
  (`functions/src/triggers/clientErrors.js:79-110`); behind the Vercel rewrite
  `req.ip` (`:106`) is Vercel's egress IP.
- S-L6 · `errorReporter` spreads `context` after fixed fields
  (`src/lib/errorReporter.ts:73-81`) so callers can override `url`/`release`.
- S-L7 · Service workers open push-supplied URLs without an origin check
  (`public/service-worker.js:341-356`).
- S-L8 · `CACHE_URLS` SW message caches arbitrary same-origin URLs on request
  (`service-worker.js:299-307`). Remove if unused.
- S-L9 · CSP has `style-src 'unsafe-inline'` and no `report-to`
  (`vercel.json:67`, `firebase.json:91`).
- S-L10 · Every callable sets `cors: true` (expected for callables; pair with
  S-M2).
- S-L11 · DOB held in `sessionStorage` between Register and Onboarding
  (`src/utils/ageGate.ts:52-60`); clear on failure paths too.
- S-L12 · `deploy-single`/`deploy-scraper` write the SA key without
  `trap … EXIT` (`deploy-functions.yml:443-463, 490-495`).
- S-L13 · `firestore.indexes.json` is never deployed
  (`deploy-functions.yml:343-345`); drift is unmonitored (and see F-M7).
- S-L14 · `scripts/inspectDatabase.js:4`, `deepInspect.js:4`
  `require('./serviceAccountKey.json')` — use ADC instead.
- S-L15 · `react-firebase-hooks@5.1.1` used only for `useAuthState`
  (`App.jsx:6`); effectively unmaintained. Replace with a 10-line hook.
- S-L16 · `firebase-admin` skew: functions `^13.10.0`, root/scripts/scraper
  `^14.3.0`.
- S-L17 · Accepted prod advisories in `scripts/audit-baseline.json`: root 2,
  functions 7, scraper 5, scripts 7. Needs a burn-down.
- S-L18 · Stray root files: `paydown-cleaned.txt` (empty),
  `.runtimeconfig.json` (tracked despite `.gitignore`, UTF-16 with BOM, stale
  appId). Delete both.
- S-L19 · ~6 MB of importer data committed under
  `functions/pressboxImporter/output/*.json` plus `venueGazetteer.json`
  (243 KB) shipped in the functions bundle.
- S-L20 · `signInWithCustomToken` exported but unused (`client.ts:179`).
- S-L21 · Legacy `fantasy_drum_corps_v1` leagues fully listable to any
  signed-in user (`rules:592`), including member UID arrays.
- S-L22 · `getCountFromServer` on `artifacts/fantasy_drum_corps_v1/users`
  (`src/api/community.ts:107`) is denied for non-admins (`rules:257`), so the
  stat silently fails.

### Quick wins

1. `keys().hasOnly([...classes])` on `corps` + registry check in
   `scoring.js:234` (S-H1).
2. Require `birthDate` in `createUserProfile` (S-H2).
3. Wrap `getAnalytics` in a consent check; wire `FEATURE_FLAGS.analytics`
   (S-H3).
4. `permissions: contents: read` at the top of every workflow; move
   `${{ inputs.* }}` into `env:` (S-M7, S-M11).
5. `trap 'rm -f /tmp/sa-key.json' EXIT` in `deploy-single`/`deploy-scraper`.
6. Delete `paydown-cleaned.txt`, `.runtimeconfig.json`,
   `public/firebase-messaging-sw.js`, and the anonymous/custom-token client
   paths.
7. Add rules tests for the S-L4 gaps — the unknown-class-key case first.
8. `recursiveDelete` the user tree at the end of `deleteAccount` and reword
   `Privacy.jsx:238-241`.

## B. Backend (Cloud Functions)

### Surface map

| Kind               | Count          | Where                                                                                                                                                                                                                                            |
| ------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `onCall` callables | 157            | `src/callable/*` (≈120), `src/triggers/news*.js` (18), avatar (3), scraping/schedule helpers (4), leaderboard/automation (2)                                                                                                                     |
| `onSchedule` jobs  | 43             | `src/scheduled/*` — scoring 2 AM ×2, drop dispatcher every 15 min 8 PM–2:45 AM, podium 9 PM, 5 league jobs, 6 push, 3 email, stats ×3, weather/running-order ×4, watchdog, canary, digest, reconcile, auto-publish, lifetime leaderboard, rivals |
| Pub/Sub triggers   | 5              | `scoreProcessing.js` (3), `scheduleProcessing.js`, `newsGeneration.processNewsGeneration`                                                                                                                                                        |
| Firestore triggers | 7              | recap updated, article→Discord, profile written/created, streak milestone, league member joined, league chat message                                                                                                                             |
| `onRequest` HTTP   | 8 (+1 scraper) | newsFeed, sitemap, og card, share, results, public profile, client errors, `bmacWebhook`; `scrapeUpcomingDciEventsHttp`                                                                                                                          |

Auth model: every callable passes `helpers/callableGuards.js` — `assertAuth`
and `assertAdmin` (custom claim, set only via `setUserRole`, `users.js:20-50`).
Podium callables share `podiumContext` (`podium.js:123-147`). The scraper
checks the claim inline and a shared secret with `timingSafeEqual`
(`functions-scraper/index.js:233, 265-281`). App Check is off. Abuse control
is a per-uid transactional window budget (`rateLimit.js`) that **fails open**
on any bookkeeping error (`rateLimit.js:60-68`), so every throttle is
advisory.

The economy core is solid: server catalogs for prices, balances read inside
`runTransaction`, scheduled awards guarded by `scoring_runs` leases
(`scoringRunGuard.js`) and per-user `awardLedger` tokens riding the same
write as the increment. The findings are at the edges.

### Findings

**High**

- **B-H1 · Admin article callables accept an arbitrary Firestore path → any
  doc read/update/delete.** `triggers/newsAdmin.js:126-158, 172-235,
250-276, 290-312` do `db.doc(path).get()/update()/delete()` with a
  client-supplied `path`. An admin token (or a leaked one) can delete
  `game-settings/season`, edit any profile's `corpsCoin`, or read
  `users/*/private/data`. Fix: reject unless `path` matches
  `news_hub/{s}/days/{d}/articles/{t}`.
- **B-H2 · `reportComment` stores attacker-controlled "evidence".**
  `callable/comments.js:104-141` writes `commentText` and `commentAuthorUid`
  straight from the request into `reports/`; a reporter can frame any uid with
  any text. Fix: read the comment server-side and snapshot the real
  text/author (as `reportArticleComment` already does,
  `articleComments.js:586-623`).
- **B-H3 · Streak Freeze (300 CC) almost never works.** `dailyOps.js:659`
  sets `streakFreezeUntil = now + 24h`; `:126` only protects if
  `now <= streakFreezeUntil` at the next claim; `:166` nulls the freeze on
  every claim. Buy Monday 10 AM → expires Tue 10 AM → a Wednesday login is
  unprotected; a Tuesday login wipes it unused. Fix: store the game day the
  freeze covers ("protects the next missed day") and don't clear an unused
  freeze. Changelog-worthy.
- **B-H4 · League invite codes can silently collide/hijack and are
  brute-forceable.** `helpers/leagueHelpers.js:14-19` mints 6 hex chars
  (16.7M space) with no uniqueness check; `leagues.js:212` and
  `rookieLeague.js:340` `transaction.set(inviteRef)` overwrite an existing
  `leagueInvites/{code}`. `joinLeagueByCode` (`leagues.js:360-379`) can be
  probed at 40/10 min per uid on a fail-open budget. Fix: `transaction.create`
  - retry, 8+ chars base32, tighter budget.
- **B-H5 · Unauthenticated cost amplification on public callables.**
  `articleComments.js:675-775 getArticleEngagement` (no auth/budget, up to 50
  `count()` aggregations + 2×50-doc `getAll` per call);
  `articleComments.js:304-411 getArticleComments`;
  `supporters.js:344-350 getSupportersWall` (reads up to 1000 docs per call,
  no cache). Fix: cache aggregates in a doc (as the news feed does), or
  require auth + budget, or key an IP budget like `newsCallerKey`
  (`newsFeed.js:24-28`).
- **B-H6 · `deleteAccount` breaks for active users.** `profile.js:374-435`:
  one `db.batch()` holds the profile + every `corps` + every `notifications`
  doc; notifications are unbounded, so >500 ops throws and deletion becomes
  impossible for exactly the most active accounts. Fix: `db.recursiveDelete`
  after the league detach (also closes S-M6).
- **B-H7 · `getShowRegistrations` lets any user trigger a full profile scan +
  junk writes.** `users.js:258-308`: a missing index doc for
  `(week, eventName, date)` triggers a `collectionGroup("profile")` scan and
  writes an index doc for whatever key was supplied; `week`/`eventName` are
  unvalidated (`:225`). Fix: validate `eventName` against
  `schedules/{season}` before the fallback.

**Medium**

- **B-M1 · Commissioner override never reverses/pays the weekly-win bonus.**
  `leagueResults.js:126-185` rewrites `winner` and standings, but
  `WEEKLY_LEAGUE_WIN_REWARD` + XP + `stats.leagueWins` paid to the original
  winner (`weeklyMatchups.js:250-274`) stay; the corrected winner is never
  paid.
- **B-M2 · Commissioner can close a week on partial scores.**
  `leagues.js:820-830` only rejects when `daysFound === 0`; completed
  matchups are never re-resolved (`:872`).
- **B-M3 · `generateMatchups`/`triggerMatchupGeneration` are non-transactional
  and under-validated.** `leagues.js:626-634` (`week`, `leagueId`
  unvalidated), existence check at `:670` then `set` at `:734` races the 6 AM
  generator. `leagueAutomation.js:428-433` `forceRegenerate` overwrites an
  already-resolved week, orphaning paid win bonuses.
- **B-M4 · Lineups are supposed to be secret, but `getActiveLineupKeys` hands
  out everyone's.** `lineups.js:698-761` returns raw
  `corpsClass_Corps|Year…` keys for every other director in the class;
  `firestore.rules:857` makes `activeLineups` backend-only and
  `publicProfileMirror.js:48` strips `lineup`. Return SHA-256 hashes.
- **B-M5 · `saveLineup` doesn't validate caption keys.** `lineups.js:45-47`
  checks only `Object.keys(lineup).length === 8`; arbitrary keys are stored,
  then `scoring.js:117-121 hasCompleteLineup` silently excludes the corps.
- **B-M6 · `saveShowConcept` stores unbounded free text that reaches Gemini
  prompts.** `lineups.js:459-489` (no cap on `theme/musicSource/drillStyle`)
  vs `corps.js:32-51` (caps at 100).
- **B-M7 · Predictions/pool buy-ins have no cut-off before results are
  knowable.** `dailyPredictions.js:90-153`, `leaguePools.js:27-108` accept
  picks/antes any time in the game day, but live DCI captions are public on
  dci.org hours before the 2 AM scoring. Lock at the first show's `startsAt`
  or drop-plan instant.
- **B-M8 · Non-atomic rate counters the codebase already fixed elsewhere.**
  `supporters.js:136-153 consumeLinkAttempt`, `youtube.js:36-59
consumeSearchBudget` are read-then-write; reuse `consumeRateBudget`.
- **B-M9 · `updateEmail` + BMAC linking trust chain.** `profile.js:280` sets
  the Auth email with no verification; `supporters.js:181-183` treats
  `email_verified` as proof to skip the guess budget. Fix:
  `updateUser({ email, emailVerified: false })`.
- **B-M10 · `retireCorps` validates in one transaction and writes in
  another** (`corps.js:456-516`); racing the nightly scorer lets a corps
  retire after it has competed.
- **B-M11 · Ledger entries are inconsistent**, so economy stats can't be
  trusted: ad-hoc `type` strings outside `TRANSACTION_TYPES` and no `balance`
  in `callable/leaguePools.js:100-105`, `helpers/leaguePools.js:177-183`,
  `dailyOps.js:250-270`, `dailyPredictions.js:290-295`, `journey.js:264-269`,
  `seasonLadder.js:74-78`, `podiumHost.js:120-126`, `prestige.js:90`.
- **B-M12 · Missing `assertDocId` on ids interpolated into paths:**
  `leagueRoster.js:111-124`, `leagueInvitations.js:143-159, 220-233`,
  `leagueAdmin.js:243-290`, `articleComments.js:427-447, 512-519, 568-586`,
  `comments.js:16-52`, `prestige.js:123`.
- **B-M13 · `sendCommentNotification` is a push-to-any-inbox primitive**
  (`comments.js:14-67`, no check the comment exists).
- **B-M14 · Season rollover loads every active profile unpaged and
  unprojected** (`season.js:113-115`), and `:394` computes
  `xpAtSeasonStart` from the stale snapshot while `xp` is written as an
  increment (`:389`).
- **B-M15 · Cap checks outside transactions:** `designExchange.js:118-130`,
  `showcase.js:113-118`, `uniformStudio.js:121-127`, `podiumHost.js:75-80`,
  `leagueInvitations.js:170-202`.
- **B-M16 · Streak-freeze consumers disagree with the claim logic**
  (`emailNotifications.js:613-617`, `dailyOps.js:729-746` vs `:79-135`), so
  "at risk"/"streak ended" messaging contradicts what actually happens.
- **B-M17 · `getHotCorps` swallows every error as success**
  (`lineups.js:688-691`) and stampedes recompute at first call of the day
  (`:552-555`).

**Low**

- B-L1 · `onLeagueMemberJoined` (`pushTriggers.js:200-245`) fires on every
  league doc update; `onLeagueChatMessage` (`:291-295`) reads every member
  profile per @mention.
- B-L2 · `onStreakMilestoneReached` (`emailTriggers.js:131-183`) listens on
  `streak_milestones/*`, which nothing in the backend writes.
- B-L3 · `newsSubmissions.js:28-39`, `articleComments.js:237-244` build
  profile paths from `process.env.DATA_NAMESPACE` instead of `paths.js`.
- B-L4 · `bulkModerateComments` (`commentModeration.js:242-260`): a missing
  id fails the whole batch and `failed` is always 0; `:65-69` reads 500
  articles per page just to map headlines.
- B-L5 · `leaveLeague` (`leagues.js:501`) and `leagueLifecycle.js:118` apply
  two different dissolve policies; a non-creator last member strands escrow.
- B-L6 · `youtube.js:122-124 getCacheKey` is unbounded (long query → >1500
  byte doc id throws).
- B-L7 · `leagueChat.js:94-116` fans one notification write per member per
  message.
- B-L8 · `registerCorps.js:11`, `corpsHelpers.js:34`: the profanity filter is
  `/fuck|shit|damn/`; `registerCorps.js:24` calls `.length` on unvalidated
  types.
- B-L9 · `invalidateNewsCache` (`newsFeed.js:192-205`) deletes the cache
  collection in one unbounded batch.
- B-L10 · `shareCards.js:106-108, 169-172` 404s carry no `Cache-Control`
  (`resultsPages.js:86-93` does it right).
- B-L11 · Replay/idempotency error codes inconsistent (`podium.js:616-621`,
  `podiumLifecycle.js:261`, `showcase.js:194,249`).
- B-L12 · `bmacWebhook` (`supporters.js:48-120`) never dedupes on `event_id`.
- B-L13 · Unpaged full scans in `season.js:113`, `admin.js:473, 588`.
- B-L14 · `weeklyMatchups.js:154-162` byes folded into standings without an
  idempotency token.
- B-L15 · Level formula duplicated (`dailyOps.js:183-184` vs
  `calculateLevel`).
- B-L16 · `functions-scraper/index.js:237` `year` unvalidated.

Verified OK: HTML/XML escaping in `resultsPages.js`, `publicProfilePages.js`,
`shareCards.buildShareHtml`, `sitemap.js`; route parsers whitelist segments;
Pub/Sub workers allow-list `dci.org`; `dciFetch` has bounded retries and
payload caps; all purchases check balance inside `runTransaction` with server
prices.

### Quick wins

1. Prefix-check `path` in `newsAdmin.js` (B-H1).
2. Read the comment doc in `reportComment` (B-H2).
3. `transaction.create` for `leagueInvites/{code}` + retry (B-H4).
4. Replace the two hand-rolled counters with `consumeRateBudget` (B-M8).
5. `recursiveDelete` in `deleteAccount` (B-H6).
6. Validate lineup keys against `LINEUP_CAPTIONS`; cap `showConcept` strings
   at 100 (B-M5, B-M6).
7. `assertDocId` at the B-M12 sites.
8. Hash keys in `getActiveLineupKeys` (B-M4).
9. Require a full week in `updateMatchupResults` (B-M2).
10. `Cache-Control` on the OG-card 404 branches (B-L10).
11. Fix streak-freeze semantics to game days (B-H3).

## C. Frontend architecture, performance, and data loading

### Architecture as built

Vite 8 + React 18 + react-router 7, Firebase 12 (Auth, Firestore with
persistent multi-tab cache, Functions, lazy Storage/Messaging/App Check),
TanStack Query 5, three Zustand stores, framer-motion via `LazyMotion`,
Tailwind. `src/index.jsx` → `App.jsx` → `useAuthState` gates everything
behind a full-screen loader; `useAppBootstrap` mounts three global
`onSnapshot` listeners (season → schedule → profile), replays the offline
lineup queue, claims daily login, re-attaches push. Every page is
`lazyWithRetry` with hover prefetch. There are four overlapping data layers:
Zustand for the realtime singletons, TanStack Query through `src/api/*`, raw
`onSnapshot`/`getDocs` in hooks and ~10 components, and a hand-rolled news
cache plus a service-worker SWR cache.

First paint on `/` (gzip): ≈356 KB JS before the route chunk —
`vendor-firebase` 196 KB (55%), `index` 69 KB, `vendor-react` 42 KB,
`vendor-query` 12 KB, framer `motion-dom` 11 KB, ~18 preloaded micro-chunks —
plus 16.6 KB CSS and `Landing` 12 KB. 23 `modulepreload`s.

### Findings

**High**

- **F-H1 · The landing page fans out to up to 25 years × full `events`
  subcollection per visitor.** `src/hooks/useLandingScores.js:79-82` sets
  `yearsNeeded` to every distinct `sourceYear` in the corps pool; the
  off-season pool is 25 corps drawn across all `final_rankings` years
  (`functions/src/helpers/season.js:716-748`). Each year calls
  `getHistoricalScoresForYear` (`src/api/season.ts:339-342`), an unbounded
  `getDocs(historical_scores/{year}/events)`. Anonymous visitors, `staleTime`
  5 min, cache wiped on sign-out (`useAppBootstrap.ts:76`). Potentially >1,000
  reads and megabytes of JSON for a sidebar box. Fix: materialise a
  `landing_scores/{seasonUid}` doc nightly and read one doc.
- **F-H2 · The Dashboard always downloads the entire season recap archive,
  twice-keyed.** `src/pages/Dashboard.jsx:118` calls
  `useScoresData({ classFilter: activeCorpsClass })`; `standingsUsable`
  requires `classFilter === 'all'` (`useScoresData.ts:482`), so materialised
  standings are fetched and discarded and `recapsEnabled` (`:493`) falls
  through to the full `fantasy_recaps/{season}/days` scan (up to 49 large
  docs) on the most-visited route. `useRecentResults`
  (`useDashboardScores.js:129-134`) observes the same key at `staleTime` 5
  min, overriding the 60-min window in `useScoresData.ts:503`.
  `getSeasonChampions` (`:439-440`) also runs unconditionally. Fix: the
  Dashboard needs only `profile.classRanks`, `fantasyRecapsRecent` and
  SoundSport best-in-show; drop `useScoresData` from it and unify `staleTime`
  per key.
- **F-H3 · Push notifications render generic text and open `/` — the SW reads
  the wrong payload keys.** The backend sends `{ notification:{title,body},
webpush:{…fcmOptions.link}, data:{url,…} }`
  (`functions/src/helpers/pushService.js:117-140`). Tokens bind to
  `/service-worker.js` (`pushNotifications.ts:117-126`), whose `push` handler
  reads top-level `data.title`/`data.body`/`data.url`
  (`service-worker.js:312-331`) — all undefined. Result: "marching.art / New
  update from marching.art", click → `/`. `public/firebase-messaging-sw.js`
  is never registered. Fix: read `payload.notification?.title/body` and
  `payload.data?.url`; delete the dead messaging SW.
- **F-H4 · `vendor-firebase` is 671 KB / 196 KB gz, over half of first
  paint.** Attribution: `@firebase/firestore` 328 KB, **`re2js` 144 KB**
  (regex engine pulled by Firestore's pipelines support, never used),
  `@firebase/auth` 80 KB, `webchannel-wrapper` 51 KB, `app-check` 14 KB,
  `analytics` 10 KB. `vite.config.js:80-94` forces every `@firebase/*`
  package except messaging/storage into the eager chunk, undoing the dynamic
  import of App Check in `client.ts:96`; analytics initialises at import
  (`analytics.ts:17`). Fix: exclude `app-check` and `analytics` from the
  manual group and lazy-load analytics after first paint; track upstream for
  a pipelines-free Firestore entry.

**Medium**

- **F-M1 · `react-router` (38.9 KB min) lands in the app `index` chunk, not
  `vendor-react`.** `vite.config.js:77` matches `react-router-dom` only; every
  deploy invalidates the router. Add `inPackage('react-router')`.
- **F-M2 · Signed-out visitors download the signed-in shell.**
  `App.jsx:19-20,31-35` statically import `GameShell` (16.5 KB min incl.
  TickerBar + `useTickerData` + `useScoresData`), `BottomNav`,
  `NotificationPanel`, `UsernamePromptModal`, `PWAInstallPrompt`,
  `Celebration`, `LevelUpCelebration`, and all page skeletons — ~50 KB min
  unreachable on `/`, `/how-to-play`, `/article`. Lazy-load `GameShell` and
  the auth-only overlays.
- **F-M3 · `motion-dom` runtime (31 KB / 11 KB gz) is eager despite
  `LazyMotion`.** `MotionProvider.jsx:16` defers only `domMax`; `m` at the
  root (`OfflineBanner.tsx:148`, `PageErrorBoundary.tsx:13`,
  `PWAInstallPrompt.jsx:3`) drags the core runtime into the preloaded chunk.
- **F-M4 · The pending deep-link stash is wiped on every page load.**
  `useAppBootstrap.ts:68-82` runs with `user === undefined` (auth still
  loading) and calls `clearPendingRedirect()` + `queryClient.clear()`. Any
  reload in the Register → Onboarding funnel (including the forced reload from
  `lazyWithRetry` after a deploy) loses the invite link. Guard with
  `user === null`.
- **F-M5 · The service worker auto-activates and purges caches
  mid-session.** `service-worker.js:87-89,97-115`: `skipWaiting()` on
  install, `clients.claim()`, delete all old caches. A tab on the previous
  build 404s on its next lazy chunk and `lazyWithRetry` hard-reloads, losing
  in-progress lineup edits. No `updatefound`/`controllerchange` handling
  exists in `src`. Fix: drop `skipWaiting`, show a "new version" toast that
  posts `SKIP_WAITING`.
- **F-M6 · `maxAge` in `ROUTE_STRATEGIES` is never enforced**
  (`service-worker.js:43-56`); image caches accumulate until the next deploy.
- **F-M7 · The league notification listener requires a composite index the
  repo does not declare.** `useLeagueNotifications.ts:125` uses
  `where('type','in',[…])` + `orderBy('createdAt','desc')`;
  `firestore.indexes.json` has no `type` field. Unless created in the console,
  this fails with `failed-precondition` and `LeagueActivityFeed` is empty.
- **F-M8 · Fonts attach after ~1.2 MB of JS executes → guaranteed FOUT/CLS.**
  `index.html:259-263` only preloads the Google Fonts CSS; `index.jsx:521-531`
  appends the stylesheet at module run. Self-host the woff2 files with
  `<link rel=preload as=font>` and `font-display: optional`.
- **F-M9 · Splash removal is tied to `load`, not React.**
  `public/app-loader.js:5-13` hides the loader 100 ms after `window.load`;
  users see loader → `LoadingScreen` (auth) → `LoadingScreen` (profile,
  `App.jsx:135-146`) → route skeleton. Remove `#app-loader` on first React
  commit and collapse the loading screens.
- **F-M10 · The Leagues chunk is 231 KB / 51 KB gz with all five tabs
  eager** (`LeagueDetailView.tsx:15-21`). Lazy-load per tab.
- **F-M11 · Three history-navigation traps.** `App.jsx:407,421,466` render
  `<Navigate to="/dashboard" />` without `replace` for `/podium/preview`,
  `/forgot-password`, `/preview`.
- **F-M12 · The profile listener re-serialises the whole profile on every
  metadata event.** `profileStore.ts:200-204` subscribes with
  `includeMetadataChanges: true` and `JSON.stringify`s the profile on every
  cache↔server transition.
- **F-M13 · Cache freshness is inconsistent across observers of one key.**
  `fantasyRecaps`: 60 min (`useScoresData.ts:503`) vs 5 min
  (`useDashboardScores.js:133`, `useLeagueRecaps.ts:28`, `admin.ts:350`,
  `MatchupDetailView.tsx:207`). `season`: Zustand listener and a react-query
  `getSeasonData` read (`useLeagueDetail.ts:298-303`, `MatchupsTab.tsx:91-95`).

**Low**

- F-L1 · `TopNav` re-resolves admin via `getIdTokenResult` on every mount
  (`GameShell.jsx:59`) although `profileStore.isAdmin` holds it.
- F-L2 · Two listeners on `users/{uid}/notifications` while the Activity tab
  is open (`useNotificationInbox` limit 30, `useLeagueNotifications` limit
  50; `LeagueActivityFeed.tsx:376-390`).
- F-L3 · N+1-shaped reads: `getMemberProfiles` (`leagues.ts:484-487`) up to 2
  `getDoc`s per member; `useHostedEvents.js:136-147` per legacy host.
- F-L4 · `PullToRefresh.tsx:96` `e.preventDefault()` in React's
  `onTouchMove` is a silent no-op (passive listener).
- F-L5 · Dead API code: `api/leaderboard.ts` (470 lines, zero callers; also a
  pagination bug at `:70-76`), `subscribeToProfile`, `getCorps`,
  `subscribeToSeason`, `getShowsByDay`, `getAllShows`, `getFantasyRecaps`,
  `PLACEMENT_POINTS`, `isRegistrationOpen`, `formatSeasonDisplayName`.
- F-L6 · Components bypass `src/api`: `LeaguePoolCard.tsx:39`,
  `FantasySeasonLedger.jsx:276`, `PodiumReportSheet.jsx:251-256`,
  `PodiumSeasonLedger.jsx:149`, `PodiumRecapSheet.jsx:375`, `Records.jsx:97`,
  `CorpsHistory.jsx:268`, `Admin.jsx`, `JobsTab.jsx`; path literals duplicate
  `paths.*`.
- F-L7 · Unbounded reads: `getSeasonChampions`, `getLeagueMatchups`,
  `getLeagueMatchupHistory`, `getPodiumSeasonRecaps` (no `limit`).
- F-L8 · `useAppBootstrap.ts:78-81` never unsubscribes the profile listener on
  unmount.
- F-L9 · News has three caches with different TTLs (`newsFeedCache.js`, SW
  `NEWS_CACHE`, CDN).
- F-L10 · `createCallable` executes `httpsCallable()` for ~110 functions at
  import (`callable.ts:29-31`), and `api/index.ts:43` re-exports all, which is
  why `functions`, `podium`, `leagues`, `season`, `funnel` chunks are
  preloaded on the landing page.
- F-L11 · `index.html:229` `apple-touch-startup-image` with a 512 px logo
  (ignored by iOS); duplicate `theme-color` metas (`:176-177`).
- F-L12 · `createOfflineResponse()` returns JSON 503 to navigation requests
  when `/index.html` isn't cached (`service-worker.js:225-233`).
- F-L13 · The entry chunk carries 13.5 KB of lucide icons for the shell.
- F-L14 · `react` core (7 KB) ended up in `vendor-query` (matcher order).
- F-L15 · `useLandingScores` and `useTickerData` run for signed-in users on
  `/` too (`Landing.jsx:88-96`).

### Quick wins

1. `vite.config.js:77`: add `inPackage('react-router')`; exclude
   `@firebase/app-check` and `@firebase/analytics` from `vendor-firebase`;
   lazy-import analytics after first paint.
2. `useAppBootstrap.ts:68`: only clear on `user === null`.
3. `App.jsx:407,421,466`: add `replace`.
4. `service-worker.js:312-331`: read `payload.notification` /
   `payload.data.url`; delete `public/firebase-messaging-sw.js`.
5. `service-worker.js:87-89`: remove `skipWaiting()`; add an `updatefound`
   toast.
6. Declare the `(type ASC, createdAt DESC)` composite index for
   `users/{uid}/notifications`, or filter client-side on the inbox listener.
7. `Dashboard.jsx:118`: stop calling `useScoresData`; align `staleTime` on
   `fantasyRecaps` to 60 min everywhere.
8. Lazy-load `GameShell`, `UsernamePromptModal`, `PWAInstallPrompt`,
   `Celebration*`, and the five league tabs.
9. Self-host Inter/JetBrains Mono woff2 with `font-display: optional`.
10. Delete the zero-caller exports in F-L5.

## D. UX, product flows, and copy

### Route map (`src/App.jsx`)

| Route                                                                                            | Page            | Shell / purpose                                               |
| ------------------------------------------------------------------------------------------------ | --------------- | ------------------------------------------------------------- |
| `/`                                                                                              | Landing         | News hub + inline login (guest) / identity widget (signed-in) |
| `/login`, `/register`, `/forgot-password`                                                        | Auth            | Full-page forms; RedirectIfAuthed                             |
| `/preview`                                                                                       | GuestDashboard  | Demo dashboard with registration gates                        |
| `/podium/preview`                                                                                | PodiumPreview   | Podium demo (no signup)                                       |
| `/onboarding`                                                                                    | Onboarding      | 3–4 step wizard (protected, no profile required)              |
| `/dashboard`                                                                                     | Dashboard       | Core loop (GameShell)                                         |
| `/schedule`, `/scores`, `/leagues/:id?/:tab?`, `/profile/:userId?`                               | Core pages      | GameShell                                                     |
| `/guide`                                                                                         | HowToPlay       | In-app guide (protected)                                      |
| `/how-to-play`, `/podium-guide`, `/updates`, `/privacy`, `/terms`, `/article/:id`                | Public          | PublicShell                                                   |
| `/hall-of-champions`                                                                             | HallOfChampions | Shell picked by auth state                                    |
| `/shop`, `/studio`, `/exchange`, `/achievements`, `/records`, `/retired-corps`, `/corps-history` | Explore         | GameShell                                                     |
| `/supporters`                                                                                    | SupportersEntry | Signed-in → `/scores?tab=supporters`; guest → external BMAC   |
| `/admin`                                                                                         | Admin           | Ops console                                                   |
| `/podium`, `/hub`, `/hud`, `/leaderboard`, `/settings`, `/soundsport`, `/scores/:date`           | Redirects       | —                                                             |
| `/styleguide`                                                                                    | StyleGuide      | DEV only                                                      |

### Findings

**First-run funnel**

- **U-H1 · Two onboarding "guides" plus a tour, none coordinated.** A
  SoundSport signup passes through the Onboarding wizard → CelebrationModal +
  welcome toast (`Onboarding.jsx:550`) → dashboard where
  `useDashboardModals.js:118-125` enqueues the OnboardingTour after 500 ms,
  potentially behind SeasonSetupWizard (`:105-109`) and an AchievementModal
  (`:138-143`). QuickStartGuide restates the same three steps as
  `JourneyPanel.jsx` (8-step "First Season Journey") and HowToPlay's "Getting
  Started". Fix: make JourneyPanel the single checklist; reduce
  QuickStartGuide to a link into it; drop the desktop tour's generic welcome
  step.
- **U-H2 · Marketing promises a game that may be feature-flagged off.**
  `HeroBanner.jsx:111` ("Podium Division — Found and run your own corps"),
  `HowToPlayPublic.jsx`, `PodiumGuide.jsx`, `SiteFooter.jsx`,
  `SiteLinksMenu.jsx:37` render unconditionally, while the game exists only
  when `game-settings/features.podiumClass === true` (`useFeatures.js:47`).
  Fix: gate on `usePodiumEnabled()` or show "coming soon".
- **U-H3 · Social proof widgets can't render for the audience they exist
  for.** `SocialProofBar.jsx:60-67` and `CommunityPulse.jsx:37-45` return
  `null` for guests; `Landing.jsx` renders SocialProofBar only for
  `firstVisitGuest`. Dead code in production. Fix: publish a small public
  `stats` doc from a scheduled function, or delete them.
- **U-M1 · "Takes less than 30 seconds" is untrue.** `GuestDashboard.jsx:774`,
  `RegistrationGate.jsx:82` vs the real path (Register → Onboarding with
  username availability check, game choice, corps name, 8-caption draft).
- **U-M2 · Identity asked twice.** Register collects `displayName`;
  Onboarding step 1 asks the name again plus a separate `@username`
  (`OnboardingSteps.jsx:60-120`) without explaining the difference.
- **U-M3 · Onboarding validation is toast-only.** `Onboarding.jsx:276-292`
  fires `toast.error` while Continue is already disabled; inline errors never
  appear.
- **U-M4 · Onboarding loses everything on refresh.** Profile is created only
  on the final step (`Onboarding.jsx:319-433`). Persist wizard state or create
  the profile after step 1.
- **U-M5 · Contradictory naming for the two games.** "Choose Game"
  (`onboardingConstants.js:106`), "Choose your division"
  (`OnboardingSteps.jsx:165`), "Podium Division / Fantasy Division",
  "Starting in SoundSport" (`:352`), Scores tabs "Fantasy / Podium", "Podium —
  a director simulation" (`PodiumZone.jsx:63`). Pick one vocabulary.
- U-L1 · `OnboardingSteps.jsx:352` copy contradicts `progressionGuide.js`
  (unlocks are seasons/level/coin, not coin only).
- U-L2 · Lineup-change rules hand-typed in three places
  (`Onboarding.jsx:754-756`, `quickStartSteps.js:20`,
  `HowToPlayPublic.jsx:237`); only one imports `WEEKLY_TRADE_LIMIT`.
- U-L3 · Password strength meter is length-only (`Register.jsx:115`: 8
  chars = "strong").
- U-L4 · "Remember me" checkbox does nothing (`Login.jsx:166-171`).
- U-L5 · `errorMessages.ts` defines `actionLabel/action` but
  `authErrorMessage()` returns only `message`; "Try signing in instead" has
  no link.

**Dashboard core loop**

- **U-H4 · 21 modals on one page, 7 of them auto-queued interrupts.**
  `DashboardModalHost.jsx` mounts 18; `Dashboard.jsx` adds three; globally
  `UsernamePromptModal` (undismissable) and `PWAInstallPrompt`
  (`PWAInstallPrompt.jsx:40`). A returning director at season rollover can
  face SeasonRecap → SeasonSetup (7 steps) → ClassUnlock → Achievement → PWA
  nudge before seeing the page. Fix: cap auto-interrupts to one per visit;
  fold Achievement/ClassUnlock into the inbox (types already exist in
  `notificationDisplay.ts`).
- **U-H5 · "Next Up" is mobile-only.** `NextActionPanel.tsx:178-179` is
  `lg:hidden`; desktop shows ~10 panels with no imperative. The tested
  `resolveNextAction` (`utils/nextAction.ts`) is invisible to desktop users.
  Render a compact one-liner above the grid.
- **U-M6 · The season ledger is rendered twice** (`Dashboard.jsx:581` inline
  and `:752` in a modal).
- **U-M7 · Newest players are excluded from the ledger.** `hasSeasonLedger`
  (`Dashboard.jsx:192`) excludes `soundSport`, the only class every new
  director is in.
- **U-M8 · Reward/celebration stacking.** Claiming a Journey step fires
  `toast.success` + `showXPGain` + `showCoinGain` (`JourneyPanel.jsx:44-48`);
  level-up adds a 4 s overlay plus confetti (`LevelUpCelebration.tsx`). One
  channel per event class.
- **U-M9 · A "Buy" button in the persistent HUD.** `ControlBar.jsx:255-266`
  shows "Buy" whenever the wallet can afford the next class, even when it is
  season-locked or unlocks free next season — undermining the Shop's "never
  sell advantages" promise (`Shop.jsx:330`).
- U-L6 · Hard-coded numbers mirroring config: `DirectorsReport.jsx:142`
  "+25 XP"; `ClassPurchaseModal.tsx:43-55` budgets and lock weeks.
- U-L7 · Desktop tour geometry assumes a 320×200 tooltip
  (`OnboardingTour.jsx:116`).
- U-L8 · Stale comments describing UI that doesn't exist
  (`Landing.jsx:70`, `:304`).

**Navigation / IA**

- **U-H6 · Two "How to Play" guides in the same menu.**
  `SiteLinksMenu.jsx:36-37` lists "Game Guide" (`/guide`, protected) and "How
  to Play" (`/how-to-play`, public) side by side; `SiteFooter.jsx:28` links
  the public one to signed-in users; signed-out visitors clicking "Game Guide"
  bounce to `/`. One route, content by auth state.
- **U-M10 · The supporters wall lives inside Scores** (`Scores.jsx:52`);
  nothing links to `/supporters`.
- **U-M11 · Orphan routes.** `/podium/preview` (the best Podium conversion
  tool) is linked only from itself; `/supporters` from nowhere; `/exchange`
  only from Studio + Explore.
- **U-M12 · The public news page doubles as the signed-in home.** `GameShell`
  labels `/` as "News" but the logo links to `/dashboard`; signed-in users see
  a login-styled "My Fantasy" card (`Landing.jsx:219-310`) repeating header
  stats. Consider `/` → dashboard when signed in and news at `/news`.
- U-L9 · Quick Start reachable only via `?panel=quickstart`;
  `QuickStartButton` (`QuickStartGuide.jsx:250`) is never rendered.
- U-L10 · NotFound speaks developer ("System Error", "Error: ENOENT",
  `NotFound.jsx:63-178`).

**Lineup / schedule**

- **U-H7 · Draft pool copy contradicts the filter.**
  `CaptionSelectionParts.jsx:171`: "cost 25 or less"; the hook filters
  `points <= 50` (`useCaptionSelectionModal.js:157`), as does onboarding
  (`Onboarding.jsx:137`).
- **U-M13 · Quick Start "Pro tips" are filler** (`quickStartSteps.js:45-46`;
  regular shows have no capacity). Replace with the weekly cap and majors
  auto-enrolment.
- **U-M14 · Show-limit enforcement is a toast after the fact**
  (`ShowRegistrationModal.jsx:306`, cap shown only at `:445`). Surface `x/N
this week` on the Schedule header.
- U-L11 · Live-show heuristic can lie: `useUrgencyTriggers.js:264` marks
  "performing now" after 6 PM local with no scraped timing.
- U-L12 · Lock reasons assume players count season days
  (`nextAction.ts:170`); add the calendar date.

**Leagues / Podium**

- **U-M15 · Rookie Circuit is offered everywhere except the Leagues page.**
  `EmptyMyLeagues` (`LeaguesParts.tsx:97`) only offers "Create League".
- **U-M16 · Standings is a 6–8 column table with a legend below the fold**
  (`StandingsTab.tsx:653-670`); `title=` tooltips don't work on touch.
- **U-M17 · Matchup comprehension.** Mixed-class scoring explained only in a
  `title` tooltip (`MatchupsTabParts.tsx:561`); commissioners get a manual
  "Generate matchups" picker (`SettingsTab.tsx:340-450`) with no indication
  it's optional.
- U-L13 · Entry-fee copy never says the fee is deducted immediately
  (`CreateLeagueModal.tsx:226`).
- U-L14 · Podium founding is a 4-step wizard with 8 challenge sliders before
  the player has seen a rehearsal (`PodiumRegistration.jsx`); the explanatory
  tour fires only after founding (`useDashboardModals.js:127-133`).

**Monetisation / supporter**

- **U-M18 · Supporter linking is buried** (Profile → Settings →
  SupporterPanel); no page states what tiers give before the user leaves for
  BMAC. Add a one-screen "Support marching.art" with `SUPPORTER_TIERS`.
- U-L15 · Streak freeze sold in three places with different framing
  (`Shop.jsx:182`, `StreakModal.jsx:638`, `CorpsCoinModal.jsx:448`).
- U-L16 · ControlBar "Buy" bypasses ClassPurchaseModal's "you can earn it
  free in N seasons" warning.

**Copy / consistency**

- U-L17 · Rewards spelled three ways ("CC", "CorpsCoin", "Coins").
- U-L18 · Raw `error.message` in league flows (`Leagues.tsx:376`, ~8 handlers
  in `useDashboardModals`) while `friendlyCallableError` exists.
- U-L19 · Confetti positions use `Math.random()` in render
  (`OnboardingSteps.jsx:466`).
- U-L20 · Admin destructive actions use `window.confirm` (10 call sites)
  while a Modal system exists.

### Feature opportunities the code is already set up for

1. Public community stats — `getCommunityStats()`/`getRecentLeagueActivity()`
   and both widgets exist; only a public read source is missing.
2. The notification inbox as the celebration channel —
   `notificationDisplay.ts` already maps `achievement_unlocked`, `level_up`,
   `prize_payout`.
3. Desktop Next-Up — `resolveNextAction`/`resolvePodiumNextAction` are pure
   and tested.
4. Deep-link preservation works end-to-end but league invite copy never says
   "works even before they sign up".
5. `/podium/preview` is a complete interactive daily loop with no inbound
   link.
6. `QuickStartButton` FAB exists and is unused.
7. Lineup templates and Quick Fill exist but no guide mentions them.

### Quick wins

1. Fix "cost 25 or less" → derive from the filter constant (U-H7).
2. Gate Podium marketing on `usePodiumEnabled()` (U-H2).
3. Remove "Remember me" and the 30-second claims (U-L4, U-M1).
4. Render NextActionPanel on desktop as a one-liner (U-H5).
5. Delete the inline `FantasySeasonLedger` duplicate; include SoundSport
   (U-M6/U-M7).
6. Add "Join the Rookie Circuit" to `EmptyMyLeagues` (U-M15).
7. Import `XP_SOURCES.dailyLogin`, class budgets, lock weeks instead of
   literals (U-L6).
8. Hide `/guide` from the signed-out help menu (U-H6).
9. Link `/podium/preview` from the hero Podium card and `/podium-guide`.
10. Replace the two Quick Start filler tips (U-M13).

## E. Accessibility, design system, and mobile

### The design system as it exists in code

Tokens (`tailwind.config.cjs`): a single-dark "data-terminal" system. Neutral
ramp `background #0A0A0A → surface-sunken → surface-card #1A1A1A →
surface-raised → surface-elevated`; hairlines `line-*`; text `main / secondary
#B3B3B3 / muted #999`; identity split into `brand` (gold, reward-only) and
`interactive` (azure), with a foreground/fill split at `:53-75` and `:120` so
white-on-fill clears AA. Shadows, gradients, and backdrop-blur are removed from
the theme (`:142, :219`). The convention is `rounded-none` except
`rounded-full`. `h-screen`/`min-h-screen` map to a `100vh, 100dvh` pair
(`:222-236`). Touch tokens: `min-h-touch` 44px, `safe-*` spacing.

Primitives (`src/components/ui`): `Button`/`IconButton` (44px min), `Card`
(`pressable` → role=button + keyboard), `Modal` (portal, `useFocusTrap`,
Escape, bottom-sheet on mobile), `BottomSheet`, `Input/Textarea/Select`
(`useId` label association), `DataTable` (sticky header, `scope="col"`),
`Tabs` (real WAI-ARIA tabs with roving tabindex), `Badge`, `Heading`,
`PageHeader`, `OptimizedImage`, `Skeleton`. Score sheets have their own
sub-system (`SheetPrimitives`, `sheetTokens`, `PillTabControl`).

A11y infrastructure: `SkipToContent`, `RouteChangeFocus`, `useFocusTrap` (26
files), `useEscapeKey` (33 files), `MotionConfig reducedMotion="user"` plus a
global `prefers-reduced-motion` rule (`index.css:366`), a toast live region
(`App.jsx:292`). `ThemeContext` hard-pins `data-theme="dark"`.

Enforcement: `scripts/designCensus.mjs` ratchets 8 regex invariants
(arbitrary hex, bare hex, rounded, banned effects, off-role gold, gray/slate,
font-display, ad-hoc heading sizes). `e2e/a11y.spec.ts` runs axe on 5 public
pages only; `e2e/mobile.spec.ts` checks overflow, 16px inputs, one button's
height, and PWA meta.

The foundation is strong. The findings are mostly about the ~90 files that
bypass the primitives, and a few primitives that violate their own laws.

### Findings

**High**

- **A-H1 · 14 hand-rolled `role="dialog"` overlays have no focus trap, and 4
  have no Escape.** `CaptionSelectionModal.jsx:92` (the core game loop),
  `OnboardingTour.jsx:195`, `GuestLineupPicker.jsx:83`,
  `LeagueDetailViewParts.tsx:99`, plus `SettingsModal.jsx:364`,
  `StandingsModal.jsx:33`, `CreateLeagueModal.tsx:120`,
  `QuickStartGuide.jsx:68`, `LeaguesParts.tsx:32`, `SettingsTab.tsx`,
  `CommissionerTransfer.tsx`, `CorpsHistory.jsx`, `YouTubeModal.jsx`,
  `CaptionSelectionParts.jsx`. Tab escapes into the obscured page; focus is
  never restored. Fix: `useFocusTrap(ref, isOpen)` + `useEscapeKey` now;
  migrate to `<Modal>` over time.
- **A-H2 · 42 icon-only buttons have no accessible name** (e.g.
  `RetireCorpsModal.jsx:66`, `CorpsCoinModal.jsx:97`, and the close buttons in
  12 modal files). They are also `p-1` around a 16px icon ≈ 24px targets.
  Fix: `IconButton` (requires `aria-label` by type, enforces 44px).
- **A-H3 · Form errors are never announced or associated.** App-wide there
  are 2 `aria-describedby`/`aria-invalid` usages; `role="alert"` appears once.
  `Input.tsx:103-107` renders the error with no `id`/`aria-describedby`/
  `aria-invalid`; `Login.jsx:93`, `Register.jsx:157`,
  `ForgotPassword.jsx:135` render error blocks silently.
- **A-H4 · `JargonTooltip.jsx:117-128` is focusable but not
  keyboard-operable** (`role="button" tabIndex={0}` with mouse/touch handlers
  only); `onTouchStart` calls `preventDefault()` (`:83`), blocking scroll
  start on the term; `aria-describedby` targets an id that only exists while
  visible.
- **A-H5 · Public-page scroll position is not reset on navigation.**
  `PublicShell.jsx:60-66` scrolls a fixed `<main overflow-y-auto>`, but
  `RouteChangeFocus.tsx:24` calls `window.scrollTo(0,0)` — a no-op there.
  Fix: `(main ?? window).scrollTo(0,0)`.
- **A-H6 · Tiny type is the house style: 1,005 uses of `text-[10px]`, 254 of
  `text-[9px]`, 19 of `text-[8px]`.** The score-sheet primitives ship 9px
  column headers (`SheetPrimitives.tsx:75`), 9px sort/share buttons
  (`:293, :332`), 8px "Adv" tags (`:208`); `DataTable` headers are 10px
  (`:309`); `BottomNav` labels 10px (`:316`). The `text-xxs` token and
  `.min-text-mobile` utility have 0 users. Fix: an 11px floor, 10px reserved
  for numeric eyebrows on lg+, and a census invariant for
  `text-\[(?:[1-9]|10)px\]`.

**Medium**

- **A-M1 · Sub-44px controls in the sheets and headers.** `SortPills`
  (`SheetPrimitives.tsx:293`, ≈18px tall), `ShareButton` (`:332`, ≈22px),
  header icon buttons at 36px (`GameShell.jsx:123,138`,
  `SiteHeader.jsx:82`, `ExploreMenu.jsx:88`, `SiteLinksMenu.jsx:97`).
  Extend `e2e/mobile.spec.ts` to assert every `button, a[href]` ≥ 24×24.
- **A-M2 · `PillTabControl.tsx:65-83` (top-level Scores tabs) has no tab
  semantics** — plain buttons, no `role="tab"`/`aria-selected`, colour-only
  active state, no arrow keys — while `Tabs.tsx`, `ZoneTabs.tsx:42-56`,
  `LeagueDetailHeader.tsx:227` do it correctly.
- **A-M3 · Primitives violate the design laws they document.**
  `DataTable.tsx:347`, `PillTabControl.tsx:89`, `GameShell.jsx:674,704,708`
  use `bg-gradient-to-l from-[#0a0a0a]`; `XPFeedback.tsx:57` inline
  `boxShadow` glow (invisible to the census); `Celebration.jsx:162`
  `blur-3xl`.
- **A-M4 · Non-token colours inside `ui/`.** `Badge.tsx:21-24`
  (`green-500/blue-500/red-500`), `Input.tsx:87,104` (`red-*`),
  `Modal.tsx:285` (`bg-red-600`), `StatCard.tsx:23,50` (`text-neutral-500`
  ≈ 3.6:1 on surface-card — fails AA, and `neutral-` escapes the census regex
  at `designCensus.mjs:96`), `Tabs.tsx:81`, `Skeleton.tsx` (`charcoal-*`).
- **A-M5 · ConfirmModal re-implements Button** (`Modal.tsx:271-291`);
  app-wide 134 raw `bg-interactive text-white` button strings across 93 files
  vs 23 importers of `Button`. Add a `danger` variant and a census invariant
  for `<button[^>]*bg-interactive`.
- **A-M6 · Focus indicators are weakened by the primitives.** Global
  `:focus-visible` (`index.css:110`) is a solid 2px outline, but
  `Button.tsx:75` and `Tabs.tsx:163` set `focus:outline-none` and substitute
  a 50%/30%-alpha ring; `Input.tsx:83` relies on a 1px border change.
- **A-M7 · Modal/BottomSheet body-lock and Escape conflict.** Both write
  `document.body.style.overflow` (`Modal.tsx:75-79`, `BottomSheet.tsx:63-67`)
  and both listen for Escape on `document`, so one keypress closes the whole
  stack. Ref-count the lock; stop propagation on the top-most dialog.
- **A-M8 · `BottomSheet.tsx:143,185` hard-codes `id="bottom-sheet-title"`** —
  duplicate ids with two sheets mounted. Use `useId()`.
- **A-M9 · Chart accessibility is nil.** `LineChartImpl.jsx:25`,
  `BarChartImpl.jsx:25` render a bare `<canvas>`; `CorpsHistory.jsx:342-370`
  uses raw `rgb(250,204,21)`; `PodiumTrajectoryCard.jsx:102,109,137` uses
  `#6b7280` for 9px axis labels with hover-only `<title>` tooltips.
- **A-M10 · Menus use `role="menu"` without the keyboard contract**
  (`ExploreMenu.jsx:97`, `SiteLinksMenu.jsx:114`) and duplicate the same
  outside-click/Escape effect.
- **A-M11 · Date formatting is inconsistent and sometimes timezone-shifted.**
  10 bare `toLocaleDateString()` calls, 85 bare `toLocaleString()`;
  `useScoresData.ts:137` formats the computed event date in local time while
  `:144` formats the stored one in UTC. Season logic is ET
  (`seasonClock.js:86`). One `formatDate(date, style)` with `en-US` and an
  explicit ET zone.
- **A-M12 · Score precision drift:** `toFixed(0)`×18, `(1)`×42, `(2)`×20,
  `(3)`×15; `CaptionValue` (`SheetPrimitives.tsx:177`) shows 2 decimals while
  `CutBanner` (`:239`) shows 3. DCI scores are 3-decimal. Add `formatScore()`.
- **A-M13 · Landing and Article inline auth forms lack labels and
  autocomplete** (`Landing.jsx:339-360`, `ArticleSidebarAuth.jsx:215-230`;
  Article's are 36px with `text-sm` → iOS zoom).
- **A-M14 · `window.confirm` in Admin** (10 call sites) while `ConfirmModal`
  exists.
- **A-M15 · Raw tables without header semantics or overflow containers** (12
  files without `scope=`; `HallOfChampions.jsx`, `LiveScoresTab.jsx`,
  `JobsTab.jsx`, `UsersTab.jsx` without `overflow-x-auto`).
- **A-M16 · Hover-only affordances.** 151 `title=` attributes without
  `aria-label`; `AdvancesTag` (`SheetPrimitives.tsx:207`) hides its meaning in
  `title`; `SeasonScorecard.jsx:147` avatar edit overlay has no
  `focus-within`.
- **A-M17 · Skeletons don't match the layouts they stand in for.**
  `DashboardSkeleton` (`Skeleton.tsx:227-265`) vs the real
  ControlBar + ZoneTabs grid (`Dashboard.jsx:430-528`); `ScoresPageSkeleton`
  (`:277`) draws a ticker the page doesn't render. Layout shift on the two
  most-visited pages.
- **A-M18 · `OptimizedImage.tsx:46-72`:** default `options = {}` is a new
  object each render and is in the deps array, so the IntersectionObserver is
  recreated on every re-render; `<img>` never receives `width/height`.
- **A-M19 · Onboarding/tour overlays sit outside the a11y patterns**
  (`OnboardingSteps.jsx:387` overlay with no `role="dialog"`; labels at
  `:69,87,328` with no `htmlFor`).

**Low**

- A-L1 · `index.html:11-12` `theme-color` is gold `#EAB308` over a black
  app; noscript links `#0057b8` on dark (2.9:1, `:245`).
- A-L2 · `index.css:78-95` placeholder colour is a hard-coded
  `#9ca3af !important`; `--tap-highlight` (`:28`) unused; `.skeleton`
  gradient (`:237`) hard-codes hex.
- A-L3 · `LoadingScreen.tsx:35`, `Spinner.tsx:118` reference a `glow-pulse`
  class defined nowhere.
- A-L4 · Two `useIsMobile` implementations (`hooks/useIsMobile.ts`,
  `useReducedMotion.ts:210`); only the former is imported.
- A-L5 · `GameShell.jsx:791` double-wraps `<BottomNav>` in a second fixed
  div; `TopNav`'s `<nav>` (`:66`) has no `aria-label`; `role="main"` (`:779`)
  is redundant.
- A-L6 · `Modal.tsx:156-167` injects a `<style>` with `@keyframes` per
  instance.
- A-L7 · `Tabs.tsx:171` `layoutId="activeTab"` is global; `TabContent`
  (`:203`) declares `exit` without `AnimatePresence`.
- A-L8 · `Select` (`Input.tsx:224`) is `appearance-none` with no chevron.
- A-L9 · `Button.tsx` doesn't set `aria-busy` while loading; `Card hoverable`
  without `pressable` gets `cursor-pointer` but no keyboard path
  (`Card.tsx:63`).
- A-L10 · Three treatments of the modal title slot (`Modal.tsx:126`, `:190`,
  `BottomSheet.tsx:186`).
- A-L11 · Discord hex `#5865F2` repeated in 5 files — a `brand-discord`
  token.
- A-L12 · `e2e/a11y.spec.ts` never authenticates, so everything in A-H1/A-H2
  is outside axe's reach.

### Quick wins

1. `useFocusTrap` + `useEscapeKey` in `CaptionSelectionModal`,
   `OnboardingTour`, `GuestLineupPicker`, `LeagueDetailViewParts` (A-H1).
2. Replace the 12 `p-1` close buttons with `IconButton aria-label="Close"`
   (A-H2).
3. `Input.tsx`: `id` on the message, `aria-describedby`/`aria-invalid` on
   the control (A-H3).
4. `RouteChangeFocus.tsx:24`: `(main ?? window).scrollTo(0,0)` (A-H5).
5. Remove the `focus:outline-none focus:ring-*/NN` overrides in
   `Button.tsx:75`, `Tabs.tsx:163`, `SkipToContent.tsx:48` (A-M6).
6. `from-[#0a0a0a]` → `from-background`; `text-neutral-500` → `text-muted`
   (A-M3/A-M4).
7. `useId()` for the BottomSheet title (A-M8).
8. Memoise `options` in `OptimizedImage.tsx:46` (A-M18).
9. Add `neutral|zinc|stone` to the census gray regex and a `tiny-text`
   invariant (A-H6/A-M4).
10. `autoComplete` + `aria-label` on the four inline auth inputs (A-M13).

## F. Engineering quality, tests, and developer experience

### Metrics

| Metric                                                    | Value                                                                                                                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Source vs sibling-test files, `src/`                      | pages 45/6 · components 273/39 · hooks 55/15 · utils 64/51 · api 24/2 · lib 6/3 · store 3/1                                                                                    |
| Source vs sibling-test files, `functions/src/`            | callable 43/32 · helpers 149/128 · scheduled 20/8 · triggers 16/4                                                                                                              |
| functions modules >250 lines with no sibling test         | 31 (newsGeneration 983, newsSubmissions 950, admin 893, season 842, pushNotifications 823, dailyOps 784, emailNotifications 703, leagueAutomation 596 …)                       |
| `src` non-component modules >300 lines, no test           | 37 (Onboarding 888, useScoresData 797, App.jsx 785, api/functions.ts 756, Leagues.tsx 747, api/podium.ts 687, api/leagues.ts 620 …)                                            |
| functions modules required by zero test files             | admin.js, podiumJoint.js, leagueAutomation.js, lifetimeLeaderboard.js, leagueArchival.js, newsGeneration.js, pushNotifications.js, emailNotifications.js, engagementRewards.js |
| Vitest coverage thresholds (`vite.config.js:157`)         | statements 15.9 / branches 12.5 / functions 13.3 / lines 15.8                                                                                                                  |
| functions coverage thresholds                             | lines 70 / branches 80 / functions 85 — loaded-files-only (no `--test-coverage-include`)                                                                                       |
| Hand-rolled fake Firestore definitions in functions tests | 58 files; 0 shared test util                                                                                                                                                   |
| src tests using `vi.mock`                                 | 30/121; 0 snapshots; 39 weak (`toBeTruthy`/`toBeDefined`) asserts                                                                                                              |
| e2e                                                       | 39 tests across 7 specs, chromium + Pixel 5; 0 authenticated flows                                                                                                             |
| `: any` / `as any` / `as unknown as` in src TS            | 3 / 1 / 5; JSDoc `{any}` in functions: 48                                                                                                                                      |
| `@ts-nocheck` headers                                     | 88 real (components 60, pages 19, utils 5; functions 2)                                                                                                                        |
| functions `tsconfig.json`                                 | `strict: false`                                                                                                                                                                |
| Duplicated function names src/utils ↔ functions/helpers   | 42 (sampled bodies identical); `classRegistry.json` mirrors byte-identical                                                                                                     |
| `console.*` in functions non-script code                  | 0 (logger: 883); `console.log` in src: 8 (4 unguarded)                                                                                                                         |
| Callables with `enforceAppCheck`                          | 0 of 157; `onCall` handlers also live in 10 non-`callable/` files                                                                                                              |
| Analytics                                                 | 10 named events defined; 6 call sites app-wide                                                                                                                                 |

### Findings

**High**

- **Q-H1 · Deploys are not gated on CI.** `deploy-hosting.yml:18-31` deploys
  on any push to `main` touching `src/**` after only `npm run build`;
  `deploy-functions.yml:135-176` runs `node --check`, functions tests and
  rules tests but no typecheck, lint, or ratchets. A red CI on `main` still
  ships. Fix: `workflow_run: {workflows: [CI], types: [completed]}` +
  `if: conclusion == 'success'`, or move deploy into `ci.yml` behind all
  jobs.
- **Q-H2 · The functions coverage gate is hollow.** `functions/package.json`
  `test:coverage` uses Node's loaded-files coverage, so the nine modules
  never required by any test don't count against 70/80/85. Fix:
  `--test-coverage-include='src/**/*.js'` and re-baseline honestly.
- **Q-H3 · `callable/admin.js` (893 lines) has zero tests and zero test
  imports.** Role grants and corrections are the highest-blast-radius writes.
  Reuse the `.run()` + fake-db pattern from `callable/leagues.test.js:1-45`.
- **Q-H4 · `scheduled/leagueAutomation.js` (596) and
  `helpers/leagueArchival.js` (375) are untested** — season-end settlement
  and archival run once a season, where bugs are unrecoverable.
- **Q-H5 · Season-day literals duplicated across 12 functions modules.**
  `captionWindows.js:56-79` defines `BLACKOUT_DAYS`,
  `CHAMPIONSHIP_START_DAY=45`, `SEASON_FINAL_DAY=49`, but
  `helpers/scoring.js:376,631,635,741,762` hard-codes `[41,42]`, `46`, `49`,
  `>= 45`; 45 literal comparisons exist across dropPlanner, weather,
  scheduleGeneration, scoringAwards, shareCards, resultsPages, podium/*,
  gameDay. Fix: named constants from one module plus a grep ratchet.
- **Q-H6 · The frontend coverage floor is 15.8% lines.** Pages (6/45), api
  (2/24) and components (39/273) are effectively unguarded. Target `src/api/**`
  and `src/hooks/**` with their own thresholds.

**Medium**

- **Q-M1 · `src/api/functions.ts` (756) + `podium.ts` (687) + `leagues.ts`
  (620) have no tests** and are the only place callable request/response
  shapes are declared (`createCallable<Req,Res>` ×79); nothing checks them
  against the handlers. Add a contract test or generate client types from the
  functions side.
- **Q-M2 · `src/types/user.ts` lags server writes.** `engagement.weeklyLoop`,
  `streakMilestones`, `lastLoginDate`, `seasonXP`, `podiumCorps` are written
  by functions but absent from `UserProfile`; this is what blocks
  de-nochecking `DailyChallenges.jsx:75`.
- **Q-M3 · Functions `tsconfig.json` is `strict:false`** with 48 JSDoc
  `{any}`; with 2 `@ts-nocheck` files left there, enabling `noImplicitAny`
  is now cheap.
- **Q-M4 · 58 copies of a hand-rolled fake Firestore** in functions tests
  (`makeFakeDb` in `callable/leagues.test.js:36` etc.); semantics drift
  between copies. One `functions/src/testing/fakeFirestore.js`.
- **Q-M5 · e2e never authenticates.** `auth.spec.ts` only checks form
  rendering; `studio.spec.ts:5` notes the suite runs unauthenticated;
  `guest-draft.spec.ts:30` skips without the emulator. Lineup save, league
  join, shop purchase have zero browser coverage. Use the Auth emulator
  (`src/api/client.ts:81` already wires it) with a seeded user and a
  `storageState` fixture.
- **Q-M6 · No client-side error dedupe/throttle** in
  `src/lib/errorReporter.ts:41-64` and no per-IP throttle in
  `functions/src/triggers/clientErrors.js:79-108`. A render loop fans out
  unbounded `logger.error` writes.
- **Q-M7 · The analytics taxonomy is defined but unused.**
  `logCorpsCreated/logLeagueJoined/logCaptionSelected/logPageView/
logButtonClick` have 0 callers; the only 6 calls are login/logout and two
  free-form events in `funnel.ts:213,237`. Wire them at the `api/functions.ts`
  wrappers or delete.
- **Q-M8 · `functions/` has no formatter and no style rule.**
  `.prettierignore:15-17` excludes `functions` citing a
  `functions/eslint.config.js` that does not exist; 26,451 double-quoted vs
  2,124 single-quoted strings. Add a Prettier override instead of ignoring.
- **Q-M9 · `helpers/economy.js` (212) has no sibling test**; it holds
  `WEEKLY_LEAGUE_WIN_REWARD`, `SEASON_FINISH_BONUSES`, `TRANSACTION_TYPES` and
  the ledger writer.
- **Q-M10 · `helpers/season.js` (842), `callable/dailyOps.js` (784),
  `helpers/xpCalculations.js` (321)** reach tests only via one to three
  importers; rollover is once-per-season logic.
- **Q-M11 · Mirror constants are scattered, not paired.** `seasonClock.js` ↔
  `captionWindows.js`, `captionPricing.js` ↔ `xpCalculations.js` +
  `showSelection.js`, `leagueEconomy.ts` ↔ `leaguePools.js` +
  `leagueChampion.js`. Values match today (verified: XP_SOURCES, milestones,
  CHALLENGE_POOL, trade limits, class days, ante 25, finals 12, CC 1000/100)
  but only `classRegistry.json` has a CI sync check. Add
  `checkMirrorConstants.mjs`.
- **Q-M12 · Callable handlers spread across triggers/scheduled/helpers** (10
  files outside `callable/`).
- **Q-M13 · `react-hooks/exhaustive-deps` is warn-only** and `lint` has no
  `--max-warnings`; the 14 warnings can grow silently.
- **Q-M14 · `src/App.jsx` (785 lines) is `@ts-nocheck` and untested**, and
  contains auth bootstrapping + analytics + routing. Extract the auth-state
  effect into a tested hook.

**Low**

- Q-L1 · `max-lines` (700) is warn; 9 files exceed it.
- Q-L2 · 4 unguarded `console.log` in src (`api/pushNotifications.ts:129,245`,
  `index.jsx:48,51`, `Onboarding.jsx:520`, `useScoresData.ts:533`).
- Q-L3 · `src/api/index.ts` `export *` chains through `functions.ts` and 3
  more modules — cycle risk and poor tree-shaking.
- Q-L4 · 39 weak assertions in src tests that only prove "didn't throw".
- Q-L5 · `firebase.json` has no `emulators` block; ports live in
  `src/config/index.ts:207-212`, `e2e/firebase.json`,
  `functions/rehearsal/firebase.json`.
- Q-L6 · No general dev seed; `e2e/seedEmulator.mjs` is the only playable
  world. Promote to `npm run seed:local`.
- Q-L7 · `.env.local.example` exists but no `.env.example`;
  `VITE_USE_EMULATORS` documented only in `vite-env.d.ts`.
- Q-L8 · The deploy secrets loop (`deploy-functions.yml:265-300`) creates a
  new Secret Manager version on every run.
- Q-L9 · `firestore-tests` run twice on push (`ci.yml` and
  `deploy-functions.yml`).

### Top 10 modules to test first

1. `functions/src/callable/admin.js` — privileged writes, 0 tests.
2. `functions/src/scheduled/leagueAutomation.js` — season-end payouts.
3. `functions/src/helpers/leagueArchival.js` — destructive, same path.
4. `functions/src/helpers/economy.js` — every CC ledger write.
5. `functions/src/helpers/season.js` — rollover.
6. `functions/src/callable/podiumJoint.js` — money + podium settlement.
7. `functions/src/scheduled/lifetimeLeaderboard.js` — public ranking rewrite.
8. `src/api/functions.ts` + `podium.ts` + `leagues.ts` — the client/server
   contract.
9. `functions/src/helpers/xpCalculations.js` — level/unlock gates.
10. `src/hooks/useScoresData.ts` (797) — feeds every score view.

### Quick wins

1. Gate deploy workflows on CI success (`workflow_run`).
2. `--test-coverage-include='src/**/*.js'` in functions `test:coverage`;
   re-baseline.
3. `--max-warnings 14` on `npm run lint`.
4. Add `EngagementData.weeklyLoop/streakMilestones` to `src/types/user.ts`,
   then drop `@ts-nocheck` from `DailyChallenges.jsx`.
5. Delete the dead `analytics.log*` helpers or wire three of them.
6. Prettier override for `functions/`; fix the dangling
   `functions/eslint.config.js` reference.
7. Extract `EASTERN_CLASSIC_DAYS = [41, 42]` and `CLASS_FINALS_DAY = 46`
   into `captionWindows.js`; replace the five literals in `scoring.js`.
8. A 30-line `checkMirrorConstants.mjs` CI step deep-equalling the six
   mirror pairs.
9. Gate the four stray `console.log`s on `import.meta.env.DEV`.
10. Seed an Auth-emulator user in `e2e/seedEmulator.mjs` and add one
    signed-in "save lineup" spec.

## G. Game design, economy, and scoring

_(pending)_

## H. SEO, public surfaces, and communications

_(pending)_
