// Weekly league processing for scoring runs: end-of-week matchup winner
// determination (records, weekly-win rewards, standings) and the weekly
// participation XP payout. Extracted verbatim from scoringAwards.js.

const { paths } = require("./paths");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const {
  TRANSACTION_TYPES,
  addCoinHistoryEntryToBatch,
  WEEKLY_LEAGUE_WIN_REWARD,
} = require("./economy");
const { XP_SOURCES } = require("./xpCalculations");
const { ChunkedWriter } = require("./chunkedWriter");
const { updateStandings } = require("./leagueStandings");
const { createLeagueActivity } = require("./leagueHelpers");
const { sendMatchupNotifications } = require("./matchupNotifications");
const { MATCHUP_CLASSES } = require("./classRegistry");
const { processAllInPages } = require("./firestorePaging");
const { generateLeagueRecapsForWeek } = require("./leagueRecaps");
const {
  fetchWeeklyScoreIndex,
  decideHeadToHead,
  participatingClassesByUid,
} = require("./leagueScoring");
const { isCaptionWarsLeague, resolveCaptionWars, captionsWonBy } = require("./captionWars");
const {
  weeklyXpToken,
  weeklyWinToken,
  matchupRecordToken,
  hasAwardToken,
  awardTokenWrite,
} = require("./awardLedger");

/**
 * Process weekly matchup determination at end of each week.
 *
 * @param {number} week - The week number (1-7)
 * @param {Object} seasonData - Season configuration data
 * @param {FirebaseFirestore.Firestore} db - Firestore database instance
 */
