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
const divisions = require("./divisions");
const staffMarket = require("./staffMarket");
const joint = require("./joint");
const { processCoinAwardsBatch } = require("../scoringAwards");
const { SHOW_PARTICIPATION_REWARDS } = require("../classRegistry");
const { ChunkedWriter } = require("../chunkedWriter");

// Branded names for the fixed majors (mirror of podium.js MAJOR_ROUTE_LABELS).
const MAJOR_EVENT_LABELS = {
  28: "marching.art Southwestern Championship",
  35: "marching.art Southeastern Championship",
  41: "marching.art Eastern Classic",
  42: "marching.art Eastern Classic",
};

/**
 * Venue for a corps' `chosenShow` on `competitionDay`: the branded majors have
 * fixed sites; otherwise the chosen show's location (falling back to the day's
 * first scheduled show for legacy picks with no stored location).
 */
function showVenueFor(competitionDay, chosenShow, dayShows) {
  if (venues.MAJOR_VENUES[competitionDay]) return venues.MAJOR_VENUES[competitionDay];
  const location = (chosenShow && chosenShow.location) || (dayShows[0] && dayShows[0].location);
  return location ? venues.venueFor(location) : null;
}


/**
 * The specific show a corps competes at on `competitionDay` — {eventName,
 * location}. Self-picks win; auto days resolve to their branded/division event;
 * everything falls back to the day's first scheduled show.
 */
