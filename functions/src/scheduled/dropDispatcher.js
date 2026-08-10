/**
 * Timezone-aware score-drop dispatcher (gated cron slots).
 *
 * Replaces the fixed 1:30 AM scrape / 2:00 AM scorers with per-night timing
 * from helpers/dropPlanner.js: fantasy scores drop when the furthest-west
 * show of the day would have posted (Eastern 11 PM ET ... Pacific 2 AM ET,
 * Indianapolis finals week midnight ET), and off-season scores drop 9 PM ET.
 *
 * HOW THE ONCE-PER-NIGHT SCRAPE IS PRESERVED: a gate tick runs every 15
 * minutes across the drop window (8 PM–2:45 AM ET). Each tick reads the plan
 * from Firestore-backed data only — season doc, schedules doc, tonight's
 * drop_plans doc — and exits unless the scrape or drop instant has arrived.
 * Ticks that aren't tonight's slot never touch dci.org, so scraper-API
 * credits stay at one scrape pass per night. Scoring never runs on the same
 * tick as a fresh scrape unless it is the night's last tick: the scrape
 * publishes recap rows via Pub/Sub and the archive consumer needs time to
 * land them (recap-settle defer inside runDropDispatcherTick).
 *
 * WAITING FOR DCI: fantasy scores are only as good as the recap they derive
 * from, so the night holds the drop until dci.org has actually posted. Two
 * budgets bound that wait by what an attempt costs, because the cheap failure
 * is the common one:
 *   - MAX_LISTING_PROBES  attempts that fetched only dci.org/scores and found
 *                         tonight absent — one request. DCI running an hour
 *                         late is exactly this, so the budget spans the window.
 *   - MAX_SCRAPE_ATTEMPTS attempts that fetched tonight's recap pages and
 *                         still failed (Cloudflare, markup change) — one
 *                         request per event, and retrying rarely helps.
 * A day with no scheduled shows before championship week gets one of each
 * (see scrapeBudgetFor/probeBudgetFor).
 *
 * DCI posts a night's recaps one event at a time, so a night that archived
 * fewer recaps than the schedule's SCRAPED shows owe (player-hosted events
 * excluded — they never appear on dci.org) keeps re-checking until the legacy
 * 2 AM ET scoring hour, takes one last scrape on that tick, and scores on the
 * next. Re-checks cost a single listing fetch: already-archived recaps are
 * passed back to the scraper as a skip list, so only genuinely new events are
 * fetched. Either budget running dry — or the planner's 2:45 AM clamp —
 * releases scoring on regression fallback, stamped usedRegressionFallback for
 * the watchdog. A normal night still scrapes exactly once.
 *
 * KILL SWITCH: game-settings/features.dropScheduling. OFF (default) = shadow
 * mode — every tick computes and persists tonight's plan to drop_plans/{date}
 * (audit trail + client countdown) but takes no action; the legacy 1:30/2:00
 * jobs keep running. ON = this dispatcher acts and the legacy jobs stand
 * down (they check the same flag). Both paths share the same
 * {seasonUid}_day{N} scoring lease, so even a mid-flip overlap cannot
 * double-score a day.
 *
 * OFF-SEASON IS EXEMPT from the kill switch. It has no dci.org scrape and no
 * timezone ladder — the only things the flag guards — so the dispatcher scores
 * off-season nights at 9 PM ET regardless of the flag. Leaving them gated made
 * shadow mode publish a 9 PM plan the client counted down to (and showed
 * "scores processing" past) while the legacy 2 AM job did the actual scoring:
 * the drop was announced at 9 PM and nothing landed until 2 AM. The legacy 2 AM
 * off-season job still runs as an idempotent fallback (the shared lease makes it
 * a no-op once the 9 PM run has scored the day).
 *
 * DAY SELECTION: always the planner's day (3-hour show-day reset), passed
 * explicitly into the scorers. Never gameDay.js's 2 AM reset — at 11 PM ET
 * that derivation is one day behind (see dropDispatcher.test.js).
 *
 * Podium Class moves to its own 9 PM ET job (podiumNightly below), year-round,
 * independent of the fantasy ladder.
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { FieldValue } = require("firebase-admin/firestore");
const { getDb } = require("../config");
const { planDrop, showCalendarDay, CHAMPIONSHIP_WEEK_START_DAY } = require("../helpers/dropPlanner");
const { isDropSchedulingEnabled } = require("../helpers/features");
const {
  discordScoresWebhookUrl,
  discordAnnouncementsWebhookUrl,
  discordNewsWebhookUrl,
} = require("../helpers/discord");
const { scraperApiKey } = require("../helpers/dciFetch");

// Failure-only retry bound for EXPENSIVE attempts — ones that actually fetched
// tonight's recap pages (one request per event). A night may spend at most this
// many before scoring proceeds on regression fallback. Keeps a dci.org outage
// from burning a full multi-recap pass on every tick.
const MAX_SCRAPE_ATTEMPTS = 3;

// Bound for CHEAP attempts: a fetch of dci.org/scores that produced no new
// recap to pull (`fetchedRecaps: false`) — tonight isn't listed yet, or every
// listed event is already archived and the rest simply aren't up. These are
// the "DCI hasn't posted yet" case, and charging them against the expensive
// budget above is what used to end the night's retries ~30 minutes after the
// first probe — hours before the night was meant to give up — and drop
// regression scores while the real recaps were still minutes away. One listing
// fetch is cheap enough to keep asking for the whole window: 16 covers the
// earliest scrape instant (10:45 PM ET) through the 2:45 AM clamp at the
// 15-minute tick cadence, so in practice the clamp is what bounds the night
// and this is a runaway guard.
const MAX_LISTING_PROBES = 16;

// The dispatcher's cron cadence. Used to decide whether ANOTHER tick will run
// before the night's window closes — a same-tick scrape+score is only taken
// when this is the last chance (see the recap-settle logic in the tick).
const TICK_INTERVAL_MIN = 15;

// A successful scrape publishes recap rows to Pub/Sub; a SEPARATE triggered
// function (triggers/scoreProcessing.js processLiveScoreRecap) archives them
// into historical_scores, which is what scoring reads. Scoring immediately
// after an in-tick scrape would race that consumer and silently fall back to
// regression for exactly the shows just scraped. Normally the fix is free —
// defer scoring to the next tick, 15 minutes of settle — but on the night's
// LAST tick there is no next tick, so wait this long instead.
const SCRAPE_SETTLE_MS = 60 * 1000;

/**
 * The night's scrape-attempt budget. A day with no scheduled shows before
 * championship week is either a genuine dark day (dci.org lists nothing —
 * every attempt is a wasted credit) or a stale schedules doc; one attempt
 * distinguishes the two, since real listed events make the first attempt
 * succeed. Championship week (>= day 45) has real events that are simply
 * never carried in competitions[], so it keeps the full budget.
 * @param {object} plan - From planDrop() (non-null).
 * @returns {number}
 */