async function processWeeklyMatchups(week, seasonData, db, { force = false } = {}) {
  logger.info(`End of week ${week}. Determining class-based matchup winners...`);

  // The week's actual body of work, from the committed recap days. Matchups
  // used to compare `corps.{class}.totalSeasonScore`, which the nightly run
  // overwrites with each corps' MOST RECENT show total — so a director who sat
  // the week out kept an old score and could still win, and anyone who
  // competed twice had all but their last show discarded. See leagueScoring.js.
  const { index: weekScores, daysFound } = await fetchWeeklyScoreIndex(
    db,
    seasonData.seasonUid,
    week
  );
  // No recap day for this week exists at all. Resolving anyway would mark every
  // matchup in every league a completed 0-0 tie and fold that into standings
  // permanently — a data-availability incident must not become a recorded
  // result. Already-decided matchups (generator byes, a commissioner's manual
  // close) still fold, since they need no scores; the undecided ones are left
  // for a re-run to settle.
  const canResolveScores = daysFound > 0;
  if (!canResolveScores) {
    logger.error(
      `Week ${week}: no recap days found for season ${seasonData.seasonUid}; ` +
        `leaving undecided matchups unresolved rather than recording a week of ties.`
    );
  }

  // Leagues live under the data namespace (see callable/leagues.js) and
  // matchup docs are written as `week-N` by generateMatchups /
  // generateWeeklyMatchups — these paths must stay in sync with those
  // writers or winner determination silently processes zero leagues.
  //
  // Paged, not `.limit(500)`: the old fetch logged a warning and then silently
  // stopped resolving matchups for every league past the 500th — the worst
  // possible failure mode, arriving exactly when the game succeeds at its
  // stated scale. Every sibling league job already uses processAllInPages.
  const leagueDocs = await processAllInPages(db.collection(paths.leagues()), 500, async (d) => d);
  const leaguesSnapshot = { docs: leagueDocs, size: leagueDocs.length };

  // ChunkedWriter: two record writes per matchup across up to 500 leagues
  // plus coin awards can exceed a single WriteBatch's per-request cap.
  const winnerBatch = new ChunkedWriter(db);
  // Registry-derived (Phase 7.4): every matchup class resolves head-to-head
  // on corps.{class}.totalSeasonScore — Podium's nightly display copy
  // included, once its registry entry enables at launch.
  const corpsClasses = MATCHUP_CLASSES;
  // Per-league resolved pairs, applied to standings only after the matchup
  // docs commit (see below).
  const standingsByLeague = [];

  // Batch fetch ALL matchup documents in ONE operation
  const matchupRefs = leaguesSnapshot.docs.map(leagueDoc =>
    db.doc(`${leagueDoc.ref.path}/matchups/week-${week}`)
  );
  const matchupDocs = matchupRefs.length > 0 ? await db.getAll(...matchupRefs) : [];

  // Build a Map for O(1) lookup by league ID
  const matchupMap = new Map();
  matchupDocs.forEach((doc, i) => {
    if (doc.exists) {
      matchupMap.set(leaguesSnapshot.docs[i].id, { ref: doc.ref, data: doc.data() });
    }
  });

  logger.info(`Batch fetched ${matchupMap.size} matchup documents for ${leaguesSnapshot.size} leagues.`);

  for (const leagueDoc of leaguesSnapshot.docs) {
    const matchupEntry = matchupMap.get(leagueDoc.id);
    if (!matchupEntry) continue;

    const matchupData = { ...matchupEntry.data };
    const matchupDocRef = matchupEntry.ref;
    let hasUpdates = false;
    // Which format decides this league's weeks. Checked per league and pinned
    // to the season it was bought for, so a league that never opted in — or
    // whose opt-in belongs to a previous season — resolves on totals exactly as
    // it always has. See helpers/captionWars.js.
    const captionWars = isCaptionWarsLeague(leagueDoc.data(), seasonData.seasonUid);
    // Resolved pairs for the standings/current doc — same shape the
    // commissioner callable feeds updateStandings, so the automatic weekly
    // close and a manual resolution produce identical standings.
    const standingsPairs = [];

    for (const corpsClass of corpsClasses) {
      const matchupArrayKey = `${corpsClass}Matchups`;
      const matchups = matchupData[matchupArrayKey] || [];
      if (matchups.length === 0) continue;

      const updatedMatchupsForClass = [];

      // Batch fetch all matchup profiles for this class upfront
      const matchupsNeedingScores = matchups.filter(m => !m.winner && !m.completed);
      const allPlayerIds = [...new Set(matchupsNeedingScores.flatMap(m => m.pair))];

      // Batch fetch all profiles in ONE operation
      const profileRefs = allPlayerIds.map(uid =>
        db.doc(paths.userProfile(uid))
      );
      const profileDocs = allPlayerIds.length > 0 ? await db.getAll(...profileRefs) : [];
      const profileMap = new Map();
      profileDocs.forEach((doc, i) => {
        if (doc.exists) {
          profileMap.set(allPlayerIds[i], { ref: doc.ref, data: doc.data() });
        }
      });

      for (const matchup of matchups) {
        if (matchup.winner || matchup.completed) {
          // Already resolved: a generator bye, a previous run, or a
          // commissioner manual resolution (which folded itself into
          // standings). Byes are folded into standings HERE — this guarded
          // once-per-week run is their single counting point.
          if (matchup.isBye && matchup.pair?.[0]) {
            standingsPairs.push({
              player1: matchup.pair[0],
              player2: null,
              winner: matchup.pair[0],
              completed: true,
              corpsClass,
            });
          }
          updatedMatchupsForClass.push(matchup);
          continue;
        }

        if (!canResolveScores) {
          updatedMatchupsForClass.push(matchup);
          continue;
        }

        const [p1_uid, p2_uid] = matchup.pair;
        const p1_profile = profileMap.get(p1_uid);
        const p2_profile = profileMap.get(p2_uid);

        // THIS week's total across every show the corps attended — not the
        // stale "latest show" number. A director who did not compete scores 0
        // with 0 shows, which is a real result (a forfeited week), so showing
        // up now beats sitting out. Each side is read in ITS OWN class: a
        // cross-class matchup (leagueHelpers.js pairLeagueWeek) carries a
        // per-side `classes` map and is decided on class percentile rather
        // than raw points — see leagueScoring.js decideHeadToHead.
        const decided = decideHeadToHead(matchup, corpsClass, weekScores);
        const { p1Class, p2Class, crossClass, p1Week: p1_week, p2Week: p2_week } = decided;
        const p1_score = p1_week.score;
        const p2_score = p2_week.score;

        // Best-of-three across the caption groups, or the single comparison of
        // weekly totals (percentiles, cross-class). Either way this produces
        // one winner uid (or a tie), and everything below this point — the
        // record increment, the award tokens, the weekly-win bonus, the
        // standings pair — is identical. A cross-class matchup in a Caption
        // Wars league still resolves on the percentile: the three caption
        // groups are raw per-class numbers too, so a caption comparison across
        // classes would smuggle the exact scale problem back in.
        let winnerUid = null;
        let captions = null;
        if (captionWars && !crossClass) {
          const resolved = resolveCaptionWars(p1_uid, p2_uid, p1_week, p2_week);
          captions = resolved.captions;
          winnerUid = resolved.winner === "tie" ? null : resolved.winner;
        } else {
          winnerUid = decided.winner === "tie" ? null : decided.winner;
        }

        // Per side, so a cross-class win lands on the class the director
        // actually fielded, not the array the matchup happened to be stored in.
        const p1RecordPath = `seasons.${seasonData.seasonUid}.records.${p1Class}`;
        const p2RecordPath = `seasons.${seasonData.seasonUid}.records.${p2Class}`;
        const increment = admin.firestore.FieldValue.increment(1);

        if (p1_profile?.ref && p2_profile?.ref) {
          // Idempotency: the record increment and its token ride ONE set op per
          // participant, so a ChunkedWriter partial-failure retry (which re-runs
          // any matchup whose `completed` flag didn't land) cannot re-increment
          // a record that already applied. Keyed per uid so each side is
          // independently guarded. `force` bypasses the guard for admin reprocess.
          const p1RecToken = matchupRecordToken(seasonData.seasonUid, week, leagueDoc.id, p1Class, p1_uid);
          const p2RecToken = matchupRecordToken(seasonData.seasonUid, week, leagueDoc.id, p2Class, p2_uid);
          const writeP1 = force || !hasAwardToken(p1_profile.data, p1RecToken);
          const writeP2 = force || !hasAwardToken(p2_profile.data, p2RecToken);
          let p1Delta = null;
          let p2Delta = null;
          if (winnerUid === p1_uid) {
            p1Delta = "w";
            p2Delta = "l";
          } else if (winnerUid === p2_uid) {
            p1Delta = "l";
            p2Delta = "w";
          } else {
            p1Delta = "t";
            p2Delta = "t";
          }
          if (writeP1) {
            winnerBatch.set(
              p1_profile.ref,
              { [p1RecordPath]: { [p1Delta]: increment }, ...awardTokenWrite(p1RecToken) },
              { merge: true }
            );
          }
          if (writeP2) {
            winnerBatch.set(
              p2_profile.ref,
              { [p2RecordPath]: { [p2Delta]: increment }, ...awardTokenWrite(p2RecToken) },
              { merge: true }
            );
          }

          // Pay the advertised weekly-win bonus (getEarningOpportunities:
          // "Win your weekly matchup to earn bonus CC") and keep the
          // profile's leagueWins stat live. Byes and ties award nothing.
          // The XP lands as a raw increment; xpLevel/title/class unlocks
          // recompute from the stored xp total on the next claimDailyLogin,
          // where the level-up stipend also settles via lastRewardedLevel.
          // The bonus is a SEPARATE write from the record above, so it carries
          // its own token (win vs rec) — otherwise a retry that landed the
          // record but not the bonus would skip the unpaid bonus.
          if (winnerUid) {
            const winner = winnerUid === p1_uid ? p1_profile : p2_profile;
            // The winner's OWN class, so a cross-class win is tokenized and
            // described in the class they actually fielded.
            const winnerClass = winnerUid === p1_uid ? p1Class : p2Class;
            const winToken = weeklyWinToken(seasonData.seasonUid, week, leagueDoc.id, winnerClass);
            if (force || !hasAwardToken(winner.data, winToken)) {
              winnerBatch.set(
                winner.ref,
                {
                  stats: { leagueWins: increment },
                  corpsCoin: admin.firestore.FieldValue.increment(WEEKLY_LEAGUE_WIN_REWARD),
                  xp: admin.firestore.FieldValue.increment(XP_SOURCES.leagueWin),
                  ...awardTokenWrite(winToken),
                },
                { merge: true }
              );
              addCoinHistoryEntryToBatch(winnerBatch, db, winnerUid, {
                type: TRANSACTION_TYPES.LEAGUE_WIN,
                amount: WEEKLY_LEAGUE_WIN_REWARD,
                description: `Week ${week} ${winnerClass} matchup win in ${leagueDoc.data().name || "your league"}`,
                corpsClass: winnerClass,
                timestamp: new Date(),
              });
            }
          }
        }

        // Doc convention matches the commissioner callable: completed flag
        // set, ties stored as the string 'tie' (winnerUid stays null
        // internally so ties pay nothing above). The completed flag is what
        // the weekly recap generator and the Monday push job read.
        const newMatchup = {
          ...matchup,
          scores: { [p1_uid]: p1_score, [p2_uid]: p2_score },
          // Shows attended, so the matchup card can say "did not compete"
          // rather than implying a 0.0 performance.
          shows: { [p1_uid]: p1_week.shows, [p2_uid]: p2_week.shows },
          // How each corps did against its OWN class this week, so a
          // mixed-class league can rank its members on a comparable number
          // (helpers/leagueScoring.js applyClassPercentiles).
          normalized: {
            [p1_uid]: p1_week.classPercentile,
            [p2_uid]: p2_week.classPercentile,
          },
          // Only present on leagues running Caption Wars. `scores` above still
          // holds the weekly TOTAL in both formats, so points-for/against, the
          // percentile and the record book keep meaning the same thing across a
          // league that changed format between seasons.
          ...(captions ? { captions } : {}),
          winner: winnerUid ?? "tie",
          completed: true,
        };
        updatedMatchupsForClass.push(newMatchup);

        standingsPairs.push({
          player1: p1_uid,
          player2: p2_uid,
          player1Score: p1_score,
          player2Score: p2_score,
          player1Normalized: p1_week.classPercentile,
          player2Normalized: p2_week.classPercentile,
          // Per-side classes so the notification copy can tell a cross-class
          // week (decided on percentile) from a normal one (decided on points).
          player1Class: p1Class,
          player2Class: p2Class,
          ...(captions
            ? {
                player1Captions: captionsWonBy(captions, p1_uid),
                player2Captions: captionsWonBy(captions, p2_uid),
              }
            : {}),
          winner: winnerUid ?? "tie",
          completed: true,
          corpsClass,
        });
      }
      matchupData[matchupArrayKey] = updatedMatchupsForClass;
      hasUpdates = true;
    }
    if (hasUpdates) {
      winnerBatch.update(matchupDocRef, matchupData);
    }
    if (standingsPairs.length > 0) {
      standingsByLeague.push({ leagueDoc, standingsPairs });
    }
  }

  await winnerBatch.commit();

  // Fold this week's results into each league's standings/current and drop a
  // summary event into the activity feed — previously only the
  // commissioner-invoked updateMatchupResults callable did either, so
  // auto-generated matchups never moved the standings. Applied strictly
  // AFTER the matchup docs commit: if the commit fails, matchups stay
  // unresolved and the re-run re-derives everything; standings are never
  // ahead of the docs they summarize.
  for (const { leagueDoc, standingsPairs } of standingsByLeague) {
    try {
      const { previousStandings, standings } = await updateStandings(
        db,
        leagueDoc.ref,
        standingsPairs
      );
      const decided = standingsPairs.filter((p) => p.player2 !== null).length;
      if (decided > 0) {
        await createLeagueActivity(db, leagueDoc.id, {
          type: "matchup_result",
          title: `Week ${week} Results`,
          message: `${decided} matchup${decided > 1 ? "s" : ""} decided in week ${week}.`,
          metadata: { week, matchupsCompleted: decided },
        });
      }
      // Per-director bell: win/loss/tie + any standings drop. Best-effort and
      // post-commit — see helpers/matchupNotifications.js.
      await sendMatchupNotifications(db, {
        leagueId: leagueDoc.id,
        leagueName: leagueDoc.data().name || "your league",
        week,
        seasonUid: seasonData.seasonUid,
        pairs: standingsPairs,
        previousStandings,
        newStandings: standings,
      });
    } catch (error) {
      // Standings/feed are derived views — never let them fail the
      // guarded scoring run that pays rewards.
      logger.error(`Standings/activity update failed for league ${leagueDoc.id}:`, error);
    }
  }

  // The recap summarizes the week that was just resolved, so it is generated
  // HERE rather than on its own cron. The old Sunday-22:00 recap job ran before
  // this resolution and skipped every matchup that wasn't `completed`, so it
  // wrote an empty highlights[] with null stats every week of every season.
  // Isolated: recaps are a derived view and must never fail the guarded run
  // that pays rewards. The Monday backstop cron repairs anything lost here.
  try {
    await generateLeagueRecapsForWeek(db, week);
  } catch (error) {
    logger.error(`Week ${week} league recap generation failed (scoring unaffected):`, error);
  }

  logger.info(`Matchup winner determination for week ${week} complete.`);
}