function resolveCorpsShow(state, competitionDay, division, dayShows) {
  const first = dayShows[0] || null;
  const firstLocation = first ? first.location : null;
  const pick = store.showPickFor(state, competitionDay);
  if (pick && pick.eventName) {
    return { eventName: pick.eventName, location: pick.location || firstLocation };
  }
  const champ = (store.CHAMPIONSHIP_LABELS_BY_DIVISION[division] || {})[competitionDay];
  if (champ) return { eventName: champ, location: firstLocation };
  if (MAJOR_EVENT_LABELS[competitionDay]) {
    return { eventName: MAJOR_EVENT_LABELS[competitionDay], location: firstLocation };
  }
  if (first) return { eventName: first.eventName, location: first.location };
  return { eventName: `Day ${competitionDay}`, location: null };
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
  // committed defaults, and swap in the full-archive curve rebuild when
  // available, before any engine math runs tonight.
  await store.applyBalanceOverrides(db);
  await store.applyCurveOverrides(db);

  try {
    const roster = await store.rosterCollection(db, seasonUid).get();
    if (roster.empty) {
      await markScoringRunCompleted(db, leaseKey, calendarDay, { corps: 0 });
      return { status: "completed", corps: 0, scored: 0, calendarDay, competitionDay };
    }

    const scheduleShows = await store.loadScheduleShowsByDay(db, seasonData);
    const dayShows = scheduleShows[competitionDay] || [];
    // Published Day-39 Eastern night snake (null before publication — the
    // uid-parity fallback stands until then).
    const easternAssignments = await store.loadEasternAssignments(db, seasonUid);
    // Podium is scored PER SHOW: each corps' result lands in its chosen show's
    // group, ranked independently. Map keyed by eventName preserving insertion.
    const showGroups = new Map();
    const jointToday = []; // corps whose joint rehearsal was today (§5.12)
    const coinAwards = []; // wallet CC per performance (shared economy faucet)
    const funnel = {
      corps: 0,
      activeSelf: 0,
      restDays: 0,
      blocksAllocated: 0,
      withUpcomingPicks: 0,
      d1Cohort: 0,
      d1Returned: 0,
      d7Cohort: 0,
      d7Returned: 0,
    };
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

      // --- Funnel instrumentation (Phase 8.2): "simple like FMA" is
      // measured, not asserted. Counted BEFORE assistant autoplay so
      // self-played and autopiloted days never blur.
      {
        const playedSelf = (dayInfo.blocksUsed || 0) > 0;
        funnel.corps += 1;
        if (playedSelf) {
          funnel.activeSelf += 1;
          funnel.blocksAllocated += dayInfo.blocksUsed || 0;
        } else if (dayInfo.restDay) {
          funnel.restDays += 1;
        }
        const upcomingPicks = store.selectedDaysOf(state).filter(
          (day) => day > competitionDay && day <= competitionDay + 7
        ).length;
        if (upcomingPicks > 0) funnel.withUpcomingPicks += 1;
        if (state.createdAt) {
          const ageDays = Math.floor(
            (Date.now() - new Date(state.createdAt).getTime()) / 86400000
          );
          const engaged = playedSelf || dayInfo.restDay;
          if (ageDays === 1) {
            funnel.d1Cohort += 1;
            if (engaged) funnel.d1Returned += 1;
          } else if (ageDays === 7) {
            funnel.d7Cohort += 1;
            if (engaged) funnel.d7Returned += 1;
          }
        }
      }

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

      // The specific show this corps competes at today (self-pick / auto /
      // fallback) — drives the venue, the per-show recap grouping, and payouts.
      const chosenShow = isShowDay
        ? resolveCorpsShow(state, competitionDay, divisions.normalizeDivision(state.division), dayShows)
        : null;

      if (isShowDay) {
        // Performance load + travel + climate (design §5.3). Majors are
        // coin-subsidized; stamina always applies. Coin costs are logged now
        // and charged when the Corps Budget ledger lands (Phase 4).
        const showVenue = showVenueFor(competitionDay, chosenShow, dayShows);
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
            showName: chosenShow.eventName,
            amount: participationCC,
            description: `Podium performance — ${chosenShow.eventName}`,
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
        // Seed folds in the chosen show so two corps at different shows on the
        // same day get independent luck draws.
        score = engine.scoreCorps(
          state,
          competitionDay,
          `${seasonUid}|${competitionDay}|${chosenShow.eventName}|${uid}`,
          store.curves,
          store.balance
        );
        state.lastScoredDay = competitionDay;
        state.lastTotal = score.total;
        // Season trajectory for the shadows chart (idempotent per day).
        state.scoreHistory = [
          ...(state.scoreHistory || []).filter((entry) => entry.day !== competitionDay).slice(-59),
          { day: competitionDay, total: score.total },
        ];
        // Bucket the result under its show — each show is ranked on its own.
        if (!showGroups.has(chosenShow.eventName)) {
          showGroups.set(chosenShow.eventName, {
            eventName: chosenShow.eventName,
            location: chosenShow.location || null,
            results: [],
          });
        }
        showGroups.get(chosenShow.eventName).results.push({
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

    // --- 3. Recap doc (per SHOW) --------------------------------------------
    // Each show is ranked on its own — placement and medals reset per show, so
    // two corps competing at different shows on the same night are never ranked
    // against each other. The recap mirrors the fantasy `shows: [...]` shape.
    const medalByUid = {};
    const recapShows = [];
    for (const group of showGroups.values()) {
      group.results.sort((a, b) => b.totalScore - a.totalScore);
      group.results.forEach((entry, index) => {
        entry.place = index + 1;
      });
      // Per-show medals (design §14.1.3): top 3 at any meaningfully-sized
      // show bank a lifetime counter — the FMA "70+ regular-season golds"
      // collector hook.
      if (group.results.length >= store.balance.medals.minFieldSize) {
        const medalNames = ["gold", "silver", "bronze"];
        group.results.slice(0, 3).forEach((entry, index) => {
          medalByUid[entry.uid] = medalNames[index];
          entry.medal = medalNames[index];
        });
      }
      recapShows.push(group);
    }
    // Credit the director on every recap row (username preferred, mirroring the
    // fantasy `displayName` shape) so the Scores sheet can name + link them.
    // One batched getAll over the show-day corps — never a read per row, and
    // never fails the night.
    const recapUids = [...new Set(recapShows.flatMap((show) => show.results.map((r) => r.uid)))];
    if (recapUids.length > 0) {
      try {
        const profileSnaps = await db.getAll(...recapUids.map((uid) => store.profileRef(db, uid)));
        const nameByUid = {};
        profileSnaps.forEach((snap, i) => {
          const data = snap.exists ? snap.data() : null;
          nameByUid[recapUids[i]] = (data && (data.username || data.displayName)) || null;
        });
        for (const show of recapShows) {
          for (const entry of show.results) {
            entry.displayName = nameByUid[entry.uid] || null;
          }
        }
      } catch (error) {
        logger.warn(`[podium] director-name enrichment skipped: ${error.message}`);
      }
    }
    if (recapShows.length > 0 || jointFeed.length > 0) {
      await store.recapDayRef(db, seasonUid, competitionDay).set({
        seasonUid,
        competitionDay,
        calendarDay,
        processedAt: new Date().toISOString(),
        shows: recapShows,
        // Public smoke, private fire: who rehearsed together — never the
        // scrimmage numbers (§5.12).
        ...(jointFeed.length > 0 ? { jointRehearsals: jointFeed } : {}),
      });
      // Records Book parity (§14.1.6): Podium marks ride the same all-time
      // records doc as the fantasy classes. `updateRecordsFromPodiumRecap`
      // already accepts a `shows` array. Never fails the night.
      if (recapShows.length > 0) {
        const { updateRecordsFromPodiumRecap } = require("../gameRecords");
        await updateRecordsFromPodiumRecap(db, { shows: recapShows }, seasonUid, competitionDay);
      }
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

    // --- 4a2. Funnel metrics doc (Phase 8.2) ----------------------------------
    // One doc per calendar day; the Admin panel charts the last weeks.
    // Isolated: a metrics failure never fails the night.
    try {
      await db.doc(`podium-metrics/${seasonUid}/days/${calendarDay}`).set({
        seasonUid,
        calendarDay,
        competitionDay,
        ...funnel,
        blocksPerActiveCorps:
          funnel.activeSelf > 0
            ? Math.round((funnel.blocksAllocated / funnel.activeSelf) * 100) / 100
            : 0,
        d1ReturnRate: funnel.d1Cohort > 0 ? funnel.d1Returned / funnel.d1Cohort : null,
        d7ReturnRate: funnel.d7Cohort > 0 ? funnel.d7Returned / funnel.d7Cohort : null,
        pickCoverage: funnel.corps > 0 ? funnel.withUpcomingPicks / funnel.corps : 0,
        processedAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`[podium] funnel metrics write failed: ${error.message}`);
    }

    // --- 4b. Fan Favorite finalists (decision 30) -----------------------------
    // The last prelims window (Eastern, days 41-42 + 3) closes with the
    // Day-44 processing run; finalists publish for the championship-week
    // finals ballot. Isolated + idempotent.
    if (competitionDay === 44) {
      try {
        const fanFavorite = require("./fanFavorite");
        await fanFavorite.publishFinalists(db, seasonUid, store.balance);
      } catch (error) {
        logger.error(`[podium] Fan Favorite finalists failed: ${error.message}`);
      }
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

    const scoredCount = [...showGroups.values()].reduce((n, g) => n + g.results.length, 0);
    await markScoringRunCompleted(db, leaseKey, calendarDay, {
      corps: processed,
      scored: scoredCount,
    });
    logger.info(
      `[podium] day ${calendarDay} (competition ${competitionDay}): ` +
        `${processed} corps processed, ${scoredCount} scored across ${showGroups.size} shows.`
    );
    return {
      status: "completed",
      corps: processed,
      scored: scoredCount,
      calendarDay,
      competitionDay,
    };
  } catch (error) {
    await markScoringRunFailed(db, leaseKey, calendarDay, error);
    throw error;
  }
}

module.exports = { processPodiumDay, showVenueFor, resolveCorpsShow };