function scrapeBudgetFor(plan) {
  return isDarkDay(plan) ? 1 : MAX_SCRAPE_ATTEMPTS;
}

/**
 * True for a day with nothing scheduled before championship week — either a
 * genuine dark day or a stale schedules doc. Scoring such a day without fresh
 * data is by design, not a fallback.
 * @param {object} plan - From planDrop() (non-null).
 * @returns {boolean}
 */
function isDarkDay(plan) {
  return plan.hasScheduledShows === false && plan.competitionDay < CHAMPIONSHIP_WEEK_START_DAY;
}

/**
 * The night's cheap-probe budget. A dark day gets one, same reasoning as
 * scrapeBudgetFor: dci.org genuinely lists nothing, so re-asking is pure waste.
 * @param {object} plan - From planDrop() (non-null).
 * @returns {number}
 */
function probeBudgetFor(plan) {
  return isDarkDay(plan) ? 1 : MAX_LISTING_PROBES;
}

/**
 * How many DCI recaps tonight owes before its scores are fully real: the
 * scraped shows on the schedule, or the number dci.org actually lists for the
 * night if that is higher (a show added after the last schedule refresh).
 * @param {object} plan - From planDrop() (non-null).
 * @param {number|null} [listedEventCount] - Events dci.org listed for tonight.
 * @returns {number}
 */
function recapsOwedBy(plan, listedEventCount = null) {
  return Math.max(plan.expectedShowCount || 0, listedEventCount || 0);
}

/**
 * The instant the night stops waiting for stragglers: the legacy 2 AM ET
 * scoring run plus one tick, so the 2 AM tick itself gets a final scrape and
 * the tick after it scores with whatever arrived. Clamped by the planner's
 * 2:45 AM stop so nothing crosses the show-day boundary.
 * @param {object} plan - From planDrop() (non-null).
 * @returns {number} Epoch millis.
 */
function completenessDeadline(plan) {
  const legacy = plan.legacyScoringInstant
    ? plan.legacyScoringInstant.getTime()
    : plan.scrapeRetryUntil.getTime();
  return Math.min(legacy + TICK_INTERVAL_MIN * 60 * 1000, plan.scrapeRetryUntil.getTime());
}

