# Gamification Execution Plan — The Tactical Layer

> **PROGRESS (July 2026):** PRs **1–12 have landed** (all commits on this branch). WS0–WS3 complete (see history), plus: **WS4** — chat composer renders only where the conversation is visible, champion crownings hit the activity feed, tie rendering matches the unified `'tie'` convention, **league prediction pools live** (25 CC daily buy-in, perfect-day winners split the pot, carry-over, settled in the guarded nightly run, LeaguePoolCard on the league page), and Firestore rules added for the league `activity`/`recaps`/`meta`/`pools` subcollections (**the first three were unmatched → the activity feed's client reads were silently denied**, a new finding: F19). **WS5.1–5.4** — the Trophy Case reads the real server-awarded trophies, shop titles/theme swatches render on league standings rows (status visible to others), recaps flag personal-best seasons, and the last client-side profile write is deleted. **Remaining (WS5.5–6.2):** caption mastery, retirement-plaque/Hall-banner prestige sinks, the admin mint-vs-sink dashboard, and seasonal cosmetic rotation — all additive, none blocking.

> Generated: July 2026, after a five-subsystem code deep-dive (backend economy, class unlocks, dashboard/celebrations, achievements/shop/cosmetics, season lifecycle/leagues).
> Scope: the concrete, file-level execution map for the owner-approved redesign. Strategy lives in `LIFELONG_GAMIFICATION_ROADMAP.md`; specs live in `PROGRESSION_ECONOMY_REDESIGN.md` (both decisions **approved**) and `DASHBOARD_UNIFICATION.md`; this doc turns them into ordered, verifiable work.
> Every file:line reference below was verified against the code in July 2026.

---

## Part 1 — New findings from the deep dive (not in the four strategy docs)

Numbered `F1…` so workstream steps can cite them. Severity: 🔴 breaks a promised mechanic · 🟡 inconsistency/drift risk · ⚪ dead code / polish.

### Economy & scoring

- **F1 🔴 League prize pools are collected but never paid out automatically.** Entry fees are charged into `settings.prizePool` on create/join (`functions/src/helpers/leagueEconomy.js:22-48`, used in `leagues.js:48-98, 179, 286`), but the only code that pays the pool to the champion and records the `league_champion` achievement — `archiveSeasonResultsLogic` (`functions/src/helpers/season.js:511-639`) — is reachable only via admin `manualTrigger("archiveSeasonResults")` (`admin.js:88-90`). The season scheduler never calls it. Players are paying into pots that never pay out.
- **F2 🔴 Both halves of the duplicate daily check-in are orphaned.** Server `dailyXPCheckIn` (`users.js:319-365`) has no client caller; the client binding is named `dailyRehearsal` (`src/api/functions.ts:239`) — **a server function that does not exist**. Nothing calls either from any component. (This makes the consolidation in Progression Phase A step 2 pure deletion.)
- **F3 🔴 Season-completion participation mismatch blocks the approved unlock gate.** A corps is archived and paid completion XP if `lineup || totalSeasonScore > 0` (`season.js:118`), but `lifetimeStats.totalSeasons` only increments if `seasonShowCount > 0 || seasonPointsTotal > 0` (`season.js:196-200`). A filled-lineup/zero-show corps gets XP + a recap but no `totalSeasons` — which would silently deny the new seasons-completed class unlock **and** already blocks the `finish_season` journey step (`journey.js:116-117`). Must be aligned before the unlock migration.
- **F4 🟡 Season finish payouts are not idempotency-guarded.** `archiveAndResetProfiles` relies only on the `activeSeasonId == oldSeasonUid` query; a forced double invocation of `startNewLiveSeason/startNewOffSeason` re-pays finish bonuses and re-increments `totalSeasons` (`season.js:196-200, 224-254`). The nightly scoring path has `scoringRunGuard` (`scoringRunGuard.js:58-99`); rollover has nothing equivalent.
- **F5 🟡 Four dead exported economy functions** superseded by batched implementations: `awardCorpsCoin` (`economy.js:173`), `awardLeagueWinBonus` (`economy.js:213`), `awardSeasonBonus` (`economy.js:267`), `payLeagueEntryFee` (`economy.js:436`) — zero callers each. Plus the orphaned `awardXP` callable (`users.js:375`, exported `index.js:17,251`).
- **F6 🟡 Two streak-milestone tables, one live.** `XP_SOURCES.streakMilestone` (`xpCalculations.js:83-90`) is dead; the live table with CC + titles is `STREAK_MILESTONES` (`dailyOps.js:27-34`). Drift risk if only one is edited.
- **F7 🟡 Class-keyed tables must carry both key forms.** `SHOW_PARTICIPATION_REWARDS`/`CLASS_UNLOCK_COSTS` carry both `open`/`openClass` etc. because a prior bug paid World/Open corps **zero** participation CC when only short keys existed (`economy.js:96-107`). Any new class-keyed table must do the same.
- **F8 ⚪ `getEarningOpportunities` under-advertises the economy** (`economy.js:525-560`): lists 3 faucets, omits challenges, predictions, ladder, journey, level stipend.

### Leagues & comms

- **F9 🔴 `weeklyMatchupPushJob` never fires.** It early-returns on `season.currentWeek` (`pushNotifications.js:146-149`), a field nothing ever writes — every other consumer computes the week from schedule dates.
- **F10 🟡 Two matchup-resolution paths that may not agree.** Nightly scoring resolves matchups and pays 100 CC at week boundaries (`scoringAwards.js:577-718`, invoked from `scoring.js:448,610`), while `updateMatchupResults`/`updateStandings` (`leagues.js:524,681`) are commissioner-only callables with no scheduled caller. Which fields (`completed`, `scores`, standings docs) each writes must be reconciled during WS4 — the weekly-recap generator depends on `matchup.completed` and may be reading a field the automatic path never sets.
- **F11 🟡 League chat composer is pinned across all tabs** (`LeagueDetailView.jsx:709-712`): send from Standings tab → success toast, message invisible (lives only in Chat tab). The activity feed's "chat" filter (`LeagueActivityFeed.jsx:304`) filters for `type === 'new_message'` events that are never written there — chat and feed are disconnected.

### Achievements, profile, shop

- **F12 🔴 The profile Trophy Case is synthetic.** `getCompetitionTrophies` (`directorProfileHelpers.ts:230-284`) fabricates placeholder trophies from `profile.stats` counters and never reads the real server-awarded `profile.trophies.{regionals,classChampionships,championships,finalistMedals}` arrays that `scoringAwards.js` writes nightly. The game's best data is displayed nowhere on the profile.
- **F13 🟡 `league_champion_*` achievement shape mismatch.** Written with `{id, name, description, earnedAt, icon}` (`season.js:590-596`) while the catalog/UI expect `{id, title, rarity, ccReward, …}` — renders with an undefined title, awards no CC.
- **F14 🟡 Three client-only achievement IDs can never be earned:** `scorer`, `five-shows`, `league-join` (`AchievementTrackerPanel.jsx:30,38,150`) have no server-catalog counterpart; the panel's earned counter uses a 17-entry denominator vs the 31-entry server catalog. Plus a key-form mismatch (`'open'` vs `'openClass'`, panel lines 137/145 vs `achievements.js:46-47`).
- **F15 🔴 Purchased card themes render nowhere.** `cosmetics.equipped.cardTheme` is written by the shop but no component consumes `getEquippedCosmetic(profile,'cardTheme')` — a 1,500–5,000 CC item with zero visible effect. (Violates the doc's own rule: status must be visible to be worth buying.)
- **F16 🟡 One client-side profile write survives:** the milestones writer in `useDashboardData.js:239-323` (`updateDoc` at `:308` writing `milestones` + `engagement.recentActivity`). Streaks/achievements are fully server-side now.
- **F17 ⚪ Small strays:** `QuickStats` destructuring bug — `Object.keys(...).filter(([,d]) => d?.score)` always yields 0, denominator hardcodes to 8 (`QuickStats.jsx:73`); streak-freeze cost duplicated as literal `300` (`Shop.jsx:224,231`) instead of `getStreakStatus().freezeCost`; dead "+X more" achievements button (`DirectorProfile.tsx:648-655`); five dead dashboard panels (`LineupPanel`, `StandingsPanel`, `SchedulePanel`, `TeamSwitcher`, `LeagueStatus` — zero render sites); dead second `CLASS_UNLOCK_WEEKS` (`sections/constants.js:27`); dead-but-useful XP progress helpers `getXPProgress`/`getNextClassProgress` (`captionPricing.js:261-274, 388-426` — only the test imports them); generic `Celebration` overlay + `useCelebration` hook mounted with zero dispatchers (`Celebration.jsx`, `useCelebration.js:10`); AI avatar regen free/ungated (`avatarGeneration.js:242-299`, free-tier Gemini so cost exposure is rate limits, not dollars).

### Two useful discoveries (assets, not bugs)

- **A1** The XP-bar helpers already exist and are tested (`getXPProgress`, `captionPricing.test.js:216-238`) — the missing progress bar is a render-only task.
- **A2** SoundSport prediction data already exists server-side: recaps carry SoundSport `score`/`placement`/`medal`, and the rating-tier mapping is `getSoundSportRating` (`scoresUtils.ts:28-34`) — the SS prediction variant needs a server-side mirror of that mapping plus question builders, no new data.

---

## Part 2 — Workstreams

Each step lists **files**, **the change**, **edge cases**, and **verification**. Test commands: backend `cd functions && npm test` (node --test); frontend `npm test` (vitest); build `npm run build`.

---

### WS0 — Backend repairs (Decision 2 Phase A + deep-dive fixes). *No UI dependencies; do first.*

**0.1 Pay weekly-participation and league-win XP in the guarded scoring run** *(the #1 fix — the player-reported bug)*
- **Files:** `functions/src/helpers/scoringAwards.js`, `functions/src/helpers/scoring.js:448-450, 610-612`, `functions/src/helpers/xpCalculations.js:72-99`.
- **Change:** at the week boundary (`scoredDay % 7 === 0`), inside the already-guarded run:
  - League-win XP (+100): in `processWeeklyMatchups` (`scoringAwards.js:681-698`), alongside the existing `WEEKLY_LEAGUE_WIN_REWARD` CC increment, add `xp: FieldValue.increment(XP_SOURCES.leagueWin)`.
  - Weekly-participation XP (+150, once per participating class per week): new pass in the same week-boundary block; derive participation from the week's `fantasy_recaps` (days `W*7-6 … W*7`) — a corps participates if it attended ≥1 show that week. Reuse the recap-fetch pattern from `dailyPredictions.js:64`.
  - Set `XP_SOURCES.weeklyParticipation` 200 → **150** per the approved §4 table; mirror in `src/utils/captionPricing.js:60`.
- **Edge cases:** XP lands as a raw increment; `xpLevel`/title/unlock recompute lazily at next `claimDailyLogin` (`calculateXPUpdates` derives level from stored `xp`, and the `lastRewardedLevel` stipend logic at `dailyOps.js:171-217` settles level-up CC correctly regardless of how XP arrived — verified). Accept the documented `ChunkedWriter` re-run residual risk (`scoringRunGuard.js:20-24`), same as the CC it rides with. New class-keyed logic must handle both key forms (F7).
- **Verify:** new node test for the weekly-participation selector; run a scoring day in the emulator across a week boundary; confirm coin-history/XP deltas; `cd functions && npm test`.

**0.2 Delete the orphaned check-in + `awardXP`** *(F2, F5)*
- **Files:** `functions/src/callable/users.js:319-365, 375-418`; `functions/index.js:16-17, 250-251`; `src/api/functions.ts:239`; `src/api/client.ts:201`; `functions/src/callable/authGates.test.js:49-50`; stale comment `src/api/profile.ts:85`.
- **Change:** remove `dailyXPCheckIn`, `awardXP`, the `dailyRehearsal` client binding + types, and test entries. `lastRehearsal` is write-only — no migration.
- **Verify:** grep zero references; both test suites pass; deploy list diff shows the two functions removed.

**0.3 Wire league-champion archival + prize-pool payout into rollover** *(F1, F13)*
- **Files:** `functions/src/helpers/season.js:395-396, 504-505, 511-639`.
- **Change:** call `archiveSeasonResultsLogic(db, oldSeasonUid)` from both `startNewLiveSeason` and `startNewOffSeason` (after `archiveAndResetProfiles`). Make it idempotent: skip a league whose `champions[]` already contains an entry for `oldSeasonUid`. Fix the achievement shape to `{id, title, description, icon, rarity: 'legendary', ccReward, earnedAt}` and pay its CC through the same batch.
- **Edge cases:** the `artifacts/{ns}/leagues` namespace coupling warned at `season.js:528-529`; leagues with zero pool should still record champions.
- **Verify:** node test with a fixture league; emulator rollover pays pool exactly once across a forced double-run.

**0.4 Guard the rollover** *(F4)*
- **Files:** `functions/src/helpers/season.js`, new `functions/src/helpers/rolloverGuard.js` (or generalize `scoringRunGuard`).
- **Change:** claim a `season_rollovers/{oldSeasonUid}` doc (transaction, same lease pattern as `scoringRunGuard.js:58-86`) before `archiveAndResetProfiles`; mark completed/failed after. Admin `force` passthrough like `admin.js:99-113`.
- **Verify:** node test: second claim within lease returns `claimed:false`.

**0.5 Align "participated in the season"** *(F3 — prerequisite for WS2)*
- **Files:** `functions/src/helpers/season.js:118, 124-136, 196-200`.
- **Change:** one definition, per the approved spec ("registered for and competed in shows across a season that then archives"): a corps **counts** iff `seasonShowCount > 0 || seasonPointsTotal > 0`. Corps with a lineup but zero activity are still archived/reset (data preservation) but earn no completion XP, no finish bonus, no recap line, and don't bump `totalSeasons`.
- **Edge cases:** keep the recap modal graceful when a user has a mix of active and inactive corps.
- **Verify:** node test: lineup-no-shows corps → no XP, no `totalSeasons` bump; shows-attended corps → both.

**0.6 Fix the dead matchup push + reconcile matchup resolution** *(F9, F10)*
- **Files:** `functions/src/scheduled/pushNotifications.js:128-260`; audit `scoringAwards.js:577-718` vs `leagues.js:524, 681` and `leagueAutomation.js:452`.
- **Change:** compute current week from `schedule` dates (existing pattern elsewhere) instead of `season.currentWeek`. Then reconcile the two matchup paths: confirm what the automatic `processWeeklyMatchups` writes to `matchups/week-N` docs; make it set the fields the recap generator and standings UI read (`completed`, `scores`, winner), or schedule `updateMatchupResults`. Keep the commissioner callable as a manual override.
- **Verify:** emulator: generate matchups Sunday, score a week, confirm matchup docs complete + standings update + push job selects users.

**0.7 Small repairs** *(F17, F8, F6)*
- `QuickStats.jsx:73` → `Object.entries` (one line; panel retires in WS3 but the fix is free now).
- `Shop.jsx:224,231` → use `freezeCost` from `getStreakStatus`.
- Delete dead exports: `awardCorpsCoin`, `awardLeagueWinBonus`, `awardSeasonBonus`, `payLeagueEntryFee` (`economy.js`), the five dead dashboard panels + their exports, `sections/constants.js:27` dup constant, dead `XP_SOURCES.streakMilestone` table (point a comment at `STREAK_MILESTONES` as the single source).
- Expand `getEarningOpportunities` to list all live faucets (doubles as data for the WS1 explainer).
- **Verify:** grep-zero for each deleted symbol; both suites; `npm run build`.

---

### WS1 — Make progression legible and felt (roadmap Step 2, Progression Phase A.3). *Independent of WS0; ship in parallel or after.*

**1.1 Surface the daily-login payoff**
- **Files:** `src/App.jsx:183-196`; `functions/src/callable/dailyOps.js:228-277` (add `levelsGained`, `previousStreak` to the response — computed internally already).
- **Change:** consume the `claimDailyLogin` response: `showXPGain(xpAwarded)` (`xpFeedbackTrigger.ts:16`), streak toast, milestone burst via the mounted-but-dead `Celebration` container (`useCelebration.js:10`), and `triggerLevelUp(newLevel, classUnlocked)` (`levelUpTrigger.ts:8`) when `levelsGained > 0`. Respect the `alreadyClaimed` branch (no juice).
- **Verify:** vitest for the response-handling helper; manual: fresh day login shows float + flame; level-up crossing fires the full-screen moment.

**1.2 XP-to-next-level bar** *(A1 — render-only)*
- **Files:** `src/components/Dashboard/sections/ControlBar.jsx:162-167`, `src/components/Profile/DirectorProfile.tsx:386-389`; helper `getXPProgress` (`captionPricing.js:261-274`).
- **Change:** level pill becomes level + slim progress bar (`current/needed` tooltip); same readout on the profile hero.
- **Verify:** existing helper tests already cover math; vitest snapshot for the pill.

**1.3 Route every XP source through the floating feedback**
- **Files:** `JourneyPanel.jsx:148-152`, `SeasonLadderPanel.jsx:56-59` (add `showXPGain`/`showCoinGain` beside the toasts); 1.1 covers login.
- **Verify:** each claim action fires a float in dev.

**1.4 One authoritative "How Progression Works" explainer**
- **Files:** new `src/data/progressionGuide.js` (generated from real constants — import the mirrors, assert equality in a vitest against `functions/src/helpers/xpCalculations.js` values via a shared JSON or duplicated-with-test pattern like the challenge pool); surface in `HowToPlay.jsx:150-171` + `howToPlayData.js:90-92` + footer quick-ref `:551-554`.
- **Change:** enumerate every live XP/CC source with amounts, the 1,000 XP/level rule, the level→title ladder, and **all class-unlock paths** (today: level/calendar/CC — updated again by WS2.7 when calendar → seasons). Fixes the undocumented-calendar-path confusion the player reported.
- **Verify:** vitest mirror-equality test (this is the "can never drift" requirement); visual pass.

**1.5 Achievement unlock pop**
- **Files:** `useDashboardData.js:222-235` (already surfaces `newAchievement` → `AchievementModal`), add confetti/celebration juice in the modal.
- **Verify:** trigger via emulator-awarded achievement.

---

### WS2 — Seasons-completed class unlocks (Decision 1 — approved). *Requires 0.5.*

**2.1 Server trigger swap**
- **Files:** `functions/src/helpers/xpCalculations.js:20-26, 168-187`.
- **Change:** replace `classUnlockWeeks` with `classUnlockSeasons: { aClass: 1, open: 2, world: 3 }`. Conditions become `level >= N || totalSeasons >= M || accountAgeWeeks >= 52` (the silent anti-frustration backstop, per the approved spec). `calculateXPUpdates` reads `profileData.lifetimeStats?.totalSeasons`. Return an `unlockPath` (`'xp' | 'seasons' | 'backstop'`) alongside `classUnlocked` for recognition asymmetry (2.5).
- **Edge cases:** grandfathering is free — `unlockedClasses` is a stored additive array (server-only writable, `firestore.rules:32-40`); nothing recomputes-from-scratch or revokes, so calendar-era unlocks persist untouched. Both class-key forms (F7).

**2.2 Evaluate at the moments that matter**
- **Files:** `functions/src/helpers/season.js:195-220` (archival must increment `totalSeasons` **before** the `calculateXPUpdates` call in the same update so season-N completion unlocks immediately, with the graduation landing in the recap); `functions/src/callable/economy.js:394-431` (`syncClassUnlocks` keeps working unchanged as the login-time catch-up — now serving the backstop and any missed archival).
- **Verify:** node test: profile with `totalSeasons: 0` completing season 1 → `aClass` unlocked in the same archival write.

**2.3 Client calendar-path removal**
- **Files:** `src/utils/classUnlockTime.ts` (retire; keep `normalizeUnlockedClasses`/`toCanonicalClassKey` — move to `src/utils/corps.ts` beside `isCorpsClassUnlocked:54-60`); `src/store/profileStore.js:105-118` (keep the once-per-session `syncClassUnlocks` call; drop the `mergeTimeUnlockedClasses` pre-check); `ControlBar.jsx:13, 19-39, 199-204` (chip shows "N seasons" from `lifetimeStats.totalSeasons`, not "Nw"); `Dashboard.jsx:91, 700` + `ClassPurchaseModal.tsx:23, 67, 181-205` (prop + copy: "unlocks free when you complete your Nth season — or reach Level X first").
- **Edge cases:** demo/guest hard-coded arrays untouched (`demoCorps.js:155`); admin override untouched (`useDashboardData.js:40-45`).
- **Verify:** grep-zero for `CLASS_UNLOCK_WEEKS`/`getWeeksUntilUnlock`; vitest for the new seasons-progress helper; `npm run build`.

**2.4 Per-show XP + flat completion grant** *(approved §4 table)*
- **Files:** `scoring.js:214-234` (add `xp: +25` per show attended beside participation CC, cap 4/wk implicit in show-selection rules); `xpCalculations.js:208-222` (`getSeasonCompletionXP` → flat 200 for every participant + rank bonus 300/200/100 for top10/25/50 — keeping the ~200–500 total band of the approved table).
- **Verify:** node tests for both tables; weekly XP telemetry sanity: active SoundSport ≈ 600–700/wk per the spec.

**2.5 Graduation ceremonies + earned-early recognition**
- **Files:** `ClassUnlockModal.jsx` (exists with confetti — add class-themed styling + the unlock's path); server: persist `classUnlockPaths: { aClass: 'xp' | 'seasons' | 'cc' | 'backstop' }` wherever the array is written (`xpCalculations.js`, `economy.js:354-357, 418`); grant a `grantOnly` cosmetic (new `shopCatalog.js` items, e.g. `title_earned_the_hard_way_a`) when `unlockPath === 'xp'`; backstop unlocks skip the modal (write class without setting `newlyUnlocked` fanfare — suppress via the same `unlockPath`).
- **Existing plumbing:** detection diff `useDashboardData.js:116-140` → queue `useDashboardModals.js:96-102` → render `Dashboard.jsx:513-519` all work today for every path.
- **Verify:** emulator: XP-path unlock → modal + cosmetic; seasons-path → modal, no cosmetic; backstop → silent.

**2.6 SoundSport prediction variant** *(A2)*
- **Files:** `functions/src/helpers/dailyPredictions.js` (SS question builders: "What rating tier tonight?" / "Podium medal?" resolving off recap `placement`/`medal` and a server-side rating-tier mapping mirroring `scoresUtils.ts:28-34`); `dailyOps.js:576-578` (allow `soundSport` for SS question ids only); `src/utils/dailyPredictions.js` + `PredictionGamePanel.jsx:26-40` (enable panel with SS questions).
- **Edge cases:** never leak numeric scores in question text or resolution copy (the original exclusion reason, `dailyOps.js:575`).
- **Verify:** node test resolving an SS bucket; vitest for SS question building; manual copy review for score leakage.

**2.7 Documentation sweep** — update every progression surface WS1.4 created/catalogued: explainer, `howToPlayData.js:31-49, 90-92`, `HowToPlay.jsx:266-272, 363-368, 551-554`, `jargonDefinitions.js`, onboarding tour copy. The mirror-equality test from 1.4 enforces correctness.

---

### WS3 — Dashboard unification (`DASHBOARD_UNIFICATION.md`). *3.1/3.3 anytime; 3.2 best after WS1.*

**3.1 Four-zone layout + mobile order** *(pure layout)*
- **Files:** `src/pages/Dashboard.jsx:352-483`.
- **Change:** restructure the grid into intention zones with DOM order = mobile order: A `SeasonScorecard` (+deadline) → B Today (placeholder container until 3.2: `DailyChallenges`, `PredictionGamePanel`, `JourneyPanel`, ladder-claim strip) → C `ActiveLineupTable` + `LineupSimulatorPanel` + `NextPerformancePanel` → D progression + `RivalsPanel` + `RecentResultsFeed`. Move Submit Article to the footer.
- **Verify:** visual pass at 375px/768px/1280px; `data-tour` anchors still resolve for the onboarding tour.

**3.2 The Director's Report card** *(the centerpiece)*
- **Files:** new `src/components/Dashboard/sections/DirectorsReport.jsx`; composes the §7 inventory (agent-verified data sources: challenges via `profileStore` + `getChallengesForGameDay`; predictions via `profile.predictions[gameDay]`; journey next-step via `profile.journey`; ladder claimable via `profile.seasonLadder` + `xpAtSeasonStart`; login/streak from `profile.engagement`).
- **Change:** one checklist card, `Today · X of Y done` header; each row: action, reward, **spine label** ("+10 XP → Ladder Tier 7, 2 away" — computable from `LADDER_TIERS`, `seasonLadder.js:23-37`); completing the last row fires the celebration (`useCelebration`). The old standalone cards collapse into it (JourneyPanel keeps its self-retire behavior).
- **Verify:** vitest for the row-assembly selector (given a profile fixture, correct rows/labels); manual full-day pass.

**3.3 Zone-D progression hub + retirements**
- **Files:** merge `SeasonLadderPanel` + `AchievementTrackerPanel` + the 1.2 XP bar into a tabbed `SeasonProgressHub`; retire `QuickStats` (fold one best-fact line into `SeasonScorecard`); delete the five dead panels (0.7 covers exports).
- **Verify:** vitest; bundle-size sanity via `npm run build`.

**3.4 Achievement reconciliation** *(F14 — do before the hub ships)*
- **Files:** `functions/src/helpers/achievements.js:27-72`, `AchievementTrackerPanel.jsx:19-165`.
- **Change:** single catalog: add server entries for the three client-only ideas worth keeping (`first_score`, `shows_5`, `league_join` — award via the existing `sweepProfileAchievements` at login) and delete the client-only definitions; panel derives its list from a shared mirror (same pattern as the challenge pool) with a vitest equality check; fix the `'open'`/`'openClass'` key mismatch; denominator = catalog length.
- **Verify:** mirror-equality vitest; node test for the new predicates.

**3.5 Task value: decisions, a weekly arc, celebration**
- **Files:** `functions/src/helpers/dailyChallenges.js:18-26` + client mirror `src/utils/dailyChallenges.js:56-64`; `dailyOps.js:296-371`.
- **Change:** replace the six zero-agency "visit page X" challenges with server-verifiable decisions: "make today's prediction" (predictions bucket exists), "register for a show this week" (`selectedShows` delta), "confirm or adjust your lineup" (lineup timestamp), "claim a ladder tier" (claimable check). Keep the deterministic rotation. Add the weekly meta-goal: complete the daily set 5 days in a week → bonus CC, paid at the week boundary inside the guarded run (state: `engagement.weeklyLoop = { weekKey, days: n }` maintained by `completeDailyChallenge`).
- **Edge cases:** challenge completion must verify state server-side in `completeDailyChallenge` (it currently trusts the click); mirror-equality vitest for the pool.
- **Verify:** node tests per predicate; a full simulated week in the emulator pays the meta-bonus once.

---

### WS4 — League heartbeat (roadmap Step 6; `LEAGUES_ENGAGEMENT_STRATEGY.md`). *After WS0.6.*

- **4.1 Chat/feed repair** *(F11)*: render `SmackTalkInput` only inside `ChatTab` (`LeagueDetailView.jsx:687-712`); pipe system events (matchup created/resolved, member joined, champion crowned) into the `activity` feed so it's never empty; align the feed's chat filter with reality.
- **4.2 Matchup as an event**: with 0.6's reconciliation done, surface pre-game (Monday push, F9 fix), live tracking (nightly deltas), and result ceremony states in `MatchupsTab`/`MatchupDetailView`.
- **4.3 League Prediction Pools v1** *(the flagship)*: new callables `submitPoolPick`/`resolvePool` modeled directly on the existing prediction resolution (`dailyOps.js:558-794` + `dailyPredictions.js` resolve-against-recaps pattern); escrowed, capped (100 CC), zero-sum, league-scoped (`leagues/{id}/pools/{gameDay}`); resolution runs in the nightly guarded scoring window; results post to the feed. This is also the recurring CC-circulation sink.
- **4.4 Rookie-league placement**: make the onboarding `joinRookieLeague` call (`Onboarding.jsx:366-375`) a visible opt-out default instead of fire-and-forget; surface failures.
- **4.5 Cross-class normalized matchups**: design note only for now — `smartPairMembers` (`leagueAutomation.js:371-408`) pairs within class; normalization (percentile-of-class) is a scoring-fairness question to spec before building.

---

### WS5 — Career spine & legacy (roadmap Steps 1, 5, 9)

- **5.1 Real Trophy Case** *(F12)*: rewrite `getCompetitionTrophies` to read `profile.trophies.*`; keep synthetic fallback for pre-trophy profiles; fix the dead "+X more" button (F17) with an expandable list; add a "records held" line reading `game-records/records` holders by uid.
- **5.2 Make card themes real** *(F15)*: consume `getEquippedCosmetic(profile,'cardTheme')` where **others** see it — league standings rows and leaderboard entries — plus own `SeasonScorecard`. Unblocks honest shop sales.
- **5.3 Milestones server-side** *(F16)*: move the `useDashboardData.js:239-323` bests-writer into the nightly scoring pipeline (bests are already computed near `updateRecordsFromRecap`, `gameRecords.js:89`); delete the client write.
- **5.4 Season report card (E3)**: extend `pendingSeasonRecap` (`season.js:227-236`) with PB comparisons (`lifetimeStats.bestSeasonScore/bestWeeklyScore` already maintained, `season.js:167-200`) — "you beat last season's best GE" in the recap modal.
- **5.5 Caption mastery (Step 4, larger)**: accumulate per-caption lifetime points during nightly scoring into `profile.captionStats`; thresholds table + titles; surface in the 3.3 hub and profile. Spec the thresholds after one season of telemetry from 6.1.
- **5.6 Prestige sinks round-out**: retirement ceremony tiers (bronze/silver/gold plaque on the existing `retiredCorps` gallery) and Hall of Champions banner — both follow the `sponsorShow` pattern (`shop.js:151-257`).

### WS6 — Live-ops instrumentation (roadmap Step 10)

- **6.1 Mint-vs-sink admin stat**: weekly scheduled aggregation over `corpsCoinHistory` types → one admin doc + a simple admin-page table (total minted vs sunk per week, per source). The one instrument needed to tune prices.
- **6.2 Seasonal cosmetic rotation**: add a `season` field to `shopCatalog.js` entries; the off-season's thematic name (already generated, `season.js:464`) keys one rotating set; last season's set returns to catalog later at a higher price (per the approved gentle-exclusivity rule).

---

## Part 3 — Sequencing and PR slicing

Dependency spine: **0.5 → WS2** · **0.6 → WS4.2/4.3** · **WS1.4 → WS2.7** · **3.4 → 3.3-hub ship** · everything else parallel-safe.

| # | PR | Contents | Size |
| --- | --- | --- | --- |
| 1 | `fix/weekly-xp-and-economy-repairs` | 0.1, 0.2, 0.7 | M |
| 2 | `fix/season-rollover-integrity` | 0.3, 0.4, 0.5 | M |
| 3 | `fix/league-matchup-resolution` | 0.6 | S–M |
| 4 | `feat/progression-legibility` | 1.1–1.5 | M |
| 5 | `feat/seasons-completed-unlocks` | 2.1–2.5, 2.7 | L |
| 6 | `feat/soundsport-predictions` | 2.6 | S |
| 7 | `feat/dashboard-zones` | 3.1, 3.3, 3.4 | M |
| 8 | `feat/directors-report` | 3.2 | M |
| 9 | `feat/daily-challenges-with-agency` | 3.5 | M |
| 10 | `feat/league-heartbeat` | 4.1, 4.2, 4.4 | M |
| 11 | `feat/league-prediction-pools` | 4.3 | L |
| 12 | `feat/career-spine` | 5.1–5.4 | M |
| 13+ | mastery, prestige sinks, live-ops | 5.5, 5.6, 6.1, 6.2 | ongoing |

Each PR is independently shippable and leaves the game strictly better. PRs 1–2 are the highest-trust, lowest-risk work (activating promised rates, closing payout holes) and should land before anything user-visible changes.

## Part 4 — Verification discipline

1. **Every PR:** `cd functions && npm test` · `npm test` · `npm run build`; new logic gets a test in the suite that owns it (backend node tests mirror existing patterns, e.g. `economyCallables.test.js`; frontend vitest, e.g. `SeasonLadderPanel.test.jsx`).
2. **Mirror-equality tests** for every client copy of a server table (challenge pool, achievement catalog, XP sources, shop catalog, progression guide) — the "can never drift" rule made mechanical.
3. **Idempotency tests** for every new payout: run the payer twice, assert single payment (guards: `scoringRunGuard`, 0.4's rollover guard, per-league champion check, `lastRewardedLevel`).
4. **Emulator end-to-end before PRs 2 and 5:** a full simulated season (49 nightly runs + rollover) asserting: weekly XP paid, finish bonuses once, `totalSeasons` +1 only with participation, class unlock fires at archival, ladder resets, recap written.
5. **Economy telemetry after PR 1:** watch mint-vs-sink for one season (6.1 makes this trivial once built); expect one cosmetic-price retune, per the roadmap.
