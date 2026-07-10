/**
 * Nightly Podium processor (Phase 2.4, PODIUM_CLASS_DESIGN.md §5.4-§5.5).
 *
 * For the completed game day, for every rostered Podium corps:
 *   1. apply end-of-day condition/decay via the engine (using the day's
 *      block usage — from pendingEndOfDay if the player's client already
 *      rolled the day, from `today` otherwise, or an unplayed-day default),
 *   2. score corps whose day was a show day (majors, assigned Eastern
 *      night, championships, self-selected days) against the calibrated
 *      envelope with the reputation-tier ceiling,
 *   3. write the per-day recap doc (podium-recaps/{seasonUid}/days/{day}) —
 *      kept separate from fantasy_recaps for total pipeline isolation in v1;
 *      the Phase 6 Scores-tab work decides on consolidation,
 *   4. rank the class by latest total (DCI-style current score) and write
 *      display copies (rank/score) to podium/state and profile.
 *
 * Runs under its own scoringRunGuard lease (`{seasonUid}_podium` + day) so
 * Podium idempotency never contends with the fantasy lease.
 */

const { logger } = require("firebase-functions/v2");
const { claimScoringRun, markScoringRunCompleted, markScoringRunFailed } = require("../scoringRunGuard");
const engine = require("./engine");
const store = require("./store");
const venues = require("./venues");

/**
 * Venue for a corps' show on `competitionDay`: the branded majors have fixed
 * sites; self-selected days use the scheduled show's location (first show of
 * the day). `scheduleShows` is a day -> location map preloaded once per run.
 */
function showVenueFor(competitionDay, scheduleLocations) {
  if (venues.MAJOR_VENUES[competitionDay]) return venues.MAJOR_VENUES[competitionDay];
  const location = scheduleLocations[competitionDay];
  return location ? venues.venueFor(location) : null;
}