/**
 * True while the night is still owed recaps DCI hasn't posted yet — fewer
 * events archived than the schedule (or dci.org's own listing) says the night
 * has — and the wait hasn't reached the legacy 2 AM handoff.
 *
 * Counting ARCHIVED events rather than listed ones covers both ways a night
 * comes up short: DCI posting its events one at a time, and a listed recap
 * that failed to scrape. Requires at least one completed scrape — before that
 * there is nothing to compare and the normal `!scrapedTonight` gating drives
 * the retries.
 *
 * @param {object} params
 * @param {object} params.plan - From planDrop() (non-null).
 * @param {Date} params.now
 * @param {number|null} [params.archivedCount] - Recaps successfully scraped for
 *   tonight so far (accumulated on the plan doc).
 * @param {number|null} [params.listedEventCount] - Events dci.org listed for
 *   tonight on the last scrape.
 * @returns {boolean}
 */
function awaitingMoreEvents({ plan, now, archivedCount = null, listedEventCount = null }) {
  if (!plan.needsScrape) return false;
  if (archivedCount == null) return false;
  const owed = recapsOwedBy(plan, listedEventCount);
  if (owed === 0 || archivedCount >= owed) return false;
  return now.getTime() < completenessDeadline(plan);
}

/**
 * Pure decision core: which actions are due on this tick. No IO — testable.
 *
 * Scoring on a live night waits for tonight's data: a scrape that stamped the
 * night (every recap it pulled produced rows) and, until the legacy 2 AM
 * handoff, as many archived recaps as the night owes. It proceeds anyway when
 * the day has no scheduled shows (dark-day settlement owes pools/payouts),
 * when dci.org requests are exhausted, or at the planner's late clamp — the
 * strategy falls back to regression and the watchdog reports the scrape, so a
 * bad scrape night degrades exactly like the legacy 2 AM pipeline instead of
 * orphaning the day.
 *
 * @param {object} params
 * @param {object} params.plan - From planDrop() (non-null).
 * @param {Date} params.now
 * @param {boolean} params.scrapedTonight - lastScrapedDate === plan.showDateET.
 * @param {number} [params.scrapeAttempts] - Expensive attempts (recap pages
 *   fetched) recorded on tonight's plan doc.
 * @param {number} [params.scrapeProbes] - Cheap attempts (listing fetch only,
 *   tonight not posted yet) recorded on tonight's plan doc.
 * @param {boolean} [params.alreadyScored] - Tonight's plan doc carries scoredAt:
 *   the day is done, so post-drop ticks skip the scoring path (its lease would
 *   no-op anyway) instead of re-entering it every 15 minutes until 2:45 AM.
 * @param {number|null} [params.archivedCount] - Recaps successfully scraped for
 *   tonight so far; drives the half-posted-night check.
 * @param {number|null} [params.listedEventCount] - Events dci.org listed for
 *   tonight on the last scrape.
 * @returns {{scrapeDue: boolean, scoreDue: boolean, awaitingEvents: boolean}}
 */
function dueActions({
  plan,
  now,
  scrapedTonight,
  scrapeAttempts = 0,
  scrapeProbes = 0,
  alreadyScored = false,
  archivedCount = null,
  listedEventCount = null,
}) {
  const t = now.getTime();
  // Either budget running dry ends the night's dci.org requests: a spent recap
  // budget means the expensive path keeps failing and retrying won't fix it; a
  // spent probe budget means tonight never showed up on the listing at all.
  const canRequest =
    scrapeAttempts < scrapeBudgetFor(plan) && scrapeProbes < probeBudgetFor(plan);

  const awaitingEvents = awaitingMoreEvents({ plan, now, archivedCount, listedEventCount });

  const scrapeDue =
    plan.needsScrape &&
    // A stamped night still re-scrapes while events are missing — that is how
    // the recaps DCI posts after the first ones get picked up.
    (!scrapedTonight || awaitingEvents) &&
    canRequest &&
    t >= plan.scrapeInstant.getTime() &&
    t <= plan.scrapeRetryUntil.getTime();

  const scrapeSettled =
    !plan.needsScrape ||
    (scrapedTonight && !awaitingEvents) ||
    !plan.hasScheduledShows ||
    !canRequest ||
    t >= plan.scrapeRetryUntil.getTime();

  const scoreDue = !alreadyScored && t >= plan.dropInstant.getTime() && scrapeSettled;
  return { scrapeDue, scoreDue, awaitingEvents };
}

