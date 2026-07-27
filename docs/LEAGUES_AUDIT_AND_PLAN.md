# Leagues — Audit and Clubhouse Plan

A full read of the league system: every defect found, ranked by how much it
hurts, followed by a phased plan to turn leagues from "a tab that exists" into
the clubhouse the game's enthusiasts actually live in.

Scope of the read: `src/pages/Leagues.jsx`, `src/components/Leagues/**`,
`src/hooks/useLeague*.ts`, `src/api/leagues.ts`, `src/utils/leagueStats.ts`,
`src/utils/leagueActivity.ts`, `functions/src/callable/{leagues,leagueRoster,leagueInvitations,leaguePools,rookieLeague}.js`,
`functions/src/helpers/{leagueHelpers,leagueActivity,leagueStandings,leagueEconomy,leaguePools,weeklyMatchups}.js`,
`functions/src/scheduled/leagueAutomation.js`, the league blocks of
`functions/src/helpers/season.js`, and `firestore.rules`.

---

## Executive summary

The plumbing is in good shape — transactions, idempotency tokens, write
budgets, escrowed pools, paged jobs, a season-activity gate. The team has
clearly done careful work there, and the comments in these files are unusually
honest about past bugs.

The problem is above the plumbing. **The competitive layer is incoherent.**

1. A "weekly matchup" was decided by each corps' _most recent show score_, not
   by the week — so a director who sat the whole week out kept a stale number
   and could still win it, and anyone who competed twice had all but their last
   performance thrown away.
2. There were **two different standings systems** that disagreed, and the UI
   raced them — your record changed depending on which one loaded last.
3. The **league champion was not the standings winner**. Prize pool and the
   legendary achievement went to the biggest final-show score, ignoring the
   entire W/L season the UI spent seven weeks building.
4. **Playoffs were advertised and didn't exist.** `finalsSize`, `playoffSize`,
   `scoringFormat`, and `matchupType` were stored and never used; the standings
   table drew a hardcoded "Top 4 qualify" line to nothing.

Around that core sit ~30 smaller defects: no deep links, no commissioner
transfer, no settings editing, an invite-code leak in the rookie circuit, a
free-entry hole in the invitation path, orphaned data on delete, and a set of
UI affordances wired to fields nothing writes.

> **Status.** Findings marked **FIXED** have landed across three phases —
> Phase 1 (the competition), Phase 2 (correctness and governance), and Phase 3
> (the clubhouse layer). Findings marked **PARTLY FIXED** or left unmarked are
> outstanding; they are listed under "Still outstanding" at the end of Part 2.

---

# Part 1 — What's wrong

Severity: **P0** breaks the game · **P1** wrong data or real user harm ·
**P2** gap a serious league will hit · **P3** polish / debt.

## A. Competitive integrity

### A1 · P0 — Weekly matchups are decided by a stale "latest show" score — FIXED

`functions/src/helpers/weeklyMatchups.js` and the commissioner path in
`functions/src/callable/leagues.js` both resolved head-to-head on:

```js
const p1_score = p1_profile?.data?.corps?.[corpsClass]?.totalSeasonScore || 0;
```