/** Preload {competitionDay -> location} from the season's schedule doc. */
async function loadScheduleLocations(db, seasonData) {
  const scheduleId = seasonData.dataDocId || seasonData.name;
  if (!scheduleId) return {};
  const doc = await db.doc(`schedules/${scheduleId}`).get();
  if (!doc.exists) return {};
  const locations = {};
  for (const comp of doc.data().competitions || []) {
    if (comp.day != null && comp.location && locations[comp.day] == null) {
      locations[comp.day] = comp.location;
    }
  }
  return locations;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {object} seasonData game-settings/season data
 * @param {{calendarDay: number, competitionDay: number}} dayContext completed day
 * @returns {Promise<object>} summary
 */
async function processPodiumDay(db, seasonData, { calendarDay, competitionDay }) {
  const seasonUid = seasonData.seasonUid;
  const leaseKey = `${seasonUid}_podium`;

  const claim = await claimScoringRun(db, leaseKey, calendarDay);
  if (!claim.claimed) {
    return { status: "skipped", reason: claim.reason, calendarDay };
  }

  try {
    const roster = await store.rosterCollection(db, seasonUid).get();
    if (roster.empty) {
      await markScoringRunCompleted(db, leaseKey, calendarDay, { corps: 0 });
      return { status: "completed", corps: 0, scored: 0, calendarDay, competitionDay };
    }

    const scheduleLocations = await loadScheduleLocations(db, seasonData);
    const results = [];
    let processed = 0;

    for (const rosterDoc of roster.docs) {
      const uid = rosterDoc.id;
      const sRef = store.stateRef(db, uid);
      const snapshot = await sRef.get();
      if (!snapshot.exists || snapshot.data().seasonUid !== seasonUid) continue;

      const state = store.hydrateState(snapshot.data());

      // --- 1. End of day: block usage for the completed calendar day -------
      let dayInfo = { blocksUsed: 0, blocks: [], restDay: false, warmupUsed: false };
      if (state.pendingEndOfDay && state.pendingEndOfDay.calendarDay === calendarDay) {
        dayInfo = state.pendingEndOfDay;
        delete state.pendingEndOfDay;
      } else if (state.today && state.today.calendarDay === calendarDay) {
        dayInfo = state.today;
      }
      const isShowDay = store.isShowDayFor(state, uid, competitionDay);
      const isSpringTraining = seasonData.status === "live-season" && competitionDay < 1;
      const maxBlocks = engine.blocksAvailable(state, { isShowDay, isSpringTraining }, store.balance);

      // Assistant director (design §5.2): on a day the director never played,
      // the saved plan template runs at reduced yield. Active play strictly
      // dominates; a missed day is growth lost, never a wrecked season.
      if (
        (dayInfo.blocksUsed || 0) === 0 &&
        !dayInfo.restDay &&
        Array.isArray(state.planTemplate) &&
        state.planTemplate.length > 0 &&
        competitionDay <= 49
      ) {
        const blocksSoFar = {};
        const applied = [];
        for (const blockType of state.planTemplate.slice(0, maxBlocks)) {
          if (!engine.BLOCK_TYPES.includes(blockType)) continue;
          engine.allocateBlock(
            state,
            blockType,
            competitionDay,
            applied.length,
            blocksSoFar,
            store.curves,
            store.balance,
            { yieldMultiplier: store.balance.rehearsal.assistantYield }
          );
          blocksSoFar[blockType] = (blocksSoFar[blockType] || 0) + 1;
          applied.push(blockType);
        }
        if (applied.length > 0) {
          dayInfo = {
            blocksUsed: applied.length,
            blocks: applied,
            restDay: false,
            warmupUsed: applied.includes("warmup"),
            assistant: true,
          };
        }
      }

      if (isShowDay) {
        // Performance load + travel + climate (design §5.3). Majors are
        // coin-subsidized; stamina always applies. Coin costs are logged now
        // and charged when the Corps Budget ledger lands (Phase 4).
        const showVenue = showVenueFor(competitionDay, scheduleLocations);
        const fromVenue = state.lastVenue || venues.venueFor(state.location) || null;
        const leg = venues.travelLeg(fromVenue, showVenue, store.balance);
        const isMajor = Boolean(venues.MAJOR_VENUES[competitionDay]);
        const heat = venues.heatStamina(showVenue, store.balance);
        const travelStamina = leg ? leg.staminaCost : 0;
        state.condition.stamina = Math.max(
          0,
          state.condition.stamina -
            store.balance.condition.showStaminaCost -
            travelStamina -
            heat
        );
        if (leg && leg.miles > 0) {
          state.travelLog = [
            ...(state.travelLog || []).slice(-30),
            {
              day: competitionDay,
              to: showVenue ? showVenue.venueId : null,
              tier: leg.tier,
              miles: leg.miles,
              coinCost: isMajor ? 0 : leg.coinCost,
              staminaCost: travelStamina,
              heat,
            },
          ];
        }
        if (showVenue) {
          state.lastVenue = {
            venueId: showVenue.venueId,
            city: showVenue.city,
            region: showVenue.region,
            lat: showVenue.lat,
            lng: showVenue.lng,
          };
        }
      }

      // Family Day (design §5.9): the last spring-training day ends with an
      // unscored exhibition — a private diagnostic recap, invisible to the
      // leaderboard, scored against the day-1 band.
      if (isSpringTraining && competitionDay === 0) {
        state.familyDay = {
          calendarDay,
          ...engine.scoreCorps(state, 1, `${seasonUid}|familyday|${uid}`, store.curves, store.balance),
        };
      }
      engine.endOfDay(
        state,
        competitionDay,
        {
          restDay: Boolean(dayInfo.restDay),
          blocksUsedToday: dayInfo.blocksUsed || 0,
          maxBlocksToday: maxBlocks,
          warmupUsed: Boolean(dayInfo.warmupUsed),
        },
        store.balance
      );

      // --- 2. Score show days ----------------------------------------------
      let score = null;
      if (isShowDay) {
        score = engine.scoreCorps(
          state,
          competitionDay,
          `${seasonUid}|${competitionDay}|${uid}`,
          store.curves,
          store.balance
        );
        state.lastScoredDay = competitionDay;
        state.lastTotal = score.total;
        results.push({
          uid,
          corpsName: state.corpsName,
          corpsClass: "podiumClass",
          repTier: state.repTier,
          totalScore: score.total,
          geScore: score.geScore,
          visualScore: score.visualScore,
          musicScore: score.musicScore,
          captions: score.captions,
        });
      }

      // Roll `today` so tomorrow starts clean even if the player never opens
      // the app (their client-side roll would otherwise snapshot a stale day).
      state.today = {
        calendarDay: calendarDay + 1,
        blocksUsed: 0,
        blocks: [],
        restDay: false,
        warmupUsed: false,
      };
      state.updatedAt = new Date().toISOString();
      await sRef.set(store.dehydrateState(state));
      processed++;
    }

    // --- 3. Recap doc -------------------------------------------------------
    if (results.length > 0) {
      results.sort((a, b) => b.totalScore - a.totalScore);
      results.forEach((entry, index) => {
        entry.place = index + 1;
      });
      await store.recapDayRef(db, seasonUid, competitionDay).set({
        seasonUid,
        competitionDay,
        calendarDay,
        processedAt: new Date().toISOString(),
        results,
      });
    }

    // --- 4. Rankings (latest total, DCI-style current score) ----------------
    const standings = [];
    const rosterAgain = await store.rosterCollection(db, seasonUid).get();
    for (const rosterDoc of rosterAgain.docs) {
      const snapshot = await store.stateRef(db, rosterDoc.id).get();
      if (!snapshot.exists) continue;
      const data = snapshot.data();
      if (data.lastTotal != null) {
        standings.push({ uid: rosterDoc.id, lastTotal: data.lastTotal });
      }
    }
    standings.sort((a, b) => b.lastTotal - a.lastTotal);
    for (let i = 0; i < standings.length; i++) {
      const { uid, lastTotal } = standings[i];
      await store.stateRef(db, uid).set(
        { seasonRank: i + 1, seasonRankOf: standings.length },
        { merge: true }
      );
      await store.profileRef(db, uid).set(
        {
          corps: {
            podiumClass: {
              totalSeasonScore: lastTotal,
              seasonRank: i + 1,
              seasonRankOf: standings.length,
            },
          },
        },
        { merge: true }
      );
    }

    await markScoringRunCompleted(db, leaseKey, calendarDay, {
      corps: processed,
      scored: results.length,
    });
    logger.info(
      `[podium] day ${calendarDay} (competition ${competitionDay}): ` +
        `${processed} corps processed, ${results.length} scored.`
    );
    return {
      status: "completed",
      corps: processed,
      scored: results.length,
      calendarDay,
      competitionDay,
    };
  } catch (error) {
    await markScoringRunFailed(db, leaseKey, calendarDay, error);
    throw error;
  }
}

module.exports = { processPodiumDay };
