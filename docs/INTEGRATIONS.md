# Integrations

External services and data pipelines: YouTube video embeds, Google Gemini
(AI news + corps avatars), the Discord channel webhooks, and the
historical-data importers that feed scoring and schedule generation.

---

## Discord (channel map)

Five channels, five webhooks, five secrets. One secret per channel is
deliberate: any channel can be rotated, or silenced by setting its secret to
an empty value, without touching the others — and an unset secret disables
only that channel's posts. Shared plumbing lives in
[`functions/src/helpers/discord.js`](../functions/src/helpers/discord.js):
the secret definitions, the poster, the lease-guarded `postOnce`, and the
embed helpers.

| Channel             | Secret                               | Posts                                                                                                                                               |
| ------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| scores              | `DISCORD_SCORES_WEBHOOK_URL`         | nightly score drop (with SoundSport blue ribbons), the Podium Class drop, all-time records, championship-week cuts, season champions                |
| **#announcements**  | `DISCORD_ANNOUNCEMENTS_WEBHOOK_URL`  | Fan Favorite ballots + results, season start, lineup lock, championship-week caption windows, registration deadlines, Eastern Classic night lineups |
| **#news**           | `DISCORD_NEWS_WEBHOOK_URL`           | published articles (except press releases), the weekly Podium Report                                                                                |
| **#press-releases** | `DISCORD_PRESS_RELEASES_WEBHOOK_URL` | director-authored press releases (article category `press`) — **never** newsroom copy                                                               |
| **#events**         | `DISCORD_EVENTS_WEBHOOK_URL`         | director-hosted shows — **never** the generated season schedule                                                                                     |
| **#operations**     | `DISCORD_OPS_WEBHOOK_URL`            | admin-only: scoring-watchdog and scrape-canary alerts                                                                                               |

Two rules hold across every channel:

- **No pings, ever, by default.** Corps names, event names and director names
  are user-authored and flow straight into embed copy, so every post is sent
  with `allowed_mentions: {parse: []}` — nobody can name a corps `@everyone`
  and ping the server from inside the game. A post that _should_ ping opts in
  explicitly.
- **Isolation.** No Discord failure ever fails, blocks, or retries game logic.
  Announcements that should survive an outage are lease-guarded and re-posted
  by the next nightly run; fire-and-forget posts are logged and dropped.

**Setup (any channel):** create the webhook (Channel Settings → Integrations
→ Webhooks), then store it in Secret Manager **before deploying** — the
declaring functions won't deploy until the secret exists. Either add it as a
repo secret of the same name and run **Deploy Cloud Functions** with
`deploy_target: all` and the `set_discord_webhook_urls` box checked — one box
pushes every `DISCORD_*_WEBHOOK_URL` repo secret that is set, and warns about
any that aren't —
or `firebase functions:secrets:set <NAME>` via the CLI. A webhook URL is a
post-capability — anyone holding it can post to the channel — which is why it
lives in Secret Manager, never in the world-readable `game-settings` docs.

---

## Discord (nightly score drop)

After the nightly scoring commit (at the night's score-drop time — see
[`SCORE_DROPS.md`](SCORE_DROPS.md): 9 PM ET off-season, 11 PM–2 AM ET in live
season by the westernmost show), the pipeline posts one rich embed to the
community server's scores channel: tonight's top three per ranked class,
show count, and a link to `/scores`.

SoundSport is mentioned by participation count and by **blue ribbon** — each
show's Best in Show winner is named, using the same per-show rule
`scoringAwards.js` awards the trophy by. The award is announced, never the
rating: SoundSport scores are still revealed nowhere in the product.

Two more things ride this channel:

- **All-time records.** `gameRecords.js` stamps every record it accepts with
  `{seasonName, day}`, so "what fell tonight" needs no extra state — the stage
  reads `game-records/records` and filters for tonight. A record adds a second
  embed to the same message (same channel, same moment, one notification).
