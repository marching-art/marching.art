# Integrations

External services and data pipelines: YouTube video embeds, Google Gemini
(AI news + corps avatars), the two Discord webhooks (nightly score drop →
scores channel, Fan Favorite ballots → #announcements), and the
historical-data importers that feed scoring and schedule generation.

---

## Discord (nightly score drop)

After the nightly scoring commit (at the night's score-drop time — see
[`SCORE_DROPS.md`](SCORE_DROPS.md): 9 PM ET off-season, 11 PM–2 AM ET in live
season by the westernmost show), the pipeline posts one rich embed to the
community server's scores channel: tonight's top three per ranked class,
show count, and a link to `/scores`. SoundSport is mentioned by participation
count only — its ratings are never revealed anywhere in the product.

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
    with `deploy_target: all` and the `set_discord_webhook_url` box checked —
    the workflow pushes the repo secret into Secret Manager and the deploy
    binds it. Leave the box unchecked on later deploys; re-check it only to
    rotate the URL (same mechanism as `set_scraper_api_key`).
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
  with `deploy_target: all` and `set_discord_announcements_webhook_url`
  checked, or `firebase functions:secrets:set DISCORD_ANNOUNCEMENTS_WEBHOOK_URL`
  via the CLI. Two secrets means either channel can be rotated, or silenced by
  setting it empty, without touching the other.

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