/**
 * Deterministic serialization of the persisted plan fields. Stored on the
 * plan doc so an unchanged plan is not rewritten on all ~28 gate ticks a
 * night — the plan only changes when the schedule/season data feeding the
 * planner changes (or the kill switch flips), so most ticks skip the write.
 * Dates serialize to ISO strings, keeping the comparison stable.
 * @param {object} plan
 * @param {"shadow"|"active"} mode
 * @returns {string}
 */
function planSignatureOf(plan, mode) {
  return JSON.stringify({
    showDateET: plan.showDateET,
    seasonType: plan.seasonType,
    competitionDay: plan.competitionDay,
    timeZones: plan.timeZones,
    scoresAt: plan.scoresAt,
    dropInstant: plan.dropInstant,
    plannedDropInstant: plan.plannedDropInstant,
    scrapeInstant: plan.scrapeInstant,
    scrapeRetryUntil: plan.scrapeRetryUntil,
    dropLabel: plan.dropLabel,
    needsScrape: plan.needsScrape,
    hasScheduledShows: plan.hasScheduledShows,
    expectedShowCount: plan.expectedShowCount,
    tzMismatches: plan.tzMismatches,
    ignoredScoresAt: plan.ignoredScoresAt,
    mode,
  });
}

/**
 * Persist tonight's plan to drop_plans/{showDateET} (merge). Public,
 * backend-written: the audit trail for "why did scores drop at 1 AM?", and
 * the client's real countdown target. Best-effort — a status write must
 * never fail the pipeline. Skipped when the doc already carries an
 * identical plan (see planSignatureOf).
 * @param {FirebaseFirestore.Firestore} db
 * @param {object} plan
 * @param {"shadow"|"active"} mode
 * @param {string|undefined} existingSignature - planSignature already on the doc.
 */
async function persistPlan(db, plan, mode, existingSignature) {
  const planSignature = planSignatureOf(plan, mode);
  if (existingSignature === planSignature) return;
  try {
    await db.collection("drop_plans").doc(plan.showDateET).set({
      planSignature,
      showDateET: plan.showDateET,
      seasonType: plan.seasonType,
      competitionDay: plan.competitionDay,
      timeZones: plan.timeZones,
      scoresAt: plan.scoresAt,
      dropInstant: plan.dropInstant,
      plannedDropInstant: plan.plannedDropInstant,
      scrapeInstant: plan.scrapeInstant,
      scrapeRetryUntil: plan.scrapeRetryUntil,
      dropLabel: plan.dropLabel,
      needsScrape: plan.needsScrape,
      hasScheduledShows: plan.hasScheduledShows,
      expectedShowCount: plan.expectedShowCount,
      tzMismatches: plan.tzMismatches,
      ignoredScoresAt: plan.ignoredScoresAt,
      mode,
      updatedAt: new Date(),
    }, { merge: true });
  } catch (error) {
    logger.error(`[drop-dispatcher] failed to persist plan ${plan.showDateET}: ${error.message}`);
  }
}

/**
 * One gate tick: plan, persist, and act if an instant has arrived.
 * Extracted from the schedule wrapper so tests can drive it with fakes.
 * @param {FirebaseFirestore.Firestore} db
 * @param {object} [options]
 * @param {Date} [options.now]
 * @param {number} [options.settleMs] - Recap-settle wait for a last-tick
 *   scrape+score (see SCRAPE_SETTLE_MS); tests pass 0.
 * @param {object} [options.deps] - Injectable action implementations for
 *   tests; production defaults lazy-require the real ones.
 * @returns {Promise<{status: string, [k: string]: unknown}>}
 */