- **Season champions.** On finals night (day 49) the drop is followed by a
  separate champions post built from `season_champions/{seasonUid}`, under its
  own `{seasonUid}_discord_champions_day49` lease so a champions failure can't
  un-post the drop.

- **Code:** `functions/src/helpers/scoreDrop.js` (aggregation + embed + post),
  wired as an isolated stage in `functions/src/scheduled/nightlyStages.js`
  (`runDiscordStage`) — a Discord failure is logged and swallowed, never
  blocking or retrying fantasy scoring.
- **Idempotency:** a `scoring_runs` lease under `{seasonUid}_discord_day{N}`
  guarantees at most one post per scored day even when Cloud Scheduler
  retries a completed run.
- **Setup:** create a webhook in the Discord channel (Channel Settings →
  Integrations → Webhooks), then store its URL in Secret Manager **before
  deploying the scoring functions** (they declare
  `secrets: [discordScoresWebhookUrl]`, so deploy fails if the secret doesn't
  exist). Two ways to do that:
  - **Via GitHub Actions (preferred):** add the URL as a repository secret
    named `DISCORD_SCORES_WEBHOOK_URL` (GitHub → Settings → Secrets and
    variables → Actions), then run the **Deploy Cloud Functions** workflow
    with `deploy_target: all` and the `set_discord_webhook_urls` box checked —
    the workflow pushes the repo secret into Secret Manager and the deploy
    binds it. Leave the box unchecked on later deploys; re-check it only to
    rotate a URL (same mechanism as `set_scraper_api_key`).
  - **Via the CLI:**

    ```bash
    firebase functions:secrets:set DISCORD_SCORES_WEBHOOK_URL
    ```

  The webhook URL is a post-capability — anyone holding it can post to the
  channel — which is why it lives in Secret Manager, never in the
  world-readable `game-settings` docs. Setting the secret to an empty value
  disables the stage without redeploying.

The companion morning push (`scoreDropPushJob` in
`functions/src/scheduled/pushNotifications.js`, 8 AM ET) notifies each
director who performed last night via FCM, gated by the existing
`pushPreferences.scoreUpdate` setting.

### The Podium Class drop

Podium scores every night on its own board, and until it had a drop of its own
those results landed on a page nobody was told had updated. It posts to the
**same channel** — a score drop is a score drop — as a **separate message**,
for two reasons: the two boards are never cross-ranked
([`PODIUM.md`](PODIUM.md) §7.2), and one message mixing them invites exactly
that comparison; and they are scored by different jobs at different hours
(Podium at 9 PM ET nightly), so there is no single moment that could carry
both.

Podium is scored **per show**, so the post reads the night out show by show —
each show's own podium, divisions named per row — and never composes a
cross-show ranking. A tour night can carry a dozen self-selected shows, so the
biggest fields lead and the rest are counted in the footer. The night's high
score is stated as a number, not as a placement.

In championship week the cut the night decided rides the same message, read
straight off `recap.championshipCut` — the field the processor published with
the recap (`store.championshipCutFor`), the same one the recap sheet renders.
Nothing in the announcement path re-derives who advances.

- **Code:** `functions/src/helpers/podium/scoreDropDiscord.js`, wired as
  `runPodiumScoreDropStage` in `functions/src/scheduled/nightlyStages.js` and
  run right after the Podium stage by both callers
  (`scheduled/dailyProcessors.js` at 2 AM, and `scheduled/dropDispatcher.js`'s
  9 PM `podiumNightly` once drop scheduling is on). Isolated the same way as
  every other stage.
- **Idempotency:** one `scoring_runs` lease per night,
  `{seasonUid}_discord_podium_day{N}`. Nights with no recap, rest nights and
  spring training claim nothing at all.
- **Setup:** shares `DISCORD_SCORES_WEBHOOK_URL` with the fantasy drop — no
  new secret. Both jobs already declare it.

---

## Discord (Fan Favorite ballots → #announcements)

The Fan Favorite is a community ritual (see [`PODIUM.md`](PODIUM.md) decision
30), and the community lives in Discord — a ballot nobody knows is open
collects nobody's vote. Three event posts go to the server's
**#announcements** channel:

| Post             | When                                                                                                                        | Contents                                                                                                                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Prelims open** | the night a major is scored (days 28, 35, and **42** for the two-night Eastern, whose field isn't complete until night two) | candidate corps by division, the day voting closes, vote link                                                                                                                                                 |
| **Finals open**  | the night finalists publish (day 44)                                                                                        | each major's prelims **results** with vote counts, the finalists                                                                                                                                              |
| **Crowned**      | season archival (first night of the next season)                                                                            | the finals results, the winner, and — when the ballot finished level — which tiebreaker decided the crown and the two numbers it turned on (a seeded draw is named as a coin flip, never dressed up as a win) |

- **Code:** `functions/src/helpers/podium/fanFavoriteDiscord.js` (embeds +
  post), wired as `runFanFavoriteStage` in
  `functions/src/scheduled/nightlyStages.js` and run right after the Podium
  stage by both callers (`scheduled/dailyProcessors.js` at 2 AM, and
  `scheduled/dropDispatcher.js`'s 9 PM `podiumNightly` once drop scheduling is
  on) — it announces off the state that stage just wrote. Isolated the same
  way: a Discord failure is logged and swallowed, never blocking Podium
  processing or scoring.
- **Idempotency:** one `scoring_runs` lease per (season, event) —
  `{seasonUid}_fanfav_prelims_day{major}`, `_fanfav_finals_day0`,
  `_fanfav_winner_day0`. The stage runs every night (that is how it notices a
  state change) and posts each announcement exactly once. A failed post marks
  its lease failed, so the next night re-claims and re-posts.
- **Tallies:** the announcements read published results, not ballots.
  `publishFinalists` writes `prelimsResults` (top 5 per major) and
  `crownWinner` writes `finalsResults` onto the world-readable
  `podium-fan/{seasonUid}` doc — ballots stay server-only and private
  (`firestore.rules`), counts are public, exactly as decision 30 specifies.
- **Setup:** a **separate webhook and secret** from the score drop —
  `DISCORD_ANNOUNCEMENTS_WEBHOOK_URL`, pointed at #announcements. Create the
  webhook (Channel Settings → Integrations → Webhooks), then store it in
  Secret Manager **before deploying** (the nightly jobs declare
  `secrets: [discordAnnouncementsWebhookUrl]`): either add it as the repo
  secret `DISCORD_ANNOUNCEMENTS_WEBHOOK_URL` and run **Deploy Cloud Functions**
  with `deploy_target: all` and `set_discord_webhook_urls` checked, or
  `firebase functions:secrets:set DISCORD_ANNOUNCEMENTS_WEBHOOK_URL` via the
  CLI.

---

## Discord (championship-week cuts → #scores)

Three nights of championship week end with a cut, and each is the most
dramatic thing that happens all year: Day 45 Prelims decide the top 8 Open +
top 4 A for the Open & A Class Finals, Day 47 Prelims decide the top 25 for
Semifinals, Day 48 Semis decide the top 12 for Finals. (SoundSport marches
none of these — it has its own festival on Day 49.) The cut was already being
computed and announced to nobody but the logs.

- **Code:** `functions/src/helpers/championshipCuts.js`. The embed is appended
  to the nightly score drop (`helpers/scoreDrop.js`) exactly like the
  all-time-records embed — same channel, same message, same moment as the
  scores that decided it. **No new lease, secret, or scheduled job**, and on
  the other 46 nights `cutForDrop` returns null and nothing changes.
- **Single source of truth:** it calls `scoringAwards.buildChampionshipConfig`
  — the same function the scorer uses to decide who actually gets scored
  tomorrow — rather than re-deriving the cutoff. A second implementation of
  "top 25, ties included" would eventually disagree with the one that counts,
  and a post naming a corps the scorer then leaves out is worse than no post.
  The recap is used only to put names and scores on the uids it returns.
- **Class filter:** the participant list is ranked _before_ `classFilter` is
  applied, so the announcement re-applies that filter. This keeps the count
  truthful (an ineligible row occupies a slot but never marches) and
  guarantees a SoundSport score can never reach a public embed — SoundSport is
  ratings-only and its scores are never revealed anywhere in the product.
- **Ties:** the cutoff is tie-inclusive, so a tie on the cut line advances
  everyone level with it and the post says 26, not 25.

---

## Discord (registration deadlines → #announcements)

Each class closes **new-corps** registration a fixed number of weeks before
finals (`classRegistry.registrationLockWeeks`: World 6, Open 5, A 4;
SoundSport and Podium never lock) so a director can't enter a class with too
little season left to compete — `helpers/registrationLock.js`, enforced in
`callable/corps.js`. It is hard and irreversible: miss it and that class is
gone until next season. The rule was enforced and never advertised, so a
director met it as an error message when it was already too late.

- **Code:** `functions/src/helpers/registrationAnnounce.js`, called from
  `scheduled/pushNotifications.js`'s daily 4 PM ET job. That job hosts it for
  two reasons: it is the one job that runs **every** day regardless of which
  scoring pipeline owns the night, and it already declares the
  #announcements webhook. The call sits **before** that job's lineup-lock
  early return — the two deadlines are unrelated and rarely coincide.
- **Timing:** the lock fires when `weeksRemaining < lockWeeks`, so the post
  goes out while `weeksRemaining === lockWeeks` — the last week the class is
  still open, which is the only week the post is actionable. Tests pin this
  against `getRegistrationLock` itself rather than a copy of the numbers.
- **Idempotency:** one lease per closing week,
  `{seasonUid}_discord_reglock_day{weeksRemaining}`. `weeksRemaining` holds the
  same value for seven days, so the daily job posts on the first day of the
  window and is quiet for the rest; World, Open and A each get their own post.
- **Copy:** the footer states that the lock only affects _starting_ a corps —
  without it, a director who already has one reads the post as a threat to the
  corps they're running.
- **Not a push:** the audience is directors who have **not** registered in a
  class, which is exactly the group the per-corps push fan-outs cannot target.

---

## Discord (championship-week caption windows → #announcements)

Championship week is the one week the caption-change rules change shape
(`helpers/captionWindows.js`): **days 43-44 are closed to every class**, then
days 45-49 give **2 changes per class per day** — but only to the classes still
competing that day (`CHAMPIONSHIP_CLASS_DAYS`). A class off the day's list is
locked out even when its corps advanced and is still marching later in the week.

Every other lock is announced the evening it lands, which is right for a
deadline and wrong for a rule change: by the day-45 post, two days of "why is
my lineup frozen?" have already happened, and an Open Class director reading
"changes close tonight" on day 48 can't tell the post isn't about them.

- **Code:** `functions/src/helpers/championshipWeekAnnounce.js`, called from
  `scheduled/pushNotifications.js`'s daily 4 PM ET job — the same host, for the
  same two reasons, as registration deadlines above. It sits **before** that
  job's lineup-lock early return, and must: day 43 is a blackout day, so
  `getLineupLockContext` returns null on it.
- **Timing:** posts on **day 43** — the Sunday championship week opens on, and
  the first day changes are closed — so the closure is read before it is met.
- **Idempotency:** one lease, `{seasonUid}_discord_champweek_day43`.
- **Copy:** the same schedule twice, because directors ask it both ways: day by
  day (which classes may change today) and by class (which days _my_ corps may
  change). Both are generated from `CHAMPIONSHIP_CLASS_DAYS` and
  `CHAMPIONSHIP_TRADE_LIMIT`, and the tests assert every claim against
  `getCaptionChangeWindow` itself — a post that says "open" where `saveLineup`
  says "closed" is worse than no post. Weekday dates and the 8 PM ET close time
  are derived from the season's own `startDate`, never hardcoded.
- **Footer:** every class gets the same 3 change days and the same 6 total
  changes — the answer to "why does World Class get the last two days?".

---

## Discord (Eastern Classic night lineups → #announcements)

The Eastern Classic is one event across two nights (days 41-42): registering
once covers both, and every corps performs exactly one night, seeded by season
score and snaked so the nights carry equal strength
(`helpers/easternSplit.js`, [`PODIUM.md`](PODIUM.md) §5.11). The split is
computed after the **day-38** scoring run and published to
`eastern-classic/{seasonUid}` — the "who got Friday?" moment the design calls
for. Until this post existed it landed silently, and a director only learned
their night by opening the app. The lineup keeps moving after that first post,
so the announcement is not a one-shot: see "When the seeding moves" below.

- **Code:** `functions/src/helpers/easternClassicDiscord.js` (embed + post),
  wired as `runEasternClassicStage` in
  `functions/src/scheduled/nightlyStages.js`. It announces off state someone
  else wrote, so it runs **after fantasy scoring** in both callers:
  `scheduled/dailyProcessors.js` (2 AM, after the Podium stage) and
  `scheduled/dropDispatcher.js` (in the tick, right after the score drop, so
  the lineups reach the server in the same moment as the scores that seeded
  them). Isolated like every other stage — a Discord failure never touches
  scoring.
- **Contents:** one field per night, listing each fantasy class with its
  headcount and roster (strongest seed first, clamped with a `+N more` tail so
  a big class can't blow Discord's 1024-character field limit). When the Podium
  stage has already written its own snake that night, the Podium **headcount**
  joins each field — that doc is uid-keyed, so it contributes numbers, not
  names.
- **It is a PREVIEW, and says so.** The authoritative split is recomputed from
  **final** enrollment on night one (`easternSplit.resolveEasternNightSet`),
  and week-6 show selections stay editable until then — so a corps that joins
  or drops on days 39-40 is re-seeded. The embed's footer states this outright;
  copy that read as final would make a late registrant think the post had lost
  them.
- **When the seeding moves, it says so again.** The split is a snake over
  whoever is enrolled, so one registration on day 39 re-seeds everyone below it
  and can flip nights that were already announced. `publishEasternPreview` now
  recomputes the preview after **every** run in the days-38-40 window and bumps
  `preview.revision` when a corps actually changes nights (a pure re-seed
  inside the same night is not a change — seeds churn nightly, and announcing
  that would mean a post almost every night). The stage then posts an
  **update** embed: a `🔀 Changed nights` field naming each corps and the day
  it now marches, `➕`/`➖` fields for joins and drops, and the full current
  lineup so the post stands alone. Directors whose corps moved also get an
  `eastern_night_change` entry in their in-app inbox, deduped per revision.
- **Idempotency + window:** the first post takes one lease,
  `{seasonUid}_eastern_preview_day38`, contended by every night in the **days
  38-40** window; a night when Discord was unreachable (or when the preview
  landed late) re-claims the failed lease and re-posts the next night, still
  ahead of the event. Updates take `{seasonUid}_eastern_update_day{N}` — at
  most one per night. Each successful post records what it announced on the
  split doc (`announced.lineup`), and the next run diffs the live lineup
  against **that**, not against the previous revision: a failed update
  therefore collapses into one cumulative update the next night instead of
  losing a change nobody ever saw. Outside the window, before the preview
  exists, and on a night when nothing moved, the stage is a no-op that claims
  nothing.
- **Setup:** shares `DISCORD_ANNOUNCEMENTS_WEBHOOK_URL` with the Fan Favorite
  posts — no new secret. The `scoreDropDispatcher` job declares it alongside
  the scores webhook.

---

## Discord (#news)

Two publishers, one channel:

- **Published articles** — `functions/src/triggers/newsDiscord.js`, an
  `onDocumentCreated` trigger on
  `news_hub/{seasonId}/days/{dayId}/articles/{articleType}`. Articles reach
  Firestore from several paths (nightly generation, the season summary, the
  admin approve flow, the trusted-author auto-publisher) but all land on that
  one path, so a single trigger covers every publish route present and future.
  Each post carries the headline, summary, hero image when one exists, and a
  link built from the composite article id the SPA resolves
  (`{seasonId}_{dayId}_{articleType}`). A **backfill guard** (`FRESH_WINDOW_MS`,
  6 h) means a records rebuild or migration can never replay years of
  headlines into the channel. Volume is ~5 posts on a generation night; if
  that ever reads as noise, switch to one digest per day off the day-index doc.
  The **Podium Report** rides this same path: the nightly generation run writes
  it as a published article (`functions/src/helpers/newsPodiumArticle.js`, the
  deterministic power-rankings column), so it reaches #news through the
  published-articles trigger like every other article — no separate standings
  embed. (An earlier build posted a second standalone embed from
  `runPodiumReportStage`; it was removed because #news received the same board
  twice.)

---

## Discord (#events — director-hosted shows only)

A hosted show is open-enrollment: the host rents a venue, the show lands on
the season schedule, and any corps can pick it in the weekly selector. The
host's payout scales with how many distinct directors actually turn up — so
whether a booking profits comes down to whether anyone hears about it.

- **Code:** `functions/src/helpers/hostedEventDiscord.js`, called at the end of
  the `hostEvent` callable (`functions/src/callable/podiumHost.js`) once the
  event exists and is on the schedule. Fire-and-forget: a Discord failure is
  logged and swallowed — it must never fail a callable the director paid
  CorpsCoin for.
- **Scope — this is the whole point of the channel:** only director-created
  events post here. The **generated season schedule**
  (`helpers/seasonSchedule.js`, the `seasonScheduler` job) must never post to
  #events — it is dozens of shows nobody chose, and it would bury the one show
  a player is trying to fill.

---

## Discord (#operations — admin only)

The scoring watchdog (4:30 AM) and the scrape canary (1 PM) already detect the
incidents that matter. They reported via a stably-tagged `logger.error` plus an
admin email — a fine audit trail, a slow page. The webhook post is the fast
path.

- **Code:** `functions/src/helpers/opsAlerts.js`, called from
  `scheduled/scoringWatchdog.js` and `scheduled/scrapeCanary.js`.
- **Additive, never sole:** the log line and the email still go out. An
  alerting channel that can itself be down must not be the only place an
  incident is reported. `postOpsAlert` never throws.
- **Not lease-guarded**, unlike the announcement posts: a problem that persists
  across runs _should_ keep being reported. The callers already fire at most
  once per scheduled run.
- **Keep the channel private:** alerts carry lease keys, run ids and raw error
  text, which is exactly why they don't belong in a player-facing channel.

---

## Discord (season clock → #announcements)

`functions/src/helpers/seasonAnnounce.js` builds two posts for the moments the
game asks something of everyone at once:

- **Season start** — posted by `scheduled/seasonScheduler.js` right after
  `startNewOffSeason`/`startNewLiveSeason`, re-reading the season doc that
  actually landed rather than trusting a return value. Lease:
  `{seasonUid}_discord_seasonstart_day0`. The audience that most needs this is
  the one not opening the app — lapsed directors still sitting in the server.
- **Lineup lock** — posted by the existing 4 PM `lineupLockReminderPushJob`
  when `getLineupLockContext` says caption changes close tonight. The FCM push
  reaches directors with changes left to spend; the channel post reaches
  everyone else, including people who never enabled push. Lease is keyed by the
  caption window's `periodKey`, which is exactly "which lock is this", so the
  daily job announces each lock once and stays quiet in between.

---

## YouTube (video embeds)

Lets the app surface relevant performance videos via the YouTube Data API v3,
with a Firestore cache to stay well under quota.

- **Backend:** `exports.searchYoutubeVideo` (`functions/src/callable/youtube.js`)
  — searches the Data API and caches results in the **`youtubeCache`**
  collection so repeat lookups don't spend quota.
- **Admin reset:** `exports.resetYoutubeVideo` (same file, admin-only) — puts a
  bad pick's video ID on the **`youtubeNopeList`** collection (excluded from
  all future searches), deletes the stale `youtubeCache` entry, and re-searches
  immediately. Surfaced as a "Reset" button in the player modal, visible only
  to admins.