Despite the name, `totalSeasonScore` is **not** a season aggregate. The nightly
run _overwrites_ it with each corps' most recent show total
(`helpers/scoring.js commitDailyScoring` — "Uses latest score (not cumulative)
— drum corps rankings are based on most recent performance"). Resolving a
_week_ on it meant:

- a director whose last show was Tuesday was judged against one whose last show
  was Saturday — different nights, different shows, no shared week;
- **a director who did not compete at all that week kept their old number and
  could still win the matchup**, at full strength;
- anyone who competed twice had all but their last performance discarded.

Fixed in `functions/src/helpers/leagueScoring.js`: the week's total is now
derived from the committed recap days (`fantasy_recaps/{seasonUid}/days/{d}`),
summing every show the corps attended between days `7N-6` and `7N`. Not
competing scores 0 with 0 shows — a forfeited week, which is a real result.

### A2 · P0 — Two standings systems that disagreed, raced in the UI — FIXED

|          | Server                           | Client                                                   |
| -------- | -------------------------------- | -------------------------------------------------------- |
| Where    | `leagues/{id}/standings/current` | `computeMemberStandings`, `src/utils/leagueStats.ts:214` |
| W/L from | "latest show" score (A1)         | per-week recap sums                                      |
| Ties     | counted as `ties`                | counted as a loss for streaks                            |

`src/hooks/useLeagueLiveStandings.ts` layered them last-writer-wins and said so
in its own docstring: the subscription landed, the computation overwrote it,
then a later backend push overwrote that. A member's record, rank, streak and
playoff position visibly changed with nothing happening in the game. The single
most trust-destroying bug in the feature.

Fixed: the backend document is authoritative, always. The computed table is a
**fallback only**, used when the league has no standings rows yet, and the view
labels it _Provisional_. Once the server has rows they win and stay won.

### A3 — RETRACTED

An earlier revision of this document claimed `pointsFor` was inflated by a
triangular sum, on the assumption that `totalSeasonScore` was cumulative. It is
not (see A1), so `pointsFor` was already a coherent "sum of the score each
matchup was decided on". It is now the sum of each week's actual total, which
is the quantity the column has always claimed to be.

### A4 · P1 — The league champion ignored the standings entirely — FIXED

`functions/src/helpers/season.js` picked the winner as the member with the
highest sum of `corps.*.totalSeasonScore` — a sum, across classes, of each
corps' _final show score_. The prize pool, the `league_champion_*` legendary
achievement, the `champions[]` entry and the all-members notification all
followed that number. A director could go 7-0 and lose their league to someone
who went 2-5 but peaked on the final night.

Fixed in `functions/src/helpers/leagueChampion.js`: the regular-season standings
decide the finals field (`settings.finalsSize`), and championship week decides
the title among it. When nobody in the field competed at Finals, the standings
leader wins outright.

### A5 · P1 — Champion eligibility gated on an unreliable marker — FIXED

Same block: `if (profileData.activeSeasonId === seasonId)`.
`functions/src/helpers/leagueActivity.js:36-40` explicitly documents that
`activeSeasonId` is written on _some_ registration paths only — `registerCorps`
deliberately holds it back for directors who still owe corps decisions. The
module exports `isActiveThisSeason()` precisely to fix this, and the champion
selector doesn't use it. A fully competing director can be excluded from their
own league's championship.

### A6 · P1 — Playoffs advertised and unimplemented — FIXED

- `settings.finalsSize` (default 12) — written at creation, rendered once in
  SettingsTab, consumed by nothing.
- `settings.playoffSize` (default 4) — written at creation, and **never read**.
  `StandingsTab.jsx:34` defaults its own `playoffSize = 4` and no caller passes
  one, so every league shows "Top 4 qualify" and a playoff cut line regardless
  of its settings.
- `settings.scoringFormat` (`'circuit' | 'weekly' | 'total'`) and
  `settings.matchupType` — stored, never read anywhere.

The season ended with no bracket, no finals, no playoff seeding. The line in
the standings table pointed at nothing.

Fixed: `finalsSize` decides a real finals field and championship week decides
the title among it (A4); `playoffSize` is wired through to the standings cut
line so it reflects the league's own setting; and `LeagueFinalsBracket` draws
the field the cut line points at — seeds, who is in, who is on the bubble, and
who won and how once the season is archived. `scoringFormat` and `matchupType`
remain stored-and-unread; they are the last of this group.

### A7 · P2 — Pairing had no rematch avoidance and no bye rotation — FIXED

`smartPairMembers` sorted by record and paired adjacent (1v2, 3v4). Against a
stable table that reproduces the _same duels every week_ — a ten-person league
would run a whole season as five repeated matchups. The only randomness was
`Math.random()` deciding which name printed first, which is cosmetic (home
confers nothing) while making the generator untestable.

Byes were worse: the odd director out was whoever sorted last, so the
worst-performing member collected a free win every week, forever.

Fixed: `buildPairingHistory` folds the league's existing matchup documents into
prior-opponent counts and bye counts, and `smartPairMembers` takes the nearest
seed it has faced fewest times and hands the bye to whoever has had it least.
Deterministic — same inputs, same pairings.

### A8 · P2 — Cross-class standings in one table — FIXED

Matchups are segregated by corps class (correct), but standings, the prize
pool, and the champion are league-wide. A World Class director and a SoundSport
director appear in one ranked table having never played each other, with
`totalPoints` on wildly different scales. `GAMIFICATION.md:353` lists
"cross-class normalized matchups" as future work; until then the table needs to
be honest about what it is.

Fixed by being honest: a league that actually mixes classes now labels each row
with the class(es) that director fields, and says plainly that records combine
every class and that Points are not comparable across them. Normalized
cross-class scoring is still future work — this stops the table from implying
something untrue in the meantime.

### A9 · P3 — Two divergent copies of the pairing algorithm — FIXED

`functions/src/helpers/leagueHelpers.js:25` and
`functions/src/scheduled/leagueAutomation.js:49` are near-identical
`smartPairMembers` implementations that have _already drifted_ (the helper
version sets `scores: null` on a bye; the scheduled version doesn't). The
scheduled job imports `createLeagueActivity` from the helper but not the
pairing function it duplicates.

### A10 · P3 — `updateMatchupResults` hardcoded the class list — FIXED

`functions/src/callable/leagues.js:681` uses a literal
`['worldClass','openClass','aClass','soundSport']` while every other site uses
`MATCHUP_CLASSES` from the registry. When Podium's registry entry enables, the
commissioner path will silently skip it.

---

## B. Economy and data correctness

### B1 · P1 — Accepting an invitation skipped the entry fee — FIXED

`joinLeague` and `joinLeagueByCode` both call `chargeEntryFeeInTransaction`.
`respondToLeagueInvitation` (`functions/src/callable/leagueInvitations.js:162-208`)
does not. In a league with an entry fee:

- invited members play free while code/public joiners pay;
- the prize pool under-funds relative to the roster;
- worse, `removeLeagueMember` refunds `min(entryFee, prizePool)` to anyone
  removed (`leagueRoster.js:83-85`), so a commissioner can invite a friend for
  free, remove them, and hand them other members' escrowed coin.

### B2 · P1 — Leaving a league left your standings row behind — FIXED

`leaveLeague` (`functions/src/callable/leagues.js:485-489`) removes the uid from
`members` and from `profile.leagueIds` and stops. `standings/current.records`
and the `standings[]` array keep the departed director forever — they stay in
the table, keep their rank, and count toward "Top N qualify".
`removeLeagueMember` does this correctly (`leagueRoster.js:111-117`); the
voluntary path was never updated to match.

### B3 · P1 — Invitation acceptance never refreshed season activity — FIXED

Every other roster mutation calls `refreshLeagueActivity`. The accept path
doesn't, so a league that fills entirely through invitations keeps a stale
`seasonActivity` block until the 5:30 AM job runs — under-reporting who's
competing and (for a league at zero) staying out of public discovery for a day.

### B4 · P2 — Deleting a league orphaned all of its subcollections — FIXED

When the commissioner is the last member, `leaveLeague` deletes the league doc
and the invite mapping. `standings/`, `matchups/`, `activity/`, `chat/`,
`recaps/`, `pools/`, and `meta/rivalries` are all left behind as unreachable
documents — permanently, since Firestore doesn't cascade. Any escrowed
`settings.prizePool` and `poolCarry` vanish with the doc rather than being
refunded.

### B5 · P2 — Entry-fee forfeiture was never disclosed — FIXED

The fee is fixed at creation and can never be changed (see C2). Members who
leave forfeit it silently — the UI never warns them. If a league dissolves
mid-season (B4), every escrowed coin is destroyed with no payout.

### B6 · P3 — Pool carry could be stranded — FIXED

`league.poolCarry` accumulates when nobody has a perfect day and is only
released when a member next buys in (`leaguePools.js:75`). A league that stops
playing pools mid-season leaves real escrowed CorpsCoin sitting in a field
nothing will ever pay out. Season archival drains `prizePool` but not
`poolCarry`.

---

## C. Lifecycle and governance

### C1 · P1 — A departing commissioner orphaned the league — FIXED

`leaveLeague` removes the creator from `members` but leaves `creatorId`
pointing at them. Every commissioner gate is `creatorId === uid`, so the league
permanently loses the ability to: generate matchups, invite directors, rescind
invitations, remove members, or open the Settings tab. There is no
`transferCommissioner` callable and no succession rule.

### C2 · P1 — League settings could not be edited at all — FIXED

There is no `updateLeague*` callable anywhere in `functions/`. A commissioner
cannot fix a typo in the name, rewrite the description, flip public/private,
raise `maxMembers` when the league gets popular, or adjust anything else. The
"Commissioner Settings" tab is a read-only display plus a matchup button.

### C3 · P1 — "Regenerate Matchups" always failed — FIXED

`SettingsTab.jsx:164-207` prompts _"Generating new matchups will replace them.
Continue?"_ and then calls `generateMatchups`, which throws
`already-exists` unconditionally (`callable/leagues.js:547-550`). The callable
that supports overwriting — `triggerMatchupGeneration`, with `forceRegenerate`
(`leagueAutomation.js:712`) — is never called from the client. Confirming the
dialog produces a red error toast, 100% of the time.

### C4 · P2 — No deep link to a league; existing links 404'd — FIXED

`App.jsx` registers `/leagues` only. League detail is `useState` inside
`Leagues.jsx`, so there is no URL for a league, no browser back, no shareable
link, and no restore-on-refresh. Meanwhile the champion notification written at
archival points at `/leagues/${leagueId}` (`season.js`), and the invite flow
already assumes `?join=CODE` deep links work. Those champion links land on the
catch-all route.

For a clubhouse this is the highest-leverage single UX fix: you cannot share
your league, link a matchup in chat, or bookmark the standings.

### C5 · P2 — Invitations never expired and carried a dead field — FIXED

Pending invitations live forever with no TTL and no cleanup job. Each one also
writes `inviteCode: leagueData.inviteCode || null`
(`leagueInvitations.js:99`) — always `null` since the code moved to
`meta/private`, and a leak if a legacy doc still carries it.

### C6 · P2 — No commissioner tools that a real league needs

No co-commissioner role, no ability to correct a matchup result, no pinned
announcement, no league rules/description-with-formatting, no way to schedule
or lock a season format, no member-visible audit of commissioner actions beyond
removals.

### C7 · P3 — The rookie circuit had no gate and an accidental commissioner — FIXED

`joinRookieLeague` is callable by any authenticated director regardless of
level or tenure, and whoever provisions a new circuit becomes its `creatorId` —
a commissioner with kick and settings power over strangers, in a league whose
own description says it needs no commissioner attention. If that person leaves
as the last member, the league is deleted while `game-settings/rookie-league`
still points at it.

---

## D. Security and privacy

### D1 · P1 — The rookie circuit wrote the invite code onto the league doc — FIXED

`functions/src/callable/rookieLeague.js:101` sets `inviteCode` on the league
doc. `createLeague` has a nine-line comment explaining why this must never
happen (`callable/leagues.js:110-115`): `firestore.rules` deliberately leaves
`list` over `leagues` open to any signed-in user, so **every field on a league
doc is enumerable by every authenticated account**. Every Rookie Circuit's join
code is readable by anyone. The rookie path also skips the `meta/private` doc
the rest of the system uses.

`scripts/stripLeagueInviteCodes.js` exists to migrate legacy docs — and this
callable is actively creating new ones.

### D2 · P2 — League chat had no moderation surface — FIXED

`postLeagueMessage` caps length and rate, which is good. But there is no delete,
no report, no mute, no commissioner moderation — `ChatTab` even receives
`isCommissioner` and discards it as `_isCommissioner`
(`ChatTab.jsx:14`). Messages are stored verbatim and rendered to every member
with no recourse. For a persistent social space this will need to exist before
it's needed, not after.

### D3 · P3 — Removal was the only logged commissioner action — FIXED

`removeLeagueMember` writes to the activity feed specifically so a commissioner
"cannot quietly purge rivals mid-season". The same reasoning applies to matchup
regeneration, settings changes, and (once they exist) result corrections — none
of which are logged.

---

## E. Automation and scheduling

### E1 · P1 — Weekly recaps generated before the week resolved — FIXED

- `generateWeeklyRecaps` — Sunday **22:00 ET** (`leagueAutomation.js:461`).
- `processWeeklyMatchups` — inside the nightly scoring run, which scores the
  _completed_ game day after the 2 AM ET boundary (`helpers/scoring.js:615`).

The recap generator skips any matchup where `!matchup.completed || !matchup.scores`
(`leagueAutomation.js:218`). At 22:00 Sunday the week's final night has not been
scored and the matchups are not resolved, so the recap is built from unresolved
data and emits an empty `highlights[]` with null stats. This compounds A1 — even
the highlights that could fire, don't.

### E2 · P2 — The crons assumed week boundaries land on Sunday/Monday — FIXED

Season weeks are `ceil((activeDay - springTrainingDays) / 7)` from the season
start date (`helpers/gameDay.js:110-121`), but generation/recap/rivalry jobs are
pinned to Sunday 23:59, Sunday 22:00 and Monday 06:00. Any season whose start
date or `springTrainingDays` doesn't align puts the automation mid-week, with
no assertion anywhere that the two agree.

### E3 · P2 — `processWeeklyMatchups` had a hard 500-league cap — FIXED

`functions/src/helpers/weeklyMatchups.js:41-47` fetches with `.limit(500)` and
logs a warning when it hits the cap. Every other league job was migrated to
`processAllInPages`. At 501 leagues, matchups silently stop resolving for the
overflow — the most damaging possible failure mode, and it only produces a log
line.

### E4 · P2 — Rivalries written but never cleared — FIXED

`updateLeagueRivalries` only writes when `rivalries.length > 0`
(`leagueAutomation.js:646`). A `meta/rivalries` doc from a previous season is
never cleared, so leagues can display last season's rivalries indefinitely.
There's no season scoping on the doc at all.

### E5 · P3 — `detectRivalries` mutated the matchup it was reading — FIXED

`const [p1, p2] = matchup.pair.sort()` (`leagueAutomation.js:125`) sorts the
array **in place**, then the win-attribution block below reads
`matchup.pair[0]` / `matchup.pair[1]` expecting the original order. The result
happens to come out correct, but only by coincidence — any reordering of those
branches silently corrupts head-to-head records. The scores lookup surviving is
also luck (it's keyed by uid).

### E6 · P3 — Automated generation ignored `matchupsGeneratedWeek` — FIXED

The commissioner path sets `matchupsGeneratedWeek` (`callable/leagues.js:611`),
which the league card reads to show "Matchup in progress"
(`Leagues.jsx:136`). The scheduled generator never sets it, so auto-generated
leagues — i.e. almost all of them — never show the indicator.

---

## F. Frontend correctness and performance

### F1 · P1 — `MatchupsTab` head-to-head scores were always zero — FIXED

`src/components/Leagues/tabs/MatchupsTab.jsx:42`:

```js
const [weeklyResults, _setWeeklyResults] = useState({});
```

The setter is never called. Everything downstream that reads `weeklyResults`
renders 0. The tab also re-fetches season data and matchups into local
`useState` rather than reusing `useLeagueDetail`'s React Query entries, and
keeps its own duplicate `currentWeek`.

### F2 · P1 — Two-class directors were mis-scored in the client table — FIXED

`buildWeeklyResults` (`leagueStats.ts:106`) sums a director's scores across
**all** classes into a single weekly number, while `buildMatchupsByWeek`
flattens per-class matchups into one array. `findMatchupForUser` then uses
`.find()` — the first pairing the director appears in. So a director fielding
World Class and SoundSport has their combined score compared in whichever
matchup happened to flatten first, and their second matchup is invisible to
streak and trend calculations.

### F3 · P2 — SettingsTab did N sequential round trips on open — FIXED

`SettingsTab.jsx:129-151` loops `for (let w = 1; w <= totalWeeks; w++)` awaiting
`getLeagueMatchupWeek` one at a time. `getLeagueMatchups` — one collection read
for all weeks — already exists and `MatchupsTab` already switched to it
(with a comment noting exactly this fix). SettingsTab was missed.

### F4 · P2 — `getMyLeagues` was silently capped at 20 — FIXED

`src/api/leagues.ts:46` uses `limit(20)` with no pagination and no indication in
the UI. A director in 21 leagues loses one without any signal.

### F5 · P2 — Chat was unreadable past 50 messages with no unread state — FIXED

`subscribeToChat` takes the newest 50 with no "load older". `league.hasUnreadMessages`
is read by the league card (`Leagues.jsx:131`) and **written by nothing**, so
the unread dot never appears. Same for `league.isMatchupActive` — the entire
"Live" indicator is dead code. There's no new-message notification either,
despite `'new_message'` being a declared `LeagueNotificationType`.

### F6 · P3 — Dead tag taxonomy on the discovery cards — FIXED

`LEAGUE_TAGS` in `Leagues.jsx:49` defines competitive/casual/roleplay/dynasty/
weekly/public. `getLeagueTags` reads `league.isCompetitive`, `league.type` and
`league.isDynasty` — **none of which are ever written**. Every league renders as
"Casual" (+ "Public"), which is also the fallback. Discovery therefore has no
filtering signal of any kind beyond a name search.

### F7 · P3 — File size and typing debt

`Leagues.jsx` (715), `MatchupDetailView.jsx` (681), `StandingsTab.jsx` (704),
`MatchupsTabParts.jsx` (641), `SettingsTab.jsx` (620), `callable/leagues.js`
(894) and `leagueAutomation.js` (869) are at or past the ~700-line guidance in
`ARCHITECTURE.md`. Most league JSX still carries `@ts-nocheck`.

---

## G. Summary of dead or phantom features

Fields written and never read, or read and never written:

| Field                                           | Written by                 | Read by                  | Status                          |
| ----------------------------------------------- | -------------------------- | ------------------------ | ------------------------------- |
| `settings.scoringFormat`                        | createLeague               | —                        | dead                            |
| `settings.matchupType`                          | createLeague, rookieLeague | —                        | dead                            |
| `settings.playoffSize`                          | createLeague               | —                        | dead (StandingsTab hardcodes 4) |
| `settings.finalsSize`                           | createLeague               | SettingsTab display only | cosmetic                        |
| `league.champions[]`                            | season archival            | —                        | never surfaced in the UI        |
| `league.isCompetitive` / `.isDynasty` / `.type` | —                          | `getLeagueTags`          | phantom                         |
| `league.hasUnreadMessages`                      | —                          | league card              | phantom                         |
| `league.isMatchupActive`                        | —                          | league card ("Live")     | phantom                         |
| `matchupsGeneratedWeek`                         | commissioner path only     | league card              | half-wired (E6)                 |
| `invitation.inviteCode`                         | invite callable            | —                        | always `null`, leak risk        |
| `league.poolCarry`                              | pool settlement            | pool buy-in only         | can strand coin (B6)            |

`league.champions[]` deserves its own line: the game records every league's
season champion, with score and corps name, and **never shows it to anyone**.
That is the single best piece of clubhouse content already sitting in the
database.

---

# Part 2 — The plan

## The thesis

A clubhouse is not a leaderboard. It's a place with **a real competition**, **a
shared memory**, and **a reason to show up between score drops**.

Right now leagues have a competition that doesn't work (Part 1A), no memory
(champions hidden, recaps empty, no history), and a daily heartbeat that's
already good (prediction pools) but buried behind a tab with no URL.

The plan is four phases. Phase 1 is not optional — nothing else matters while
the standings are wrong.

---

## Phase 1 — Make the competition real _(the foundation)_

**Goal: a league's standings are correct, singular, and decide the champion.**

1. **Resolve matchups on weekly score, not season total.** (A1)
   Add `getWeeklyScore(corps, week)` reading `corps.{class}.weeklyScores`, with
   a recap-derived fallback. Use it in `weeklyMatchups.js` and the commissioner
   path. Unit-test the week-boundary mapping.

2. **Collapse to one standings system.** (A2, A3)
   Make `leagues/{id}/standings/current` authoritative. Fix `pointsFor` to
   accumulate the _weekly_ score. Delete the client's parallel
   `computeMemberStandings` fold, keeping `buildWeeklyResults` /
   `buildMatchupsByWeek` for display only. `useLeagueLiveStandings` becomes a
   plain subscription with no second writer.

3. **Crown the standings winner.** (A4, A5)
   Rewrite the champion selector in `season.js` to read
   `standings/current` (record → tiebreakers → points), and gate eligibility on
   `isActiveThisSeason()` instead of `activeSeasonId`. Keep the total-points
   winner as a separate, clearly-labelled "high scorer" award.

4. **Fix or remove the playoff line.** (A6)
   Ship a real end-of-season bracket seeded from standings, or delete
   `playoffSize`/`finalsSize`/`scoringFormat`/`matchupType` and the cut line.
   Recommendation: **ship it** — a two-week playoff is the payoff the whole
   season is building toward, and `finalsSize` already implies it.

5. **Deduplicate and improve pairing.** (A7, A9, A10)
   One `smartPairMembers` in `helpers/leagueHelpers.js`. Add prior-opponent
   memory (avoid rematches until everyone's been played), rotate byes so the
   same director doesn't get them repeatedly, and use `MATCHUP_CLASSES`
   everywhere.

6. **Move recap generation after resolution.** (E1)
   Run recaps from the nightly run immediately after `processWeeklyMatchups`
   rather than on an independent Sunday-evening cron. Assert the week boundary
   agrees with the cron schedule (E2).

7. **Page `processWeeklyMatchups`.** (E3) Swap `.limit(500)` for
   `processAllInPages`, matching every sibling job.

**Definition of done:** a director's record is the same number everywhere, a
week's matchup can be lost by someone who's leading the season, and the league
champion is the director who won the league.

---

## Phase 2 — Close the correctness and lifecycle holes

**Goal: no data loss, no free money, no orphaned leagues.**

- **Entry fee on invitation accept** (B1) — call `chargeEntryFeeInTransaction`,
  and refresh season activity on that path (B3).
- **Clear standings on leave** (B2) — reuse the removal logic.
- **Cascade delete or archive** (B4) — a `deleteLeague` path that refunds
  escrow (`prizePool` + `poolCarry`) and recursively deletes subcollections.
  Prefer _archive_ over delete so history survives.
- **Commissioner succession** (C1) — a `transferCommissioner` callable, plus an
  automatic hand-off to the longest-tenured active member when a commissioner
  leaves. Never let `creatorId` point outside `members`.
- **`updateLeagueSettings` callable** (C2) — name, description, visibility,
  `maxMembers` (never below current roster), and the tag taxonomy from F6.
  Entry fee stays immutable once the pool is non-empty. Log every change to the
  activity feed (D3).
- **Wire regeneration properly** (C3) — point SettingsTab at
  `triggerMatchupGeneration` with `forceRegenerate`, or drop the confirm dialog.
- **Fix the rookie-circuit code leak** (D1) — write to `meta/private` +
  `leagueInvites/{code}` like `createLeague`, never the league doc. Run
  `stripLeagueInviteCodes.js` afterwards. Add a rookie gate and make the circuit
  commissioner-less (system-owned `creatorId`) (C7).
- **Invitation TTL + cleanup job** and drop the dead `inviteCode` field (C5).
- **Clear stale rivalries** and season-scope the doc (E4). Fix the in-place
  `.sort()` (E5).
- **Set `matchupsGeneratedWeek` from the scheduled generator** (E6).

---

## Phase 3 — Make it a place _(the clubhouse layer)_

**Goal: a league is somewhere you go, not a tab you check.**

1. **Give leagues a URL.** (C4) `/leagues/:leagueId` and
   `/leagues/:leagueId/:tab`, with detail rendered from route params instead of
   `useState`. This unlocks: shareable links, browser back, refresh-restore,
   the champion notification link that currently 404s, deep links from chat and
   push, and OG share cards for a league's standings.

2. **Surface league history.** The `champions[]` array is already being
   written — build a **League Hall of Fame** panel: past champions, their
   corps, their score, dynasty streaks. Add all-time head-to-head records, a
   league records book (highest week, biggest blowout, longest streak), and
   per-member career-in-this-league pages.

3. **Make the activity feed the front page.** It already ingests matchups,
   joins, pool results, champions, removals. Add: weekly recap cards inline,
   score-drop reactions, "X passed you in the standings", trash-talk replies on
   feed items, and emoji reactions. This is what a member should land on.

4. **Chat that works as a room.** (F5, D2) Paginated history, unread counts
   (write `lastReadAt` per member and derive the dot the card already renders),
   new-message notifications, @mentions, message deletion for the author, and
   commissioner moderation (delete + mute) — `ChatTab` already receives
   `isCommissioner` and throws it away.

5. **Weekly rhythm.** A Monday "your week ahead" card (your matchup, your
   opponent's form, the rivalry record), a Sunday "week in review" (a _working_
   recap, post-Phase 1), and the pool as the nightly heartbeat it was designed
   to be.

---

## Phase 4 — Depth for the enthusiasts

- **Real discovery.** (F6) Write the tag taxonomy at creation
  (competitive / casual / roleplay / dynasty), filter and sort by it, show
  activity level and pace-of-play, and recommend leagues by class and level.
- **League formats.** The `scoringFormat` field promises three; deliver them
  properly, plus the Survivor / Pick'em / One-Night Slate ideas already parked
  in `GAMIFICATION.md:351`.
- **Dynasty mode.** Multi-season leagues with persistent standings, a hall of
  fame, retired numbers, and cross-season rivalry records.
- **Co-commissioners and league constitutions.** (C6) A rules document,
  vote-based settings changes, scheduled format locks.
- **Cross-class normalized matchups** (A8) so a league doesn't have to be
  single-class to feel fair.
- **Pay down the debt** (F7): split the god-files, drop `@ts-nocheck`,
  consolidate `MatchupsTab`'s duplicate fetching onto `useLeagueDetail` and fix
  the dead `weeklyResults` state (F1) and the two-class flattening (F2).

---

## Suggested sequencing

| Order | Items                      | Why first                                  |
| ----- | -------------------------- | ------------------------------------------ |
| 1     | A1, A2, A3                 | Everything else displays these numbers     |
| 2     | A4, A5, E1, E3             | The season has to end correctly            |
| 3     | D1, B1, B2, C1             | Security + data-loss + orphan leagues      |
| 4     | C4 (routing)               | Unlocks sharing, links, and all of Phase 3 |
| 5     | A6/A7 (playoffs + pairing) | The competition gets interesting           |
| 6     | Phase 3                    | The clubhouse                              |
| 7     | Phase 4                    | Depth                                      |

## Quick wins worth doing immediately

Small, isolated, high ratio of value to risk:

- `F3` — SettingsTab's sequential week loop → `getLeagueMatchups` (one read).
- `E6` — set `matchupsGeneratedWeek` in the scheduled generator.
- `C5` — stop writing the dead `inviteCode` onto invitations.
- `A10` — `MATCHUP_CLASSES` in `updateMatchupResults`.
- `F1` — delete the dead `weeklyResults` state or wire it.
- `E5` — copy before sorting in `detectRivalries`.

---

## Still outstanding

- **A6 (last piece)** — `scoringFormat` and `matchupType` are still stored and
  never read. Implement the formats or delete the fields.
- **A8 (real fix)** — cross-class _normalized_ scoring, so a mixed-class league
  can rank on one comparable scale. The table is now honest about the limitation
  rather than fixed of it.
- **C6** — co-commissioners, result correction, pinned announcements, league
  rules documents, scheduled format locks. The audit view (D3) and settings
  editing (C2) landed; the rest of the commissioner toolkit has not.
- **F7 (remainder)** — `MatchupsTab` still fetches into local `useState` rather
  than reusing `useLeagueDetail`'s React Query entries, and several league files
  remain `@ts-nocheck`'d. `StandingsTab` is back under the line; the rest of the
  folder is not yet migrated.
- **Phase 4** — alternate league formats (Survivor / Pick'em / One-Night Slate),
  dynasty mode, and the deeper discovery work.