async function runDropDispatcherTick(db, { now = new Date(), settleMs = SCRAPE_SETTLE_MS, deps = {} } = {}) {
  const {
    scrape = (args) => require("./liveScraper").scrapeLatestLiveScores(args),
    scoreOffSeason = (args) =>
      require("../helpers/scoring").processAndArchiveOffSeasonScoresLogic(args),
    scoreLive = (day, seasonData) =>
      require("../helpers/scoring").processAndScoreLiveSeasonDayLogic(day, seasonData),
    discord = (dbArg, opts) =>
      require("./nightlyStages").runDiscordStage(dbArg, discordScoresWebhookUrl.value(), undefined, opts),
    eastern = (dbArg, opts) =>
      require("./nightlyStages").runEasternClassicStage(
        dbArg, discordAnnouncementsWebhookUrl.value(), undefined, opts),
  } = deps;
  const seasonDoc = await db.doc("game-settings/season").get();
  if (!seasonDoc.exists) return { status: "no-season" };
  const seasonData = seasonDoc.data();

  // Live plans need the schedule's per-show locations/announced times.
  let competitions = [];
  if (seasonData.status === "live-season" && seasonData.seasonUid) {
    const scheduleDoc = await db.doc(`schedules/${seasonData.seasonUid}`).get();
    competitions = scheduleDoc.exists ? (scheduleDoc.data().competitions || []) : [];
  }

  const plan = planDrop({ seasonData, competitions, now });
  if (!plan) return { status: "no-plan" };

  const enabled = await isDropSchedulingEnabled(db);
  // The kill switch gates the RISKY half of this pipeline — the live-season
  // dci.org scrape and its timezone ladder. Off-season drops carry none of
  // that: they are synthetic (needsScrape=false, no network) and land at a
  // flat 9 PM ET. So the dispatcher owns off-season nights UNCONDITIONALLY,
  // even in shadow mode. Otherwise shadow mode publishes tonight's 9 PM plan —
  // which the client counts down to and shows "scores processing" past — while
  // the legacy 2 AM job is what actually scores, so players see the 9 PM drop
  // announced and then nothing lands until 2 AM. The shared {seasonUid}_day{N}
  // scoring lease keeps the still-running legacy 2 AM off-season job a safe
  // idempotent fallback: it finds the day already scored and skips.
  const actsTonight = enabled || plan.seasonType === "off-season";
  // One read of tonight's plan doc serves both the persist dedup check and
  // the scrape-attempt bookkeeping below (persistPlan's merge never touches
  // scrapeAttempts, so reading before the write is equivalent).
  const planDocSnap = await db.collection("drop_plans").doc(plan.showDateET).get();
  const planDocData = planDocSnap.exists ? planDocSnap.data() : {};
  await persistPlan(db, plan, actsTonight ? "active" : "shadow", planDocData.planSignature);

  // Surface data problems the planner detected (stale schedule silently
  // degrading to the 2 AM worst case; gazetteer-vs-enrichment disagreement).
  if (plan.seasonType === "live-season" && !plan.hasScheduledShows && plan.competitionDay <= 44) {
    logger.warn(
      `[drop-dispatcher] no scheduled shows for competition day ${plan.competitionDay} ` +
      `(${plan.showDateET}) — stale schedules doc, or a genuine dark day.`
    );
  }
  for (const m of plan.tzMismatches) {
    logger.warn(
      `[drop-dispatcher] timezone mismatch for "${m.location}": ` +
      `gazetteer ${m.gazetteer} vs enriched ${m.enriched}`
    );
  }

  if (!actsTonight) {
    return { status: "shadow", showDateET: plan.showDateET, dropLabel: plan.dropLabel };
  }

  // Tonight's dispatcher state: scrape success comes from the season doc's
  // lastScrapedDate stamp (written only on a scrape that produced rows);
  // the attempt count and the scored marker live on the plan doc (read above).
  const alreadyScored = Boolean(planDocData.scoredAt);
  let scrapeAttempts = planDocData.scrapeAttempts || 0;
  let scrapeProbes = planDocData.scrapeProbes || 0;
  let listedEventCount =
    typeof planDocData.listedEventCount === "number" ? planDocData.listedEventCount : null;
  // Recaps already archived tonight. Doubles as the skip list handed to the
  // scraper (so a re-check costs one listing fetch) and as the completeness
  // count — null until the night's first scrape completes.
  let scrapedRecapUrls = Array.isArray(planDocData.scrapedRecapUrls)
    ? planDocData.scrapedRecapUrls
    : null;
  let scrapedTonight = seasonData.lastScrapedDate === plan.showDateET;

  let { scrapeDue, scoreDue, awaitingEvents } = dueActions({
    plan, now, scrapedTonight, scrapeAttempts, scrapeProbes, alreadyScored,
    archivedCount: scrapedRecapUrls ? scrapedRecapUrls.length : null,
    listedEventCount,
  });
  const result = { status: "ticked", showDateET: plan.showDateET, actions: [] };

  let freshScrapeThisTick = false;
  if (scrapeDue) {
    // Count the attempt BEFORE the scrape — the budget bounds dci.org
    // requests, not successes, and a scrape that hangs until the function
    // times out would otherwise never be counted (unbounded nightly retries).
    // Guarded so a Firestore blip on this bookkeeping write cannot abort the
    // tick before the scoring branch below.
    try {
      await db.collection("drop_plans").doc(plan.showDateET).set(
        { scrapeAttempts: FieldValue.increment(1), lastScrapeAttemptAt: new Date() },
        { merge: true },
      );
    } catch (error) {
      logger.error(`[drop-dispatcher] failed to record the scrape attempt: ${error.message}`);
    }
    scrapeAttempts += 1;
    try {
      const scraped = await scrape({
        dateKey: plan.showDateET,
        skipRecapUrls: scrapedRecapUrls || [],
      });
      scrapedTonight = scraped?.stampedLastScrapedDate === true;
      freshScrapeThisTick = scrapedTonight;
      if (typeof scraped?.listedEventCount === "number") {
        listedEventCount = scraped.listedEventCount;
      }
      if (Array.isArray(scraped?.scrapedRecapUrls)) {
        scrapedRecapUrls = [...new Set([...(scrapedRecapUrls || []), ...scraped.scrapedRecapUrls])];
      }

      // Reclassify a cheap attempt. The optimistic pre-scrape increment above
      // has to assume the expensive path (a scrape that hangs until the
      // function times out must stay charged, or a wedged dci.org earns
      // unlimited nightly retries) — but an attempt that came back without
      // ever opening a recap page cost one listing fetch, and charging it
      // against the recap budget is what would end the night's retries long
      // before DCI got around to posting. Move it to the probe counter with an
      // absolute write, since both values are known here.
      const bookkeeping = {};
      if (scraped && scraped.fetchedRecaps === false) {
        scrapeAttempts -= 1;
        scrapeProbes += 1;
        bookkeeping.scrapeAttempts = scrapeAttempts;
        bookkeeping.scrapeProbes = scrapeProbes;
      }
      if (listedEventCount != null) bookkeeping.listedEventCount = listedEventCount;
      if (scrapedRecapUrls != null) bookkeeping.scrapedRecapUrls = scrapedRecapUrls;
      if (Object.keys(bookkeeping).length > 0) {
        try {
          await db.collection("drop_plans").doc(plan.showDateET)
            .set(bookkeeping, { merge: true });
        } catch (error) {
          logger.error(`[drop-dispatcher] failed to record scrape bookkeeping: ${error.message}`);
        }
      }
      result.actions.push({
        action: "scrape",
        scraped: scraped?.scraped,
        stamped: scrapedTonight,
        reason: scraped?.reason,
        probe: scraped?.fetchedRecaps === false,
      });
    } catch (error) {
      logger.error(`[drop-dispatcher] scrape failed (will retry within budget): ${error.message}`);
      result.actions.push({ action: "scrape", error: error.message });
    }
    // A scrape that just succeeded may unlock scoring on this same tick
    // (slipped nights where scrape and drop coincide).
    ({ scoreDue, awaitingEvents } = dueActions({
      plan, now, scrapedTonight, scrapeAttempts, scrapeProbes, alreadyScored,
      archivedCount: scrapedRecapUrls ? scrapedRecapUrls.length : null,
      listedEventCount,
    }));
  }

  if (awaitingEvents) {
    logger.info(
      `[drop-dispatcher] ${plan.showDateET}: ${scrapedRecapUrls.length}/` +
      `${recapsOwedBy(plan, listedEventCount)} recap(s) archived; holding the drop until ` +
      "the 2 AM ET handoff for the rest."
    );
  }

  // A scrape only PUBLISHES recap rows; processLiveScoreRecap archives them
  // into historical_scores, which scoring reads. Scoring immediately after an
  // in-tick scrape would race that consumer and regression-fall-back on
  // exactly the shows just scraped. Defer to the next tick (15 minutes of
  // settle) whenever one exists before the window closes; on the night's
  // last tick, wait a bounded settle instead — never orphan the night.
  if (scoreDue && freshScrapeThisTick) {
    const nextTickMs = now.getTime() + TICK_INTERVAL_MIN * 60 * 1000;
    if (nextTickMs <= plan.scrapeRetryUntil.getTime()) {
      result.actions.push({ action: "score", deferred: "recap-settle" });
      scoreDue = false;
    } else if (settleMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, settleMs));
    }
  }

  if (scoreDue) {
    // seasonData here is the tick-start read; scoring derives everything it
    // needs from the day number and historical data, not lastScrapedDate.
    let score;
    if (plan.seasonType === "off-season") {
      score = await scoreOffSeason({ scoredDay: plan.competitionDay });
    } else {
      score = await scoreLive(plan.competitionDay, seasonData);
    }
    result.actions.push({ action: "score", ...score });

    // Stamp the plan doc only when the day is actually done — a fresh run
    // that processed, or a lease that says some run already completed it
    // (e.g. the legacy 2 AM job before a mid-night flag flip). A skipped
    // "in-progress" claim stays unstamped so later ticks re-check the lease.
    const dayDone =
      score?.status === "processed" ||
      (score?.status === "skipped" && score?.reason === "completed");
    if (dayDone) {
      // Audit trail: a night scored without all of tonight's recaps (budget
      // exhausted, retry window elapsed, or the 2 AM handoff reached on a
      // half-posted night) fell back to regression for the shows it never got.
      // A dark day (nothing scheduled, pre-championship) is excluded — scoring
      // without fresh data is by design there, not a fallback.
      const owed = recapsOwedBy(plan, listedEventCount);
      const archived = scrapedRecapUrls ? scrapedRecapUrls.length : 0;
      const usedRegressionFallback =
        plan.needsScrape && (!scrapedTonight || archived < owed) && !isDarkDay(plan);
      await db.collection("drop_plans").doc(plan.showDateET).set(
        {
          scoredAt: new Date(),
          ...(usedRegressionFallback
            ? { usedRegressionFallback: true, recapsArchived: archived, recapsOwed: owed }
            : {}),
        },
        { merge: true },
      );

      // Discord score-drop post, at the drop it announces. Isolated (its own
      // per-day lease posts at most once) — a Discord failure never blocks
      // the fantasy pipeline, and (like the legacy 2 AM job) is not retried
      // within the night.
      try {
        const discordResult = await discord(db, { scoredDay: plan.competitionDay });
        if (discordResult.status !== "disabled") {
          logger.info(`[drop-dispatcher] discord-stage result: ${JSON.stringify(discordResult)}`);
        }
      } catch (error) {
        logger.error(`[drop-dispatcher] discord stage failed (scoring unaffected): ${error.message}`);
      }

      // The Eastern Classic night lineups (#announcements), off the preview
      // the day-38 run just published — so the split reaches the server in the
      // same moment as the scores that seeded it. Isolated and lease-guarded
      // like the drop above; every other night this is a no-op.
      try {
        const easternResult = await eastern(db, { competitionDay: plan.competitionDay });
        if (easternResult.announcement && easternResult.announcement.status === "posted") {
          logger.info(`[drop-dispatcher] eastern-classic result: ${JSON.stringify(easternResult)}`);
        }
      } catch (error) {
        logger.error(`[drop-dispatcher] eastern stage failed (scoring unaffected): ${error.message}`);
      }
    }
  }

  return result;
}