- **Frontend:** `src/components/Sidebar/YouTubeModal.jsx`,
  `src/hooks/useYoutubeSearch.js`, `src/components/YouTubeIcon.jsx`. Wired into
  `Landing.jsx` and `Article.jsx`.
- **Config:** requires a YouTube Data API key in the functions environment.

---

## Google Gemini (AI news & media)

The game's editorial voice and corps imagery are AI-generated via Gemini.

- **News engine** — generates DCI and fantasy articles, editorials, uniform
  features, season summaries, and image prompts. Helpers:
  `functions/src/helpers/news*.js` (`newsGeneration`, `newsData`, `newsEditorial`,
  `newsFantasyArticles`, `newsDciArticles`, `newsSeasonSummary`, `newsUniforms`,
  `newsImagePrompts`, …). Triggers/automation: `functions/src/triggers/news*.js`
  and `functions/src/scheduled/newsAutoPublish.js`. Content is validated
  (`newsValidation.js`) before publish.

  > The news engine is **global/editorial** — the same feed for every director.
  > Personalized ("director as protagonist") narrative was considered and cut; do
  > not build per-user storylines on top of it. See [`GAMIFICATION.md`](GAMIFICATION.md).

- **Corps avatars** — AI-generated corps imagery via `helpers/geminiService.js`
  and `helpers/mediaService.js`, driven by the `triggers/avatarGeneration.js`
  trigger. Avatar (re)generation is currently ungated/free (Gemini free tier); if
  it moves to a paid tier, price regeneration tokens in CorpsCoin to rate-limit
  spend (a hook the economy anticipates).

