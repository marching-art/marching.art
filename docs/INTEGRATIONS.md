# Integrations

External services and data pipelines: YouTube video embeds, Google Gemini
(AI news + corps avatars), and the historical-data importers that feed scoring
and schedule generation.

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

  | Setting                | Kind                       | Purpose                                                                                                                                 |
  | ---------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
  | `SCRAPER_API_KEY`      | secret                     | API key for the scraping provider. `firebase functions:secrets:set SCRAPER_API_KEY`                                                     |
  | `SCRAPER_API_PROVIDER` | param (`functions/.env.*`) | `scrapingbee` (default) · `zenrows` · `scraperapi` · `custom`                                                                           |
  | `SCRAPER_API_ENDPOINT` | param                      | only for `provider=custom`: URL template with `{key}` and `{url}` placeholders                                                          |
  | `SCRAPER_API_STEALTH`  | param                      | scrapingbee only: `true` (default) uses `stealth_proxy` (its Cloudflare mode); `false` uses `premium_proxy` (for plans without stealth) |

  `dciFetch` also treats a Cloudflare challenge page returned as HTTP 200 (a
  proxy that failed to solve the challenge) as a **retryable** failure, so it
  retries and surfaces a clear error instead of silently parsing junk as "no
  scores". The dci.org **listing** page (`/scores/`) is the heaviest to render
  and the most likely to need `stealth_proxy`; recap pages are lighter.

  Any function that fetches dci.org declares `secrets: [scraperApiKey]` — if you
  add a new one, declare it too or the key won't be readable at runtime.

- **Volume & etiquette:** the live scrape hits ~1–4 URLs/night; keep it that way.
  The durable fix is an allowlist/data arrangement with DCI (a shared-secret
  header or a static-IP Cloudflare skip rule), which lets us drop the scraping
  API entirely.
- **Still affected:** the upcoming-events scrape (`functions-scraper`, Puppeteer
  against `dci.org/events/`) hits the same Cloudflare wall and is **not** routed
  through `dciFetch` yet — it needs its own bypass (stealth browser or the
  scraping API's JS-scenario paging).

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