// Gate ticks every 15 minutes across the full drop window: 8 PM ET (plan is
// persisted early for the client countdown; off-season drop is 9 PM) through
// 2:45 AM ET (the planner's late clamp — the final tick both retries a failed
// scrape and force-scores the day so a night is never orphaned).
exports.scoreDropDispatcher = onSchedule({
  schedule: "*/15 20-23,0-2 * * *",
  timeZone: "America/New_York",
  // Scoring alone fits 540s (the legacy budget), and the recap-settle defer
  // keeps scrape and score on separate ticks every night but the LAST one.
  // 540 is the platform maximum for scheduled functions; if that final shared
  // tick ever times out, the watchdog's unscored-night check catches it at
  // 4:30 (scoringWatchdog.js findUnscoredNightProblem).
  timeoutSeconds: 540,
  memory: "512MiB",
  // No scheduler retries: the 15-minute cadence IS the retry loop, and the
  // scoring lease makes re-entry safe.
  retryCount: 0,
  // The score drop rides this job (#scores), and so does the Eastern Classic
  // lineup post (#announcements) — it announces the preview the day-38 scoring
  // run publishes here, so it needs that webhook too.
  secrets: [scraperApiKey, discordScoresWebhookUrl, discordAnnouncementsWebhookUrl],
}, async () => {
  const db = getDb();
  const result = await runDropDispatcherTick(db);
  // Quiet gate ticks (nothing due yet) don't log; acted ticks do.
  if (Array.isArray(result.actions) && result.actions.length > 0) {
    logger.info(`[drop-dispatcher] ${JSON.stringify(result)}`);
  }
});