- **Config:** requires a Gemini API key/secret in the functions environment.

---

## Live DCI scraping (scores & schedule)

The nightly live-score scrape (`scrapeDciScores`, 1:30 AM ET), the admin
"Scrape DCI Scores Now" button, the all-years deep scrapes
(`discoverAndQueueUrls` / `discoverAndQueueEventUrls`), and the schedule
enrichment/archive path all pull from **dci.org**.

- **Cloudflare challenge:** dci.org now fronts its **entire zone** with a
  Cloudflare _managed challenge_ (the "Just a moment…" interstitial). A plain
  `axios`/`cheerio` GET — any User-Agent — gets **HTTP 403** and the challenge
  page instead of the scores HTML/sitemap XML. This broke the nightly scrape.
- **Fix — one fetch choke point:** every dci.org request goes through
  [`functions/src/helpers/dciFetch.js`](../functions/src/helpers/dciFetch.js).
  When `SCRAPER_API_KEY` is set it routes the request through a JS-rendering
  scraping API that solves the challenge and returns the final page body; all
  existing parsing is unchanged. When the key is **unset** it falls back to a
  direct GET (keeps local dev/tests working, and lets us drop the paid service
  instantly if DCI later allowlists our egress).
- **Config:**

  | Setting                | Kind                       | Purpose                                                                                                                                                                                              |
  | ---------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `SCRAPER_API_KEY`      | secret                     | API key for the scraping provider. `firebase functions:secrets:set SCRAPER_API_KEY`                                                                                                                  |
  | `SCRAPER_API_PROVIDER` | param (`functions/.env.*`) | `scrapingant` (production) · `scrapingbee` (code default) · `zenrows` · `scraperapi` · `custom`                                                                                                      |
  | `SCRAPER_API_ENDPOINT` | param                      | only for `provider=custom`: URL template with `{key}` and `{url}` placeholders                                                                                                                       |
  | `SCRAPER_API_STEALTH`  | param                      | heavy anti-bot tier toggle — scrapingant: `true` (default) allows escalation to residential proxies, `false` pins datacenter; scrapingbee: `true` uses `stealth_proxy`, `false` uses `premium_proxy` |

