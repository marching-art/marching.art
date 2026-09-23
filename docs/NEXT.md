# What's next — the living backlog

**This is the only file to read when deciding what to work on.** The audit
documents (`SITE_DEEP_DIVE_2026-07.md`, `CODE_ANALYSIS_2026-07.md`,
`LEAGUES_AUDIT_AND_PLAN.md`) are historical records: every ranked finding in
them has been actioned, and re-verifying them item by item is how a session
burns an hour to conclude "everything's about covered." Don't. If you ship,
cut, or discover something, edit THIS file in the same PR — that's the whole
maintenance contract.

_Last updated: 2026-09-23 (**Championship Week cards open the show sheet** — community report: tapping a Championship Week round on the Schedule did nothing, while every regular-season card opens `ShowRegistrationModal`. `ChampionshipEventCard` was a plain div with no handler, though the modal already rendered a championship show (auto-enrollment panel, eligible classes, Podium attendance, `DualRunningOrder` + advancement label). Now the card is a keyboard-reachable button (mirrors `ShowCard`: past rounds stay read-only) and hands the modal `scheduleUtils.championshipModalShow(event, scheduled)` — the joined schedule row when `championshipShowFor` found one (real field, advancement, weather), else a show synthesized from the `CHAMPIONSHIP_EVENTS` constants so the sheet opens before the round is stamped; the venue is always the card's fixed site and the row is always `isChampionship`, so the modal never offers manual registration. Tests in `scheduleUtils.test.js`; changelog (fix) entry; `@ts-nocheck` 37 → 36 (`pages/ScheduleParts.jsx` fully typed: `fantasyCorpsEntries` narrows the profile's untyped corps map once, `classConfigFor` keys `CLASS_CONFIG`, hosted records typed `Partial<HostedEventRecord>`)). Previous: 2026-09-22 (**Podium route: tonight's show leads the itinerary** — community report: on Day 45 (Open & A Prelims in Marion) the Upcoming Route said the corps was still in Centerville "since day 45" and routed Day 46 (Finals, also Marion) as a 122-mile day trip. Root cause: the nightly 9 PM ET run is what performs a show and sets `state.lastVenue`, and the active day rolls at that same moment, so all day long today's show is unprocessed — but `buildRoutePreview` only listed days strictly after today (so the cursor never advanced through tonight's venue) and `buildCurrentLocation.sinceDay` counted today as the day that moved the corps. Now the preview starts at today (`buildRouteLegs(…, { today })` flags the leg `isToday`), `sinceDay` scans days before today and the origin carries `showToday`; the panel marks the Tonight leg, words the Now row accordingly, and swaps the airfare toggle for a fly/bus note on tonight's leg (`setPodiumAirfare` refuses days ≤ today). Tests in `podiumRoute.test.js`; changelog (fix) entry; `@ts-nocheck` 38 → 37 (`Podium/CorpsConditionPanel.jsx`)). Previous: 2026-09-22 (**Nightly failure markers + rollover watchdog** — see Recently shipped; the two Backend-reliability S items are struck above, with the manual-rerun gap left as a new S). Previous: 2026-09-22 (**Championship Week weather, season-calendar dating** — community report: the Championship Week panel showed no weather (its cards render from `CHAMPIONSHIP_EVENTS` constants, never the schedule row that `scheduleWeather` stamps), and the producer dated shows from `comp.date` — the archive night an off-season row replays, years old — so every off-season card carried the replayed year's weather, while generated championship rounds (date null) fell back to start + day − 1 and ignored spring training in live seasons. Now `gameDay.competitionDayToDate/IsoDate` is the one server-side day→date (start + springTrainingDays + day − 1, the client `competitionCalendar` twin), and `scheduleWeather`, `scheduleRunningOrder.competitionDate` and `newsData.fetchShowContext.rawDate` all date from it; the weather entry carries `date`, and `sameWeather` treats an undated legacy entry as stale so one producer pass re-dates the whole season. Client: `scheduleUtils.championshipShowFor` joins each Championship Week card to its schedule row (name-folded, sole-row and SoundSport-vs-not fallbacks) for venue + weather, and the chip is one shared `WeatherChip`. Changelog (improvement) entry. Owner step: nothing — the next 5 AM / 6 PM ET producer pass re-dates every card; force-run `scheduledScheduleWeather` to see it today). Previous: 2026-09-22 (**Championship-week fantasy running orders** — community report: on Day 45 (Open & A Class Prelims) the schedule's fantasy running order listed the heritage engine's synthesized DCI cast, not the Open/A directors, and would have all week. `scheduleRunningOrder` deliberately skipped championship rounds on the fantasy side. Now the registration index carries the auto-enrolled rounds (`showRegistrations.collectRegistrationsFromProfile(uid, profile, { championships })`, fed by the nightly rebuild from `loadChampionshipCompetitions` and cleaned on account erasure), the producer builds every round from it — standings as the stand-in until the rebuild has run — and narrows 46/48/49 to the prior night's cut via the scorer's `buildChampionshipConfig`, stamping `fantasySchedule.advancement {fromDay, rule, status}` that RunningOrder labels; `transformCompetitionToShow` never falls back to the heritage lineup for a championship round. Changelog (fix) entry; `@ts-nocheck` 41 → 40 (`utils/scheduleUtils.js`, with `RawCompetition`/`FieldSchedule` typedefs now shared by `showday.js` and `scheduleStore.ts`). Owner step to land it today: run the admin `updateLifetimeLeaderboard` callable (index rebuild), then force-run the `scheduledScheduleRunningOrderEvening` job — otherwise the 6 PM ET pass fills Day 45 from the standings and the 3 AM UTC rebuild + 6 AM ET pass complete it). Previous: 2026-09-22 (**Podium staff names** — directors can name each staffer (at hire via `hirePodiumStaff.name`, or later via the new `namePodiumStaff`); names are unique game-wide through the `podium-staff-names` registry (`helpers/podium/staffNames.js`: canonical key folds case/accents/punctuation; claim + release happen inside the roster transaction, so an in-season release, a lapsed/released/retired contract at re-registration, a fresh start and account deletion all free the name; a taken name tells the director which corps has it). Admin moderation in Admin → Content (`podiumStaffModeration.js`: `listPodiumStaffNames` registry pager, `moderatePodiumStaffName` clear = strike / revoke / restore, three strikes auto-revoke via `profile.moderation.staffNaming`, director notified in-app with the new `staff_name_removed` / `staff_naming_restored` types). `getPodiumState.staffNaming` tells the panel when naming is off. Names surface on the staff cards, the retention picker and the registration summary. Guide §11 + PODIUM.md §5.6 updated; changelog (feature) entry. Left open: no client-side profanity list — the server regex is a coarse first pass and the admin registry is the real filter). Previous: 2026-09-22 (**Off-season judging variance** — a community question ("Open/A championship scores come from the real prelims/semis/finals, right?") surfaced that an off-season replays a public archive verbatim, so every lineup's exact score on every night, championship included, was computable before Day 1. `OFF_SEASON_STRATEGY.baseScore` now passes every caption (real, carried, projected) through `scoringMath.flutterCaptionScore`: uniform ±`OFF_SEASON_FLUTTER` (0.05, one grid step), zero-mean, FNV-seeded on `seasonUid|day|corps|year|caption` so it is identical for every director drafting that caption that night, reproduces on a reprocess, and re-rolls each off-season. Sized deliberately: shared per pick, it can only re-order lineups within a caption swap of each other (#1 vs #2 spreadsheet lineups), never lineups tenths apart. `LIVE_SEASON_STRATEGY` is untouched and tested exact. `carryForwardScore` moved into `scoringMath.js` beside the cache it reads. Docs: GAMEPLAY.md, How-to-Play scoring FAQ; changelog (balance) entry added. `@ts-nocheck` ratchet: 46 → 45 (`pages/Admin.jsx`)). Previous: 2026-09-22 (**Podium staff careers, finished** — community question ("do my staff go back into a pool when the contract ends?") exposed three gaps: contracts locked pay only for the cheap first 1–3 seasons with no way to re-lock at the promotion raises, dead scarce-pool config (`marketPerSpecialty`/`masterChance`/`legendChance`) and stale copy still described poaching, and tier bases made a Legend cost 4x an Apprentice per boost point. Shipped: **re-sign** a lapsed lock at re-registration (`registerPodiumCorps.staffContracts` → `validateStaffContracts` → `projectRetention(…, renewals)` → `staffMarket.renewContract`; never on a still-locked contract); **buyouts** both ways (`staffMarket.buyoutFor`: `buyoutPremium` × salary × unexpired seasons, charged in `releasePodiumStaff` and — before payroll — in the register plan, never on an unaffordable lapse); balance: tier bases proportional to boost (120/160/200), `tenureSalaryCapSeasons: 22`, `retirementNoticeSeasons: 3`, dead keys removed (no employed staffer changes price — nobody is past Journeyman yet); `getPodiumState.staffCareer` feeds the rebuilt `PodiumStaffPanel` (contract line, next rung, retirement notice, confirm-with-buyout release) and the new `PodiumStaffRetention` re-sign picker split out of `PodiumRegistration`; guide §11, PODIUM.md §5.6 + dormancy, career.js header corrected; changelog entry; `@ts-nocheck` 46 → 45 (`PodiumStaffPanel.jsx`). Left as-is, deliberately: `maxTotalBoost` 0.15 still equals one Legend, so on multi-caption blocks two Veterans already cap it — a yield-balance question for its own PR). Previous: 2026-09-18 (**Eastern Classic fantasy nights** — the schedule's fantasy running order listed every registrant on BOTH Allentown nights: `scheduleRunningOrder` read the one registration doc (keyed by night one's date) for each night and seated the whole field twice. It now looks the index up under night one's key for either night and seats only that night's corps via `easternSplit.nightFieldFor` (published final > preview from `eastern-classic/{seasonUid}`, else a provisional snake over the registrants seeded from standings), stamping `fantasySchedule.night` `{day, nights, status}` that RunningOrder labels ("Night 1 of 2 · provisional split, lineups announced Day 39"). Discord: the Eastern stage now also posts the FINAL locked split with night one's drop (`easternClassicDiscord.announceEasternFinal`, diffed against the announced lineup so moved/joined/dropped corps are named; lease `{seasonUid}_eastern_final`, day 41 only). Changelog entry added; community report). Previous: 2026-09-14 (**Directors page** — `/directors`: a player directory for signed-in directors built to scale: a `directory/{uid}` index row per director written by the profile mirror trigger, read straight from Firestore 50 rows a page (browse by `usernameKey`, search by word-prefix `searchTokens`, total via `count()`), rules-capped at 50 per list; **username reservation repair** workflow (older account keeps a shared name, newer one gets `name2` + a prompt to pick a new one); linked from Explore + the mobile More sheet; App.jsx gallery routes folded into one `GalleryPage` helper). Same day: (**No rehearsing after the show** — in both divisions the day closes with the show and the next day opens at 2 AM ET: Podium rehearsal blocks are refused from the 9 PM ET roll until 2 AM ET with a lights-out planner state, and fantasy caption changes now lock every night at the 8 PM ET boundary, not only Saturdays; the lineup-lock reminders key on the new `allotmentEndsAt` so nightly locks never ping). Previous: 2026-09-13 (**Firestore indexes reconciled** — console pruned to the 12 composites in `firestore.indexes.json` (exact match, verified row by row), a duplicate profile collection-group index deleted, and two indexes the console had been MISSING created: `articles` CG (authorUid, isPublished, createdAt) for the Newsroom's director-articles list and `news_submissions` (authorUid, createdAt) for "my submissions" — both queries had been failing with missing-index errors; ops item closed. Firestore indexes: `firestore.indexes.json` pruned 31 → 13 composites (+1 added that code needs) and the `users.seasonYear` override dropped, every survivor matched to a live query; the file no longer triggers a functions deploy; the console deletion is an owner step with the explicit list in the ops section. Stale league matchups: "Archive stale league matchups" run #1 (COMMIT, 22:09Z) scanned 21 leagues and found 0 stale weeks — no league is frozen; ops item closed. Four leagues report "no matchup weeks" (World Corps Association, North American Marching Arts Association, The Grandmasters Table, Cheese Appreciaters United) — expected for non-matchup formats, worth a glance if any of them is head-to-head. **Lineup privacy flipped** — `profile/data` is owner/admin-only in rules after the backfill workflow wrote 125/125 `profile/public` mirrors; raw-doc fallbacks dropped from `api/profile.getPublicProfile` and `api/leagues.getMemberProfiles`; rules tests flipped + owner/admin reads added; ops item closed). Same day: (storage bucket done — `VITE_FIREBASE_STORAGE_BUCKET` secret set ~2026-08-30, run #446 confirms `marching.art` linked and `storage.rules` released with no warning; ops item closed. `main` ruleset imported and Active — seven CI checks required, no bypass; ops item closed. BMAC webhook confirmed live — endpoint Active on the function URL, test event answered 200 "Ignored (test event)", signature verified; ops item closed. Podium medal correction re-run with commit on the show-field rule — 21 recap days / 83 rows re-ranked, 23 live medal counters rebuilt; ops item closed. Overture days 19–23 will NOT be re-scored — owner decision, the five hash-ordered nights stand as posted; ops item dropped). Same day: (Podium corps badged on BOTH Eastern Classic nights on the Schedule page + registration modal, matching fantasy — shared `utils/podiumAttendance` helpers now feed ScheduleParts, the modal and tourStops; community report). Same day: (firebase-admin 14.4 everywhere + functions/scraper/scripts migrated to the modular `firebase-admin/*` API; `uuid` advisory closed via a scoped `gaxios` override; unused `firebase-functions-test` dropped). Previous: 2026-09-12 (Scores page highlights every one of the director's corps — all fantasy classes + Podium, matched by uid with a name fallback via `utils/corps.buildViewerCorpsMatcher` / `isViewerCorps`; community report). Previous: 2026-09-11 (league chat rebuilt — threaded rows, reactions, replies, @mention picker, report control, scroll that stays put, optimistic sends, `lastChatAt` unread dot on the league card). Previous: 2026-09-09 (score-age column on the Fantasy + Podium season standings); 2026-09-06 (director-authored articles exempt from the score-reveal gate — dead Discord/notification links fixed; scheduled-vs-pending admin email + working admin deep link; assistant director fades with consecutive days
away; Podium field = the registered field; majors and championship rounds
carry the Podium roster; roster audit workflow; season re-mint guard). Previous: 2026-09-04 (site-review row 20 — one onboarding checklist (the Journey; Quick Start modal deleted, `?reveal=` deep link) and one How-to-Play route by auth state; device-aware install guide at /install — in-app-browser detection with an Open-in-Safari/Chrome escape hatch, per-browser steps, one-tap native install, linked from footer / ? menu / home / Settings / the nudge; site-review row 19 — honest functions coverage gate, first admin / league-automation tests; row 18 — one-click unsubscribe + List-Unsubscribe headers, noindex auth wall; row 17 — vendor-firebase trimmed, GameShell + overlays lazy for guests; row 16 — focus traps + Escape in every raw dialog, icon buttons named; row 15 — one dashboard interrupt per visit, celebrations to the inbox; row 14 — weekly XP / win bonus / finish bonus paid per director; row 13 — league weeks decided per show, percentile edge cases; row 12 — server-enforced age gate + consent-gated analytics; AI imagery now built from the full Uniform Studio design + rendered reference image; main ruleset + gazetteer PR flow; site-review Fix-first 1–11 + quick wins shipped)._

## In progress

_(nothing — pick from "Fix first" or the bets below)_

## Fix first — 2026-09 full site review (ranked top 20; each is one PR)

[SITE_REVIEW_2026-09.md](SITE_REVIEW_2026-09.md) is a fresh, independent,
code-first review of the whole product (security, backend, frontend, UX,
a11y, quality, economy, SEO/comms). Its **Part 1 backlog table** is the
queue: work it top-down, and tick items off here as they ship.

_(**All 20 rows shipped.** Rows 1–17 — S-H1, B-H1, N-H1, F-H3, B-H3, G-H3,
Q-H1, F-H2, F-H1, B-H4, B-H6/S-M6, S-H2/S-H3, G-H2/G-M10, G-H1/G-H7, U-H4,
A-H1/A-H2, F-H4/F-M2 (+ F-M1), N-H2/N-H6, Q-H2/Q-H3 — and all eight
"Cross-area quick wins" shipped 2026-09-03; row 20 (U-H1 / U-H6, with U-L9)
shipped 2026-09-04: the Quick Start modal and its `?panel=quickstart` route
are deleted, the First Season Journey / Podium Rookie Journey is the one
checklist (reached by `/dashboard?reveal=journey-panel` from the ? menu, the
mobile More sheet and the guide's Getting Started — `hooks/useRevealParam`),
the desktop tour lost its generic welcome card, and `/how-to-play` is the one
guide route (`App.jsx HowToPlayEntry`: the in-app Game Guide signed in, the
public page signed out; `/guide` and `/soundsport` redirect). The remaining
Part 1 items are the mediums/lows in the review's per-area findings — pick
from the audit backlog below. Still open from
F-H4: `re2js` (144 kB) rides in via Firestore's pipelines support — track
upstream for a pipelines-free entry.
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
- ~~**P2** Isolated nightly stages swallow pre-lease failures~~ — shipped
  2026-09-22 (see Recently shipped): every isolated stage writes a
  `scoring_runs/stage_*` marker before swallowing.
- ~~**P2** `seasonScheduler.js` runs rollover with no `retryCount`, no
  try/catch, no alert; watchdog doesn't check `season_rollovers`~~ — shipped
  2026-09-22. Still open from it: a failed `season_rollovers/{seasonUid}`
  lease (rollover threw AFTER the new season doc landed) is reported every
  morning but can only be re-run by hand — add an admin callable that
  re-claims the failed lease and re-runs `rolloverFromOldSeason` for that
  season (`helpers/season.js`), with a button beside Season Operations. (S)
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
- **P3** `vendor-firebase` is still the largest eager chunk (647 kB / 189 kB
  gzip after app-check + analytics left it, 2026-09-03); the remaining fat
  is Firestore itself plus `re2js` — nothing to trim until upstream ships a
  pipelines-free entry. (S)

### SEO, accessibility & UX

- **P3** Dashboard and NotFound have no `<h1>`. (Focus traps, Escape and
  icon-button names shipped 2026-09-03 — `dialogFocusTrap.test.ts` now fails
  on any new `role="dialog"` without `useFocusTrap`; the `ui/Modal` /
  `IconButton` adoption ratchet remains.) (S)
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
- **P2** No report control on profile comments or instant-publish press
  releases; article comments and league chat (`reportLeagueMessage`, writes
  a typed `reports` row) have one. Reuse the same shape. (M)
- **P3** League chat reports land in `reports` with `type: "league_message"`
  but the admin moderation tab renders only `type: "comment"` rows — add the
  league-message case (show `leagueName`, link to `/leagues/{id}/chat`). (S)
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
- **P3** `firestore.indexes.json` — pruned 31 → 13 and dropped from the
  deploy path filter 2026-09-13 (was P2); what remains is an indexes diff
  step in CI (compare the file against `firebase firestore:indexes` output
  with read-only credentials and warn on drift). (S)
- ~~**P2** `firebase-admin` major drift~~ — closed 2026-09-13: every
  package (`functions/`, scraper, `scripts/`, root) is on `^14.4`, and the
  functions tree was migrated off the namespaced `admin.*` API that v14
  removed (see Recently shipped). `npm audit` is 0 in all four. Still open
  from this item: `.npmrc` `legacy-peer-deps=true` stays because
  `eslint-plugin-react@7.37.5` (latest) caps its `eslint` peer at `^9.7`
  while we run eslint 10 — drop the override when upstream ships a
  release that declares 10. (S)
- **P3** `hosting.ignore` doesn't exclude `**/*.map`, so hidden source maps
  are publicly fetchable (`firebase.json:36`, `vite.config.js:55`). (S)
- **P3** No root `engines` / `.nvmrc` (functions pin Node 22, `@types/node`
  is `^26`); `react-firebase-hooks` (unmaintained) exists for one
  `useAuthState`. (React 18 → 19 landed 2026-09-14.) (S)
- **P3** Four `workflow_dispatch`-only migration workflows are documented
  nowhere; ARCHITECTURE.md lists 5 of 9. Table + delete the finished ones. (S)

### Repo hygiene, DX & test posture

- **P2** Every e2e spec is unauthenticated (`e2e/*.spec.ts`); the auth
  emulator is wired (`e2e/firebase.json:4`) but no signed-in journey exists.
  One authed core-loop spec (register → lineup → shows → league). (M)
- **P2** Frontend coverage floors are global-only — add per-glob floors for
  `src/utils/**` and `src/api/**`. (The 13-point lag against reality is gone:
  the global floors were raised to 30.5 / 24.5 / 26.4 / 30.4 in the 2026-09-10
  Dependabot sweep below.) (S)
- **P2** Money and abuse-control helpers with no direct tests:
  `helpers/leagueEconomy.js`, `helpers/rateLimit.js`,
  `helpers/leagueArchival.js`, `helpers/engagementRewards.js`,
  `helpers/xpCalculations.js`, `callable/seasonLadder.js`,
  `callable/dailyOps.js` claim/streak, `scheduled/lifetimeLeaderboard.js`.
  The functions coverage gate now counts every deployed module (honest
  floor 66 / 79 / 76); the least-covered are `newsDciArticles`,
  `newsFantasyArticles`, `podium.js` (callable), `newsData`, `newsEditorial`,
  `podium/processor`, `newsAdmin`, `rookieLeague`, `scrimmagePass`,
  `articleComments` — all under 30% lines. (M)
- **P3** `lint` is at zero warnings and gated (`--max-warnings 0`, 2026-09-04),
  so any new warning fails CI; still open: `e2e/**`, `scripts/**` match no
  ESLint block and `tsconfig.json` includes only `src`; no type-aware rules
  (`no-floating-promises`) in a codebase that is almost all async I/O. (M)
- **P3** `max-lines` (700) no longer warns anywhere the ESLint blocks reach
  (the 2026-09-04 split of `MatchupsTabParts`, `MatchupDetailView`,
  `uniformFigureParts`, `StudioEditor`, `ShowRegistrationModal`,
  `CorpsHistory`, `Onboarding`, `callable/admin.js`, `emailService.js`,
  `seasonRollover.test.js`). Files the rule does not see are still long —
  `helpers/scoring.js` (1215), `callable/leagues.js`, `callable/lineups.js`,
  `triggers/newsGeneration.js`, `helpers/podium/{processor,career}.js`,
  `triggers/newsSubmissions.js`, `callable/corps.js`, `hooks/useTickerData.ts`,
  `pages/GuestDashboard.jsx` — split by concern when next touched. (L)
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

- **Seed the director directory index** — after the functions deploy that
  carries `helpers/directory.js`: Actions → "Backfill public profile mirrors"
  → Run workflow (dry run, then commit). It now writes `directory/{uid}`
  alongside each `profile/public` mirror; until it runs, `/directors` lists
  only directors whose profile has been written since the deploy (the trigger
  seeds rows incrementally). Idempotent; ~2 writes per profile.

- **Backfill username reservations** — the Directors page surfaced that some
  older accounts have a username on the profile but no `usernames/{lower}`
  reservation doc, so their `/profile/@handle` link 404s and nothing stopped a
  newer director claiming the same name. Actions → "Backfill username
  reservations" → Run workflow: dry run first (unchecked) and read the
  `RESERVE` / `RENAME` lines, then run again with commit checked. Rule: the
  OLDEST account (profile `createdAt`; missing = oldest) keeps a shared name;
  each newer one is renamed to the name + the smallest free number
  (`alice2`), reserved for them, flagged `usernameTemporary`, and told why in
  their inbox — the username prompt modal then asks them to pick a new name
  (deferrable) until `updateUsername` clears the flag. Idempotent. Script:
  `functions/src/scripts/backfillUsernameReservations.js`.

- **Flip App Check enforcement** — monitor phase started 2026-09-13: a
  score-based reCAPTCHA Enterprise key (`marching-art`, domain `marching.art`,
  no challenges) was created, the web app registered under reCAPTCHA
  Enterprise in Firebase console → App Check, the key ID set as the
  `VITE_APPCHECK_RECAPTCHA_SITE_KEY` repository secret, and the client switched
  to `ReCaptchaEnterpriseProvider`. Next: after the hosting deploy that carries
  it, watch console → App Check → APIs → Cloud Functions for ~a week; when
  Verified is nearly all traffic, flip the literal in `functions/index.js`
  (`enforceAppCheck: false → true`) and let the functions deploy run. Flipping
  blind locks out clients on stale cached bundles; roll back by flipping it
  back.

## Evergreen ratchets (any session, any size)

- `@ts-nocheck` paydown — **37 files** at
  last update; `npm run ts-nocheck:next` ranks the cheapest (no free wins
  left — the cheapest `src/` files are ~14 errors). It needs `npm ci` first
  and refuses to report on any other compiler. One per substantive task is
  the CLAUDE.md habit; batches welcome.
- Frontend coverage floor upward — floors now sit just under actual
  (30.5 / 24.5 / 26.4 / 30.4 against 30.90 / 24.90 / 26.83 / 30.78); keep
  raising them to within a point of actual whenever coverage is touched
  (functions are held to 70/80/85).
- ESLint warnings: held at zero by `lint --max-warnings 0` — fix, never
  suppress, anything that shows up.
- React Query migration of the remaining manual-fetch components.
- `ui/Button` / `ui/Modal` / `IconButton` adoption; authed-app axe pass (the
  untrapped-dialog and unlabeled-icon-button tallies are at zero as of
  2026-09-03; `dialogFocusTrap.test.ts` keeps the first one there).
- Long files: the `max-lines` warning is clear; the files it cannot see
  (list above) still want a split by concern — not by size — when next
  touched.

## Recently shipped (context, newest first — prune when stale)

- 2026-09-22: **Podium route starts with tonight's show** — `podiumRoute.js`:
  `buildRoutePreview` includes the active day (the nightly run hasn't ridden
  it yet), `buildRouteLegs` takes `today` and flags that leg `isToday`,
  `buildCurrentLocation.sinceDay` is the last show BEFORE today and the
  origin reports `showToday`. `CorpsConditionPanel` shows a Tonight chip,
  re-words the Now row, and renders `TodayAirfareNote` (fly-or-bus, no
  toggle) on tonight's long leg. Client types gained `isToday`, `label`,
  `airfareStranded`, `showToday`. Four new `podiumRoute.test.js` cases.
  Changelog (fix). `@ts-nocheck` 38 → 37 (`CorpsConditionPanel.jsx`).
- 2026-09-22 (ops): **Nightly failures the watchdog can see** — the isolated
  stages (Discord drop, Eastern Classic, Showcase, Podium nightly, Podium
  drop, Fan Favorite) write a `scoring_runs/stage_{stage}_{date}` failure
  marker before swallowing (`scoringRunGuard.recordStageFailure`; Podium's
  is kind `scoring`, the side channels `announce`), the 3 AM
  `seasonScheduler` is wrapped (`runSeasonScheduler`: marker in
  `season_rollovers/scheduler_{date}`, critical #operations page,
  `retryCount: 2`), and the 4:30 AM watchdog scans `season_rollovers` for
  failed/stale rollover leases and scheduler markers — critical severity,
  with the "not retried, re-run by hand" note in the alert. Docs:
  OPERATIONS.md (what the watchdog reads), ARCHITECTURE.md, INTEGRATIONS.md.
  Ratchet: `LeagueInviteModal.jsx` typed (38 headers left).
- 2026-09-23 (schedule): **Championship Week cards open the show sheet** — each
  round on the Week 7 panel now opens the same registration/running-order
  modal a regular card does (auto-enrolled corps, admitted classes, Podium
  attendance, the real field + advancement cut once stamped), from the
  schedule row or the constants. See _Last updated_.
- 2026-09-22 (schedule): **Championship-week fantasy running orders** — the
  auto-enrolled rounds are in the registration index, the producer builds
  days 45–49 from it (standings stand in until the rebuild), advancement
  rounds narrow to the prior night's cut with a pending/final stamp the
  running order labels; no more DCI stage cast as the fantasy order. See
  _Last updated_ for the file map and the one-time owner step.
- 2026-09-22 (Podium): **Staff names** — name a staffer at hire or from the
  card; unique across the game via the `podium-staff-names` registry, freed
  when the staffer leaves; admin clear/revoke/restore with strikes in
  Admin → Content. See _Last updated_ for the file map.
- 2026-09-22 (dependencies): Dependabot sweep — #1567–#1572 consolidated
  into one branch. Root lockfile regenerated once for the combined
  production + dev groups and jsdom 27 → 30 (major); `functions`,
  `functions-scraper`, `firestore-tests` took Dependabot's lockfiles after
  `npm ci` verified clean. jsdom 30 resolves `rem` to px in computed style,
  so `Spinner.test.tsx` now asserts the inline `height` instead. Audit
  ratchet unchanged at all zeros. `@ts-nocheck` ratchet: 43 → 42
  (`ShowSelectionStep.jsx`), which surfaced the setup wizard never passing
  `eventDate` to `ShowRegistrationModal` — its registration-close notice
  now shows there too. Changelog entry added.
- 2026-09-22 (Championship Week class lockout wording — player report):
  on Days 45-46 World Class and SoundSport sit out (only Open/A compete),
  but the lineup modal badged them "Class Season Complete" / "This class has
  finished competing". The caption window now carries `classResumesDay`
  (`nextClassChampionshipDay`, mirrored in `captionWindows.js` and
  `seasonClock.js`) plus `reopensAt`, so a class that hasn't started reads
  "Class Competes Day 47 · reopen …" and saveLineup names the day; a class
  that is actually done (Open/A, Days 48-49) keeps the season-complete copy.
  Rules unchanged. `@ts-nocheck` 44 → 43 (`Schedule/HostEventCard.jsx`).
- 2026-09-22 (Podium staff careers — community question): staff never
  enter a pool; a contract locks pay, not employment. Re-sign a lapsed lock
  at re-registration (`staffContracts`, 1–3 seasons at the floated rate; a
  still-locked contract is never renewable so a price can't roll forward
  forever), buyouts on an early release in season or at the boundary
  (`buyoutFor`, `buyoutPremium` 0.25 × salary × unexpired seasons; never on
  an unaffordable lapse), tier bases proportional to boost
  (40/80/120/160/200), tenure premium capped at the Legend threshold,
  retirement notice from 3 seasons out, next-rung line on every staff card.
  Balance is safe to change now because no live staffer is past Journeyman.
  Open question for a later PR: `maxTotalBoost` (0.15 = one Legend) makes
  tenure past two Veterans worthless on multi-caption blocks.
- 2026-09-14 (Directors page — community request for a basic profile
  search, rebuilt the same day to scale to tens of thousands): `/directors`
  (`pages/Directors.tsx`) reads the `directory/{uid}` index straight from
  Firestore (`api/directors.ts`): browse = `orderBy(usernameKey)` + cursor,
  50 a page, infinite scroll (IntersectionObserver sentinel + Load more
  fallback); search = ONE `array-contains` on `searchTokens` (every 2–12
  char prefix of every word of username / display name / corps names —
  `helpers/directory.js`) for the longest typed word, remaining words
  checked locally on that page (`utils/directorSearch.ts`); total = a
  `count()` aggregation. Rules: signed-in reads, `list` only with
  `limit <= 50`, server-only writes. The row is written by
  `triggers/profileMirror.js` alongside `profile/public` (strict subset of
  the public projection + search keys; same skip-when-unchanged logic) and
  once for existing accounts by the mirror backfill (ops item below). A
  top-level collection was chosen over a collection-group query on the
  mirrors so every access path rides Firestore's automatic single-field
  indexes — no composite index, no console step. Cost per visit is one page
  of reads regardless of directory size. Not virtualized: pages of 50 grow
  the DOM only as far as someone scrolls; add a virtualizer only if a real
  director complains. Search is word-prefix only ("orizon" won't find Blue
  Horizon) — fuzzy matching would be a search service, not more Firestore.
  History: v1 keyed on `usernames/{lower}` and dropped every director whose
  reservation doc was missing (→ the reservation repair ops item); v2
  returned the whole list from a callable (fine to ~2k rows, gone). Also:
  the nine identical gallery-skeleton routes in `App.jsx` are one
  `GalleryPage` helper (the file had crossed the 700-line lint ceiling).

- 2026-09-09 (score age on the season standings, from a director suggestion):
  a season standings sheet ranks every corps on its LATEST total, but corps
  don't all compete on the same nights — the #4 line could be last night's
  result while #5 rides a week-old number, and the sheet never said so. New
  **Age** column, immediately right of the movement arrow, on both the Fantasy
  class standings (`ScoresParts → ClassStandingsGrid`) and the Podium Division
  standings (`PodiumReportSheet`). Shared `ScoreAge` primitive +
  `AGE_W` token; pure helpers `scoredDayOf` / `scoreAgeDays` /
  `latestScoredDayOf` in `scoresUtils`. Fantasy reads the day off
  `scores[0].offSeasonDay` (present on both the materialized-standings and
  client-aggregated paths) against the page's `latestScoredDay`, falling back
  to the sheet's own newest day for archived seasons. Podium needed a backend
  field: the processor's standings rows now carry `lastScoredDay` and
  `powerRankings.toEntry` writes it as `lastDay` on every daily-standings /
  power-column entry — sheets written before this render a dash. Changelog
  (improvement) entry added. `@ts-nocheck` ratchet: 60 → 59
  (`modals/UsernamePromptModal.jsx`, which also stopped duplicating the
  onboarding wizard's username format rules and rejection messages —
  both now come from the shared `onboardingUsername` helpers).
- 2026-09-06 (article queue / dead Discord link): a trusted author's 2 PM
  auto-published article announced to Discord but opened as "Article Not
  Found" until that night's drop. Root cause: `publishSubmission` /
  `publishPressReleaseArticle` stamp the day **in progress**, and the client
  score-reveal gate (`useMaxVisibleArticleDay`) hid every reportDay past the
  revealed one — including director-authored articles that carry no spoiler.
  Fix: `seasonProgress.isArticleDayGated` (shared by `Article.jsx` and
  `NewsFeed.jsx`) exempts articles with an `authorUid` and prior-season
  articles; generated coverage is gated exactly as before. Same PR: the admin
  "needs review" email now says **scheduled** for a trusted author (subject,
  copy, 2 PM ET time) and deep links `/admin?tab=content&status=…&submission=…`
  — the old `?tab=submissions` param was never read (`Admin.jsx` tab now lives
  in the URL; `SubmissionsManagement` opens the linked status tab, highlights
  the row, widens to All if it has since moved). Changelog (fix) entry added.
  `@ts-nocheck` ratchet: 61 → 60 (`Landing/NewsFeedCards.jsx`).
- 2026-09-06 (assistant decay): the roster audit for `overture_2026-27`
  found all 59 Day-28 corps registered THIS season (15 on rollover day, ~20
  in one two-hour group session on Aug 20) and zero orphans — the
  Southwestern field was the registered field, carried by the assistant
  director. Decision taken: the assistant now **fades with consecutive days
  away** (`rehearsal.assistantDecay` — 3 grace days, −8 pts/day, 35% floor;
  `engine.assistantYieldFor` keyed on `state.assistantStreak`, reset by any
  played or rest day, extended in the processor's once-per-day activity
  block). `getPodiumState.assistant` carries streak / yield / next yield /
  grace / floor; the Corps Condition panel's Assistant director section shows
  it; guide + PODIUM.md §5.2 updated; pacing harness models the fade. The
  audit log shows each corps' last login and played-vs-assistant days with a
  NEVER-PLAYED tag. Changelog (balance) entry added. `@ts-nocheck` ratchet:
  62 → 61 (`Admin/LiveScoresTab.jsx`).
- 2026-09-06 (Podium field): the nightly processor now partitions the season
  roster (`store.partitionRoster`) — a roster doc whose state is missing or
  holds another season is an orphan: dropped from the night's field, the
  standings sheet, the power column and the rank/medal write-back (which used
  to stamp this season's rank onto archived states), and pruned from the
  roster so every roster reader agrees. `startNewOffSeason` /
  `startNewLiveSeason` refuse to re-mint the active seasonUid
  (`assertNotReminting`; the admin override retries with a confirmed
  `force`, the scheduler's malformed-doc repair passes it). Registration and
  running orders now include the auto-attended field: `store.autoAttendsShow`
  resolves a branded major on its fixed day (Eastern on the corps' assigned
  night) and the championship rounds the corps' division marches (cut
  survivors on 46/48/49 via `loadPodiumAdvancing`), folded in by
  `collectPodiumRegistrations` for `getShowRegistrations` and
  `scheduleRunningOrder` (which builds the Podium side for championship
  comps too — fantasy keeps heritage synthesis there). New
  `auditPodiumRoster.js` + workflow (see Operational). Changelog entry added.
  `@ts-nocheck` ratchet: 63 → 62 (`dailyLoginPayoff.test.js`).
- 2026-09-04 (onboarding): site-review row 20. One checklist — the Quick
  Start modal (three unrewarded steps restating the Journey's first three,
  with its own completion rules) is gone; `JourneyPanel` / `PodiumJourneyPanel`
  share the `journey-panel` id and a `?reveal=<panel>` dashboard deep link
  (`utils/dashboardZones dashboardPanelLink`, honored by `useRevealParam`,
  which switches zone on mobile then scrolls) replaces `?panel=quickstart` in
  the ? menu, the More sheet and the guide. One guide — `/how-to-play` renders
  the in-app Game Guide signed in and the public page signed out
  (`HowToPlayEntry`, SEO in the wrapper); `/guide` redirects. Desktop tour
  opens on the control bar. Changelog entry added.
- 2026-09-04 (lint): every ESLint warning cleared and `npm run lint` now
  runs with `--max-warnings 0`. Ten files split by concern (see DX above);
  the matchup-detail recap folding (`matchupDetailRecaps.ts`) and the
  onboarding username rules (`onboardingUsername.ts`) are now pure, tested
  modules — and the head-to-head history on the matchup detail view now
  actually walks the earlier weeks (it re-scored the current week once per
  past week before).
- 2026-09-04 (dependencies): 17 Dependabot security PRs reviewed. The three
  root/`scripts` ones merged as-is; the other 14 were consolidated into one
  branch because Dependabot's three `functions/` PRs regenerated that lockfile
  under the root `.npmrc` `legacy-peer-deps=true` and dropped the jest peer
  tree, so `npm ci` failed with "Missing … from lock file". Re-done with the
  repo's own npm from each sub-package: `functions` (brace-expansion, jest,
  qs, undici), `functions-scraper` (qs), `firestore-tests` (fast-uri,
  body-parser, re2, ip-address, @hono/node-server, undici, js-yaml,
  brace-expansion, hono, tar). Audit-ratchet baseline 2/7/0/5/7 → 0/0/0/3/0
  (root/functions/firestore-tests/scraper/scripts). `@ts-nocheck` ratchet:
  68 → 67 (`RunningOrder.jsx`: the show prop is typed as a structural subset
  of showday's `ShowLike`).
- 2026-09-04 (medals): Podium medals now follow the division placement
  beside them. The processor ranked the mixed show field and medalled its top
  three while the ledger and recap sheet numbered each division on its own,
  so a "1/3" sat beside a silver and a "2/3" beside a gold. One rule now
  (`functions/src/helpers/podium/showRanking.js`, mirrored on the client by
  `src/utils/podiumMedals.ts` with a config-sync test): place, field size and
  medal are decided within the division, medals only at shows of
  `balance.medals.minFieldSize` corps (the SHOW's field — gating on the
  division's field, the first cut, zeroed every Open/World medal in a season
  where those divisions field two a night). The ledger and the recap sheet
  derive the icon from the on-screen place (so pre-fix recaps render
  correctly too); `correctPodiumMedals.js` + its workflow repair the stored
  rows and the medal counters (see Operational). `@ts-nocheck` ratchet:
  69 → 68 (`PodiumTrajectoryCard.jsx`), then 65 → 64
  (`Dashboard/sections/PredictionGamePanel.jsx`) with the show-field follow-up.
- 2026-09-04 (later still): `npm run ts-nocheck:next` no longer lies. It ran
  `npx tsc`, which in a fresh web container (no `npm ci` yet) falls back to
  the image's global TypeScript 6; that compiler rejects the tsconfig's
  deprecated options and exits before checking a file, so zero per-file
  errors were attributed and all 70 headers were reported as "free wins".
  `scripts/tsNocheckNext.mjs` now runs `node_modules/typescript` directly,
  refuses to run when it is missing or differs from the lockfile pin, aborts
  on any config-level diagnostic or a diagnostic-free non-zero exit, warns
  when headerless files are already red, and captures up to 256 MB of tsc
  output so a long report can't be truncated. `@ts-nocheck` ratchet: 70 → 69
  (`functions/src/scripts/buildPodiumCurves.js`: the logistic grid search
  returns its best fit instead of mutating a closure variable).
- 2026-09-04 (later): the retry ladder alone wasn't enough — a registry
  outage outlasted all three attempts and went red again. `auditRatchet.mjs`
  now stops probing once one manifest exhausts its retries (bounds the run to
  ≈4 min instead of 13) and answers the gate's real question from git: a
  manifest whose package.json + lockfile match `AUDIT_BASE_REF` (CI passes
  `origin/<base branch>`, fetched fresh) cannot have gained an advisory, so it
  passes as verified-via-lockfile. Only manifests whose dependencies changed
  stay unverified; `--tolerate-outage` (set in ci.yml) downgrades those to a
  GitHub warning annotation + step summary instead of a failure, with the
  weekly security.yml audit as the backstop. `--update` still refuses to write
  a baseline during an outage. Default `--fetch-timeout` raised 15s → 30s.
  `@ts-nocheck` ratchet: 71 → 70 (`RehearsalPlanner.jsx`; `usePodium`'s
  `lastPanel` state is now typed).
- 2026-09-04: CI: the dependency-audit ratchet no longer fails a run on a
  registry stall. `scripts/auditRatchet.mjs` tells npm to fail fast
  (`--fetch-timeout` 15s, no internal retries) with a hard cap just above npm's
  bulk→quick fallback, classifies network/5xx errors as transient (JSON
  `error.code`, npm 10's `message: "network timeout at …"`, or stderr), and
  retries each manifest up to 3× with 0/5/15s backoff before giving up with the
  "re-run, not a regression" error. Worst case stays inside the job's 15-min
  budget. `AUDIT_FETCH_TIMEOUT_MS` / `AUDIT_ATTEMPTS` override for slow
  proxies. `@ts-nocheck` ratchet: 72 → 71 (`HallOfChampions.test.jsx`).
- 2026-09-03: site-review row 19 (Q-H2 / Q-H3). The functions coverage gate
  is honest: `src/allModules.test.js` requires every deployed module (46
  were never loaded by any test, so Node's loaded-files coverage never
  counted them) and `test:coverage` pins
  `--test-coverage-include/exclude` (one-off `src/scripts` out). Re-baselined
  from a hollow 70/80/85 to a real 66/79/76 (measured 67.0 / 80.0 / 77.0).
  First tests for `callable/admin.js` (all six callables admin-gated via the
  custom claim, unknown job → not-found, day-range validation, test-email
  guard; 21 tests) and `scheduled/leagueAutomation.js`
  (`triggerMatchupGeneration` guard chain + a real generation; 11 tests).
  `helpers/scoringAwards.js` typed (ts-nocheck 73 → 72).
- 2026-09-03: supporter shout-outs. `helpers/supporterDiscord.js` posts a
  new/upgraded supporter to #announcements (existing webhook secret, no new
  ops) on a tier gain only; `writeSupporterState` now returns the transition
  so callers can tell a gain from a renewal. Named only after the supporter
  links and unless they opted out; unlinked one-time coffees are anonymous.
  `docs/BMAC_SUPPORTERS.md` §4 documents that BMAC's bot never posts and shows
  offline by design.
- 2026-09-03: BMAC webhook hardening. `bmacWebhook` runs on a full vCPU
  with an explicit 30s timeout / 3-instance cap so a cold start answers inside
  BMAC's delivery window (they retry 4× and auto-disable after 10 consecutive
  failures); the setup doc pins the exact endpoint URL and a 405/401 probe.
- 2026-09-03: site-review row 18 (N-H2 / N-H6). One-click unsubscribe:
  `helpers/unsubscribeToken.js` signs `uid.hmac` tokens under a key derived
  from `BREVO_API_KEY` (no new secret to provision), `buildSendRequest` adds
  `List-Unsubscribe` / `List-Unsubscribe-Post` and swaps the footer link for
  the per-recipient URL, the five engagement senders take `{ uid }`, and
  `triggers/unsubscribe.js` (`/unsubscribe` rewrite on both hosts) merges
  `settings.emailPreferences.allEmails: false` on GET (confirmation page) or
  POST (RFC 8058). `ProtectedRoute` renders `AuthWallMeta` (`noindex`) while
  loading / bouncing; robots disallows `/unsubscribe` and `/podium/preview`.
  Privacy §2 and INTEGRATIONS.md updated; 14 new tests.
  `DashboardModalHost.jsx` typed (ts-nocheck 75 → 74). Changelog entry added.
- 2026-09-03: site-review row 17 (F-H4 / F-M2, + F-M1). `api/analytics.ts`
  imports `firebase/analytics` dynamically on consent; `vite.config.js`
  leaves `@firebase/{app-check,analytics}` out of the eager `vendor-firebase`
  group (671 → 647 kB raw, 196 → 189 kB gz) and puts `react-router` in
  `vendor-react` (was in the app index). `GameShell` and the new
  `Layout/AuthedOverlays` (username prompt + celebrations) are
  `lazyWithRetry` chunks behind `user &&`; the app index chunk went
  237 → 142 kB raw (70 → 42 kB gz), so a signed-out visitor no longer
  downloads the signed-in shell. `OnboardingParts.jsx` typed (ts-nocheck
  76 → 75). Changelog entry added.
- 2026-09-03: site-review row 16 (A-H1 / A-H2). `useFocusTrap` (and, where
  missing, `useEscapeKey`) in the 13 hand-rolled dialogs that lacked them;
  `components/a11y/dialogFocusTrap.test.ts` fails on any `role="dialog"`
  file without a trap (allowlist for hook-delegated traps). ~40 icon-only
  buttons got `aria-label`s and 44px hit areas (modal close buttons, week /
  scroll arrows, league settings, copy invite code, template load / delete,
  comment options, send test email). `CorpsCoinModal.jsx` typed (ts-nocheck
  77 → 76). Changelog entry added.
- 2026-09-03: site-review row 15 (U-H4). `useModalQueue` shows at most one
  automated interrupt per dashboard visit (`MAX_INTERRUPTS_PER_VISIT`); the
  rest stay queued and re-enqueue from their profile flags next mount, and
  the queue stamps `sessionStorage` (`ma:interruptShown`) so
  `PWAInstallPrompt` yields for the session. Achievements and class unlocks
  no longer queue a modal: the claim's reward moments are built by
  `helpers/rewardMoments.js` (achievement_unlocked, level_up, new
  `class_unlocked` deep-linking to `/dashboard?panel=register`; backstop
  unlocks silent; 7 tests) and the dashboard shows a toast.
  `AchievementModal`, `ClassUnlockModal` and the `DashboardModals` re-export
  shim are deleted (ts-nocheck 78 → 77). Changelog entry added.
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