/**
 * Podium Class nightly processing at 9 PM ET, year-round (DST-tracking via
 * the schedule's timeZone), for the SHOW DATE's calendar day (at 9 PM the
 * 2 AM-reset derivation is one day behind).
 *
 * Podium is INDEPENDENT of the fantasy ladder and its dropScheduling kill
 * switch — it always processes and publishes here at 9 PM, whether or not the
 * fantasy dispatcher is active. (The switch only ever gated the risky
 * live-season scrape; Podium has no scrape.) The legacy 2 AM processors no
 * longer touch Podium at all, so this is its sole processing path; its own
 * per-(season, day) lease still makes scheduler/manual reruns no-ops.
 *
 * Only gated by features.podiumClass, checked inside runPodiumStage below.
 */
exports.podiumNightly = onSchedule({
  schedule: "0 21 * * *",
  timeZone: "America/New_York",
  timeoutSeconds: 540,
  memory: "512MiB",
  // Errors are swallowed below (isolation contract), so scheduler retries
  // would never fire; the podium stage's own leases self-heal next night.
  retryCount: 0,
  // Three announcements ride this job, all off the state the Podium stage
  // writes: the Podium score drop (#scores), the Fan Favorite ballots
  // (#announcements) and the weekly Podium Report (#news).
  secrets: [discordScoresWebhookUrl, discordAnnouncementsWebhookUrl, discordNewsWebhookUrl],
}, async () => {
  const db = getDb();

  const seasonDoc = await db.doc("game-settings/season").get();
  if (!seasonDoc.exists) return;
  const seasonData = seasonDoc.data();
  const startRaw = seasonData?.schedule?.startDate;
  const startDate = startRaw && typeof startRaw.toDate === "function" ? startRaw.toDate() : startRaw;
  if (!(startDate instanceof Date) || isNaN(startDate.getTime())) return;

  // Tonight's calendar day from the show-date reset (at 9 PM ET this is
  // simply "today" in Eastern). runPodiumStage's own range checks handle
  // before-season / season-over; spring training is a valid Podium day.
  const calendarDay = showCalendarDay(startDate);

  let competitionDay = null;
  try {
    const { runPodiumStage } = require("./nightlyStages");
    const result = await runPodiumStage(db, { calendarDay });
    if (result.status !== "disabled") {
      logger.info(`[podium-nightly] result: ${JSON.stringify(result)}`);
    }
    if (typeof result.competitionDay === "number") competitionDay = result.competitionDay;
  } catch (error) {
    // Same isolation contract as the legacy callers: a Podium failure is
    // logged and swallowed, never propagated into scheduler retries of the
    // fantasy pipeline (which no longer shares this job anyway).
    logger.error(`[podium-nightly] failed: ${error.message}`);
  }

  // Tonight's Podium results (#scores channel) — the Podium half of the score
  // drop, its own message beside the fantasy one, off the recap the stage
  // above just wrote. Isolated the same way, and lease-guarded per (season,
  // day) so a re-run posts nothing twice.
  try {
    const { runPodiumScoreDropStage } = require("./nightlyStages");
    const result = await runPodiumScoreDropStage(db, discordScoresWebhookUrl.value(), undefined, {
      competitionDay,
    });
    if (result.status === "ran" && result.announcement?.status === "posted") {
      logger.info(`[podium-drop] result: ${JSON.stringify(result)}`);
    }
  } catch (error) {
    logger.error(`[podium-drop] stage failed (Podium unaffected): ${error.message}`);
  }

  // Fan Favorite ballot announcements (#announcements channel), off the state
  // the stage above just wrote. Isolated the same way, and lease-guarded per
  // (season, event) so it posts each announcement exactly once.
  try {
    const { runFanFavoriteStage } = require("./nightlyStages");
    const result = await runFanFavoriteStage(
      db,
      discordAnnouncementsWebhookUrl.value(),
      undefined,
      { competitionDay }
    );
    if (result.status === "ran" && Array.isArray(result.announcements) && result.announcements.length > 0) {
      logger.info(`[fan-favorite] result: ${JSON.stringify(result)}`);
    }
  } catch (error) {
    logger.error(`[fan-favorite] stage failed (Podium unaffected): ${error.message}`);
  }

  // The weekly Podium Report column (#news), same isolation and its own
  // per-week lease.
  try {
    const { runPodiumReportStage } = require("./nightlyStages");
    const result = await runPodiumReportStage(db, discordNewsWebhookUrl.value(), undefined, {
      competitionDay,
    });
    if (result.status === "ran" && result.announcement?.status === "posted") {
      logger.info(`[podium-report] result: ${JSON.stringify(result)}`);
    }
  } catch (error) {
    logger.error(`[podium-report] stage failed (Podium unaffected): ${error.message}`);
  }
});

module.exports.dueActions = dueActions;
module.exports.scrapeBudgetFor = scrapeBudgetFor;
module.exports.probeBudgetFor = probeBudgetFor;
module.exports.awaitingMoreEvents = awaitingMoreEvents;
module.exports.recapsOwedBy = recapsOwedBy;
module.exports.completenessDeadline = completenessDeadline;
module.exports.runDropDispatcherTick = runDropDispatcherTick;
module.exports.MAX_SCRAPE_ATTEMPTS = MAX_SCRAPE_ATTEMPTS;
module.exports.MAX_LISTING_PROBES = MAX_LISTING_PROBES;
module.exports.TICK_INTERVAL_MIN = TICK_INTERVAL_MIN;
module.exports.SCRAPE_SETTLE_MS = SCRAPE_SETTLE_MS;