- **Cost / provider choice:** production uses **ScrapingAnt**, whose free tier
  (10,000 credits/month, no card) comfortably covers our volume. A JS-rendered
  request costs **10 credits** on its datacenter proxies and **125 credits** on
  residential; `dciFetch` starts every URL on the cheap datacenter tier and only
  **escalates to residential** (via `buildAttemptPlan`) when the response comes
  back as a Cloudflare challenge, so a typical night costs ~10–40 credits. Watch
  for the `escalating retries to the residential tier` log line — if it becomes
  the norm, datacenter IPs have stopped passing and budget accordingly (the paid
  Enthusiast plan is $19/mo for 100k credits). ScrapingAnt's free tier allows
  **1 concurrent request**, which is fine — `dciFetch` callers fetch
  sequentially; keep it that way.

  `dciFetch` also treats a Cloudflare challenge page returned as HTTP 200 (a
  proxy that failed to solve the challenge) as a **retryable** failure, so it
  retries (escalating as above) and surfaces a clear error instead of silently
  parsing junk as "no scores". The dci.org **listing** page (`/scores/`) is the
  heaviest to render and the most likely to need the residential tier; recap
  pages are lighter.

  Any function that fetches dci.org declares `secrets: [scraperApiKey]` — if you
  add a new one, declare it too or the key won't be readable at runtime.

