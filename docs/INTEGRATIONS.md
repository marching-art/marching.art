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

| Channel            | Secret                              | Posts                                                                                 |
| ------------------ | ----------------------------------- | ------------------------------------------------------------------------------------- |
| scores             | `DISCORD_SCORES_WEBHOOK_URL`        | nightly score drop (with SoundSport blue ribbons), all-time records, season champions |
| **#announcements** | `DISCORD_ANNOUNCEMENTS_WEBHOOK_URL` | Fan Favorite ballots + results, season start, lineup lock, Eastern Classic night lineups |
| **#news**          | `DISCORD_NEWS_WEBHOOK_URL`          | published articles, the weekly Podium Report                                          |
| **#events**        | `DISCORD_EVENTS_WEBHOOK_URL`        | director-hosted shows — **never** the generated season schedule                       |
| **#operations**    | `DISCORD_OPS_WEBHOOK_URL`           | admin-only: scoring-watchdog and scrape-canary alerts                                 |

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

---

## Discord (Fan Favorite ballots → #announcements)

The Fan Favorite is a community ritual (see [`PODIUM.md`](PODIUM.md) decision
30), and the community lives in Discord — a ballot nobody knows is open
collects nobody's vote. Three event posts go to the server's
**#announcements** channel:

| Post             | When                                                                                                                        | Contents                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Prelims open** | the night a major is scored (days 28, 35, and **42** for the two-night Eastern, whose field isn't complete until night two) | candidate corps by division, the day voting closes, vote link    |
| **Finals open**  | the night finalists publish (day 44)                                                                                        | each major's prelims **results** with vote counts, the finalists |
| **Crowned**      | season archival (first night of the next season)                                                                            | the finals results and the winner                                |

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

## Discord (Eastern Classic night lineups → #announcements)

The Eastern Classic is one event across two nights (days 41-42): registering
once covers both, and every corps performs exactly one night, seeded by season
score and snaked so the nights carry equal strength
(`helpers/easternSplit.js`, [`PODIUM.md`](PODIUM.md) §5.11). The split is
computed after the **day-38** scoring run and published to
`eastern-classic/{seasonUid}` — the "who got Friday?" moment the design calls
for. Until this post existed it landed silently, and a director only learned
their night by opening the app.

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
- **Idempotency + window:** one lease, `{seasonUid}_eastern_preview_day38`,
  contended by every night in the **days 38-40** window. The normal case posts
  on day 38; a night when Discord was unreachable (or when the preview landed
  late) re-claims the failed lease and re-posts the next night, still ahead of
  the event. Outside the window, and before the preview exists, the stage is a
  no-op that claims nothing.
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
- **The Podium Report** — `functions/src/helpers/podium/podiumReportDiscord.js`,
  posted by `runPodiumReportStage` after the Podium stage publishes the week's
  column to `podium-recaps/{seasonUid}/power/{week}`. The column is
  deterministic and data-composed (never LLM-written), so it is safe to
  syndicate verbatim. One lease per week (`{seasonUid}_discord_podreport_day{week}`).

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
