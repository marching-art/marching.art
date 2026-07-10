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
const staffMarket = require("./staffMarket");
const joint = require("./joint");
const { processCoinAwardsBatch } = require("../scoringAwards");
const { SHOW_PARTICIPATION_REWARDS } = require("../classRegistry");
const { ChunkedWriter } = require("../chunkedWriter");

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

  // Beta tuning path: merge podium-config/balance overrides over the
  // committed defaults before any engine math runs tonight.
  await store.applyBalanceOverrides(db);

  try {
    const roster = await store.rosterCollection(db, seasonUid).get();
    if (roster.empty) {
      await markScoringRunCompleted(db, leaseKey, calendarDay, { corps: 0 });
      return { status: "completed", corps: 0, scored: 0, calendarDay, competitionDay };
    }

    const scheduleLocations = await loadScheduleLocations(db, seasonData);
    // Published Day-39 Eastern night snake (null before publication — the
    // uid-parity fallback stands until then).
    const easternAssignments = await store.loadEasternAssignments(db, seasonUid);
    const results = [];
    const jointToday = []; // corps whose joint rehearsal was today (§5.12)
    const coinAwards = []; // wallet CC per performance (shared economy faucet)
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
      const isShowDay = store.isShowDayFor(state, uid, competitionDay, easternAssignments);
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
          // An accepted joint rehearsal boosts Full Ensemble even on an
          // assistant-run day — the handshake happened, the partner showed
          // up (§5.12; only ACCEPTING is human-gated).
          const jointMult =
            blockType === "fullEnsemble" &&
            state.jointRehearsal &&
            state.jointRehearsal.day === competitionDay
              ? state.jointRehearsal.bonusMult || 1
              : 1;
          engine.allocateBlock(
            state,
            blockType,
            competitionDay,
            applied.length,
            blocksSoFar,
            store.curves,
            store.balance,
            {
              yieldMultiplier:
                store.balance.rehearsal.assistantYield *
                staffMarket.staffYieldMultiplier(state, blockType, store.balance) *
                jointMult,
            }
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
        // A Tour Manager smooths the miles (design §5.6 ops staff).
        const tourReduction = staffMarket.tourStaminaReduction(state, store.balance);
        let travelStamina = leg ? Math.round(leg.staminaCost * (1 - tourReduction) * 10) / 10 : 0;
        // Budget charge (majors are subsidized). Free floor: an unaffordable
        // leg becomes a stamina surcharge — the bus still rolls (decision 24).
        let paidTravel = true;
        if (leg && !isMajor && leg.coinCost > 0) {
          paidTravel = store.debitBudget(state, leg.coinCost, "travel", competitionDay);
          if (!paidTravel) {
            travelStamina += store.balance.travel.unaffordableStaminaSurcharge;
          }
        }
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
              coinCost: isMajor || !paidTravel ? 0 : leg.coinCost,
              unaffordable: !paidTravel || undefined,
              staminaCost: travelStamina,
              heat,
            },
          ];
        }
        // Show payout: in-class Budget income for performing.
        store.creditBudget(state, store.balance.budget.showPayout, "showPayout", competitionDay);
        // Participation CC (registry-derived, same faucet every class has):
        // performing pays the shared wallet — the income that funds class
        // unlocks and the hosting ladder. Paid once per performance night.
        const participationCC = SHOW_PARTICIPATION_REWARDS.podiumClass || 0;
        if (participationCC > 0) {
          coinAwards.push({
            uid,
            corpsClass: "podiumClass",
            showName: `Day ${competitionDay}`,
            amount: participationCC,
            description: `Podium performance — Day ${competitionDay}`,
          });
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

      // Weekly food charge at the top of each calendar week; an unaffordable
      // plan degrades to gas-station for the week (free floor, never a block).
      if ((calendarDay - 1) % 7 === 0) {
        const tier = state.foodTier || "standard";
        const cost = (store.balance.condition.foodTiers[tier] || {}).costPerWeek || 0;
        if (cost > 0 && !store.debitBudget(state, cost, `food:${tier}`, competitionDay)) {
          state.foodTier = "gasStation";
        }
      }

      // Spring-training camp economics: each camp day a corps actually
      // rehearses costs housing+food. Unaffordable camp days are free —
      // degraded recovery already prices poverty (free floor).
      if (isSpringTraining && (dayInfo.blocksUsed || 0) > 0) {
        store.debitBudget(state, store.balance.budget.springTrainingDayCost, "camp", competitionDay);
      }

      // Expire finished clinician engagements.
      if (state.clinician && state.clinician.expiresDay < competitionDay) {
        delete state.clinician;
      }

      // Joint rehearsal day (design §5.12): morale bump (performing for an
      // audience of peers), the proposer's travel gap charged like any leg
      // (debit-or-surcharge, free floor), and the pair registered for the
      // post-loop scrimmage pass. Stale entries (partner vanished, missed
      // day) are cleared quietly.
      if (state.jointRehearsal && state.jointRehearsal.day === competitionDay) {
        state.condition.morale = Math.min(
          store.balance.condition.moraleMax,
          (state.condition.morale || 0) + store.balance.joint.moraleBonus
        );
        if (state.jointRehearsal.travelTier) {
          const tierCfg = store.balance.travel.tiers.find(
            (t) => t.key === state.jointRehearsal.travelTier
          );
          if (tierCfg && tierCfg.coinCost > 0) {
            const paid = store.debitBudget(state, tierCfg.coinCost, "jointTravel", competitionDay);
            if (!paid) {
              state.condition.stamina = Math.max(
                0,
                state.condition.stamina - store.balance.travel.unaffordableStaminaSurcharge
              );
            }
          }
        }
        jointToday.push({
          uid,
          partnerUid: state.jointRehearsal.partnerUid,
          corpsName: state.corpsName,
          partnerCorpsName: state.jointRehearsal.partnerCorpsName,
          city: state.jointRehearsal.city || null,
        });
      } else if (state.jointRehearsal && state.jointRehearsal.day < competitionDay) {
        delete state.jointRehearsal;
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
          division: state.division || "aClass",
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

    // --- 2b. Scrimmage pass (design §5.12) -----------------------------------
    // For every pair whose joint rehearsal was today: each side gets the
    // PRIVATE head-to-head diagnostic on its own state, the shared entry is
    // consumed, and the pair emits one public feed line for the recap.
    const jointFeed = [];
    const scrimmagedPairs = new Set();
    for (const entry of jointToday) {
      try {
        const mySnapshot = await store.stateRef(db, entry.uid).get();
        if (!mySnapshot.exists) continue;
        const myState = store.hydrateState(mySnapshot.data());
        const partnerSnapshot = entry.partnerUid
          ? await store.stateRef(db, entry.partnerUid).get()
          : null;
        let scrimmage = null;
        if (
          partnerSnapshot &&
          partnerSnapshot.exists &&
          partnerSnapshot.data().seasonUid === seasonUid
        ) {
          const partnerState = store.hydrateState(partnerSnapshot.data());
          scrimmage = joint.scrimmageReport(
            myState, partnerState, competitionDay, seasonUid, store.curves, store.balance
          );
          const pairKey = [entry.uid, entry.partnerUid].sort().join("_");
          if (!scrimmagedPairs.has(pairKey)) {
            scrimmagedPairs.add(pairKey);
            jointFeed.push({
              corpsA: entry.corpsName || null,
              corpsB: entry.partnerCorpsName || null,
              city: entry.city,
            });
          }
        }
        // Merge-write ONLY this pass's fields: a full-doc set here would
        // clobber any block the director allocated between the main loop's
        // write and this pass (players do play at 2 AM). jointRehearsal is
        // nulled rather than deleted — every consumer already treats null as
        // absent, and merge semantics can't delete.
        await store.stateRef(db, entry.uid).set(
          { ...(scrimmage ? { scrimmage } : {}), jointRehearsal: null },
          { merge: true }
        );
      } catch (error) {
        logger.error(`[podium] scrimmage pass failed for ${entry.uid}: ${error.message}`);
      }
    }

    // --- 2c. Participation CC/XP pass ----------------------------------------
    // Same batch path fantasy uses (increment + history subcollection).
    // Isolated: a payout failure never fails the night's scoring.
    if (coinAwards.length > 0) {
      try {
        const coinWriter = new ChunkedWriter(db);
        processCoinAwardsBatch(coinAwards, coinWriter, db);
        await coinWriter.commit();
      } catch (error) {
        logger.error(`[podium] participation coin pass failed: ${error.message}`);
      }
    }

    // --- 3. Recap doc -------------------------------------------------------
    const medalByUid = {};
    if (results.length > 0 || jointFeed.length > 0) {
      results.sort((a, b) => b.totalScore - a.totalScore);
      results.forEach((entry, index) => {
        entry.place = index + 1;
      });
      // Per-show medals (design §14.1.3): top 3 at any meaningfully-sized
      // show bank a lifetime counter — the FMA "70+ regular-season golds"
      // collector hook.
      if (results.length >= store.balance.medals.minFieldSize) {
        const medalNames = ["gold", "silver", "bronze"];
        results.slice(0, 3).forEach((entry, index) => {
          medalByUid[entry.uid] = medalNames[index];
          entry.medal = medalNames[index];
        });
      }
      await store.recapDayRef(db, seasonUid, competitionDay).set({
        seasonUid,
        competitionDay,
        calendarDay,
        processedAt: new Date().toISOString(),
        results,
        // Public smoke, private fire: who rehearsed together — never the
        // scrimmage numbers (§5.12).
        ...(jointFeed.length > 0 ? { jointRehearsals: jointFeed } : {}),
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
        standings.push({
          uid: rosterDoc.id,
          corpsName: data.corpsName || null,
          repTier: data.repTier ?? null,
          division: data.division || "aClass",
          lastTotal: data.lastTotal,
          medals: data.medals,
        });
      }
    }
    standings.sort((a, b) => b.lastTotal - a.lastTotal);

    // --- 4a. Eastern Classic night snake (design §5.11) ----------------------
    // Published once, at the end of Day 38 (players wake to lineups on Day
    // 39): within each division, current standings snake across the two
    // nights (1-4-5-8 / 2-3-6-7) so both nights carry equal strength. Corps
    // outside the standings (never scored) keep the uid-parity fallback.
    if (competitionDay === store.EASTERN_PUBLISH_DAY - 1 && standings.length > 0) {
      try {
        const assignments = {};
        const divisionOrder = ["worldClass", "openClass", "aClass"];
        for (const division of divisionOrder) {
          const seeds = standings.filter((entry) => entry.division === division);
          seeds.forEach((entry, index) => {
            const snakePos = index % 4;
            assignments[entry.uid] = snakePos === 0 || snakePos === 3 ? 41 : 42;
          });
        }
        await db.doc(`eastern-classic/${seasonUid}`).set(
          {
            podium: {
              assignments,
              publishedAt: new Date().toISOString(),
              publishedOnDay: competitionDay,
            },
          },
          { merge: true }
        );
        logger.info(`[podium] Eastern night snake published: ${Object.keys(assignments).length} corps.`);
      } catch (error) {
        logger.error(`[podium] Eastern snake publication failed: ${error.message}`);
      }
    }
    for (let i = 0; i < standings.length; i++) {
      const { uid, lastTotal, medals, division } = standings[i];
      const medalWon = medalByUid[uid];
      const updatedMedals = medalWon
        ? { ...(medals || {}), [medalWon]: ((medals || {})[medalWon] || 0) + 1 }
        : medals || {};
      await store.stateRef(db, uid).set(
        { seasonRank: i + 1, seasonRankOf: standings.length, medals: updatedMedals },
        { merge: true }
      );
      await store.profileRef(db, uid).set(
        {
          corps: {
            podiumClass: {
              totalSeasonScore: lastTotal,
              seasonRank: i + 1,
              seasonRankOf: standings.length,
              division,
              medals: updatedMedals,
            },
          },
        },
        { merge: true }
      );
    }

    // --- 5. The Podium Report (Phase 7.3): weekly power-rankings column ------
    // Deterministic, data-driven, published at each week boundary. Isolated:
    // a column failure never fails the run.
    if (competitionDay >= 7 && competitionDay % 7 === 0 && standings.length > 0) {
      try {
        const { buildPowerRankings } = require("./powerRankings");
        const week = competitionDay / 7;
        const previousSnapshot =
          week > 1
            ? await db.doc(`podium-recaps/${seasonUid}/power/${week - 1}`).get()
            : null;
        const column = buildPowerRankings(
          standings,
          previousSnapshot && previousSnapshot.exists ? previousSnapshot.data() : null,
          week
        );
        await db.doc(`podium-recaps/${seasonUid}/power/${week}`).set({
          ...column,
          seasonUid,
          competitionDay,
          publishedAt: new Date().toISOString(),
        });
        logger.info(`[podium] Podium Report week ${week}: ${column.entries.length} entries.`);
      } catch (error) {
        logger.error(`[podium] power rankings failed (run unaffected): ${error.message}`);
      }
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

module.exports = { processPodiumDay, loadScheduleLocations };