- **Volume & etiquette:** the live scrape hits ~1–4 URLs/night; keep it that way.
  Under the timezone-aware drop pipeline the night's scrape is a **single pass**
  fired at the planned instant (see [`SCORE_DROPS.md`](SCORE_DROPS.md) §2), so
  scraper credits don't scale with the number of dispatcher ticks. The durable
  fix is an allowlist/data arrangement with DCI (a shared-secret header or a
  static-IP Cloudflare skip rule), which lets us drop the scraping API entirely.
- **Still affected:** the upcoming-events scrape (`functions-scraper`, Puppeteer
  against `dci.org/events/`) hits the same Cloudflare wall and is **not** routed
  through `dciFetch` yet — it needs its own bypass (stealth browser or the
  scraping API's JS-scenario paging). It lives in its own deploy codebase
  (`firebase.json` → `codebase: "scraper"`, 2 GB, Chromium) and the main
  functions call it over HTTP with the `SCRAPER_INVOKE_KEY` shared secret.

### Markup-drift canary

`scrapeCanary` (`functions/src/scheduled/scrapeCanary.js`, ~1 PM ET) fetches the
pages the nightly scrape depends on — the `/scores/` listing, sitemap discovery,
and a recap page — and audits their structure via
`helpers/scrapeCanary.js`. A dci.org redesign then surfaces as an early-afternoon
alert instead of a 2 AM scoring-night incident. Alerting mirrors the scoring
watchdog: a stably-tagged `[scrape-canary]` `logger.error` for log-based alerts
plus an admin email fan-out, with the last result persisted to
`admin-stats/scrapeCanary` for the admin dashboard.

## Historical-data importers

Two Node CLI tools under `functions/` populate the `historical_scores` corpus
that drives both **scoring** (Off-Season) and **schedule generation**
(`offSeasonDay` placement — see [`SCHEDULE_SYSTEM.md`](SCHEDULE_SYSTEM.md)). Each
follows a **harvest → parse → import** flow with `--dry-run` and year-range
flags, and keeps its own detailed README:

| Importer               | Purpose                                                               | README                                                                                |
| ---------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **pressboxImporter**   | "From The Pressbox" historical recaps — scores & rankings (2000–2025) | [`functions/pressboxImporter/README.md`](../functions/pressboxImporter/README.md)     |
| **dciArchiveImporter** | archive.org event-name enrichment — show titles (2000–2012)           | [`functions/dciArchiveImporter/README.md`](../functions/dciArchiveImporter/README.md) |

Both can be run against Firestore (`--firestore` / `--merge` / `--replace`) and
are invoked in CI via the `run_historical_import` path in
`.github/workflows/deploy-functions.yml`. The importer parse schema mirrors
`functions/src/triggers/scoreProcessing.js` — keep them in sync.

Related operational data (venues for the running-order model) is refreshed by the
`.github/workflows/refresh-venue-gazetteer.yml` workflow.