/**
 * Pay the advertised weekly-participation XP to every director who competed
 * in at least one show this week — once per participating class, so a
 * director fielding two classes earns two grants.
 *
 * Participation is derived from the week's committed recap docs
 * (fantasy_recaps/{seasonUid}/days/{day}), which only contain corps that
 * actually attended and were scored — the same source of truth the
 * standings read. Runs at the week boundary inside the scoringRunGuard-
 * protected run, so scheduler redeliveries cannot double-pay (with the
 * same documented ChunkedWriter mid-commit residual risk the CorpsCoin
 * awards carry).
 *
 * XP lands as a raw increment; xpLevel/title/class unlocks recompute from
 * the stored xp total on the next claimDailyLogin, where the level-up
 * CorpsCoin stipend also settles via lastRewardedLevel — no reward is lost
 * by deferring the recompute.
 *
 * @param {number} week - The week number (1-7)
 * @param {Object} seasonData - Season configuration data
 * @param {FirebaseFirestore.Firestore} db - Firestore database instance
 */
async function payWeeklyParticipationXP(week, seasonData, db, { force = false } = {}) {
  // Same week index the matchup resolution uses (helpers/leagueScoring.js), so
  // "who competed this week" can never differ between the XP payout and the
  // matchup that decided their week.
  const { index } = await fetchWeeklyScoreIndex(db, seasonData.seasonUid, week);
  const classesByUid = participatingClassesByUid(index);

  if (classesByUid.size === 0) {
    logger.info(`Week ${week}: no show participants in recaps; no weekly participation XP to pay.`);
    return;
  }

  // Idempotency pre-read: skip directors already paid this week's XP (unless
  // forced). The token rides the same set op as the increment below, so a torn
  // ChunkedWriter commit cannot double-pay on retry.
  const token = weeklyXpToken(seasonData.seasonUid, week);
  const uids = [...classesByUid.keys()];
  const profileRefs = uids.map((uid) => db.doc(paths.userProfile(uid)));
  const skip = new Set();
  if (!force) {
    const snaps = profileRefs.length > 0 ? await db.getAll(...profileRefs) : [];
    snaps.forEach((snap, i) => {
      if (snap.exists && hasAwardToken(snap.data(), token)) skip.add(uids[i]);
    });
  }

  const xpBatch = new ChunkedWriter(db);
  let totalXP = 0;
  let paid = 0;
  for (const [uid, classes] of classesByUid.entries()) {
    if (skip.has(uid)) continue;
    const amount = XP_SOURCES.weeklyParticipation * classes.size;
    totalXP += amount;
    const profileRef = db.doc(
      paths.userProfile(uid)
    );
    xpBatch.set(
      profileRef,
      { xp: admin.firestore.FieldValue.increment(amount), ...awardTokenWrite(token) },
      { merge: true }
    );
    paid += 1;
  }
  await xpBatch.commit();
  logger.info(
    `Week ${week}: paid weekly-participation XP to ${paid} directors (${totalXP} XP total)` +
      (skip.size > 0 ? `, skipped ${skip.size} already paid.` : ".")
  );
}

module.exports = {
  processWeeklyMatchups,
  payWeeklyParticipationXP,
};
