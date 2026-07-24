// Season-standings materializer: the server half of collapsing the Scores
// page's read path. The client previously downloaded the entire recap
// subcollection (up to 49 day docs, each carrying every show × corps result)
// and rebuilt season standings on every device. The nightly pipeline now
// does that aggregation ONCE, here, and publishes:
//
//   fantasy_standings/{seasonUid}                     — summary: scored days,
//     header stats, per-class entry counts
//   fantasy_standings/{seasonUid}/classes/{classKey}  — ranked entries per
//     ranked class, shaped to the client's LeaderboardEntry contract
//     (src/hooks/useScoresData.ts) so consumption is a drop-in
//
// The entry shape deliberately mirrors what useScoresData.aggregatedScores
// produced client-side: rank, latest-show score as the season score, caption
// aggregates from the latest show, per-class caption ranks, a bounded
// most-recent-first score history (rank deltas need scores[1]; the trend
// sparkline uses 5), and the same trend thresholds.
//
// SoundSport is excluded from class standings and from top/avg score stats
// (ratings are never revealed) but its corps count toward corpsActive —
// identical to the client rules being replaced.

const { logger } = require("firebase-functions/v2");
const { RANKED_CLASSES } = require("./classRegistry");

// scores[0] feeds caption breakdowns, scores[1] the rank delta, and the
// sparkline wants 5 — 6 covers all consumers with headroom.
const HISTORY_LIMIT = 6;

/** Same total-score fallback chain as the client's getScoreValue. */
const scoreValue = (result) => Number(result.totalScore ?? result.score) || 0;

/** Client trend algorithm (useScoresData.calculateTrend), verbatim rules. */
function calculateTrend(history) {
  if (!history || history.length < 2) return { trend: "stable", values: [], direction: 0 };
  const recent = history.slice(0, 5);
  const values = recent.map((s) => s.score);
  const newest = values[0];
  const oldest = values[values.length - 1];
  const direction = oldest > 0 ? (newest - oldest) / oldest : 0;
  let trend = "stable";
  if (direction > 0.02) trend = "up";
  else if (direction < -0.02) trend = "down";
  return { trend, values: [...values].reverse(), direction };
}

/**
 * Build the standings docs from a season's recap days. Pure.
 *
 * @param {Array<Object>} recapDays fantasy_recaps day docs (any order).
 * @returns {{
 *   summary: {scoredDays: number[], lastScoredDay: number|null,
 *     stats: {recentShows: number, topScore: string, corpsActive: number, avgScore: string},
 *     classCounts: Record<string, number>},
 *   classes: Record<string, Array<Object>>,
 * }}
 */
function buildSeasonStandings(recapDays) {
  // Flatten to show entries, newest day first (ties keep in-day show order),
  // mirroring the client's allShows ordering that makes scores[0] "latest".
  const sorted = [...(recapDays || [])]
    .filter((r) => r && typeof r.offSeasonDay === "number")
    .sort((a, b) => b.offSeasonDay - a.offSeasonDay);

  const scoredDays = sorted.map((r) => r.offSeasonDay).sort((a, b) => a - b);

  const corpsMap = new Map(); // `${uid}_${class}` -> aggregate
  const uniqueCorps = new Set();
  const allScores = [];
  let showCountTotal = 0;

  for (const recap of sorted) {
    for (const show of recap.shows || []) {
      let showHasResults = false;
      for (const result of show.results || []) {
        if (!result || !result.uid || !result.corpsClass) continue;
        showHasResults = true;
        const name = result.corpsName || result.corps || "";
        uniqueCorps.add(name);
        if (result.corpsClass === "soundSport") continue;
        if (!RANKED_CLASSES.includes(result.corpsClass)) continue;

        const total = scoreValue(result);
        allScores.push(total);

        const key = `${result.uid}_${result.corpsClass}`;
        let entry = corpsMap.get(key);
        if (!entry) {
          entry = {
            corps: name,
            corpsName: name,
            corpsClass: result.corpsClass,
            uid: result.uid,
            displayName: result.displayName || "",
            avatarUrl: result.avatarUrl || null,
            history: [],
            showCount: 0,
          };
          corpsMap.set(key, entry);
        }
        entry.showCount += 1;
        // History entries carry only what shipped consumers read (captions
        // from scores[0], previous score from scores[1], day for context) —
        // no event names/dates, which would double the doc size for nothing.
        // Keeps a 1,500-corps class safely under the 1 MiB doc limit.
        if (entry.history.length < HISTORY_LIMIT) {
          entry.history.push({
            score: total,
            totalScore: total,
            geScore: Number(result.geScore) || 0,
            visualScore: Number(result.visualScore) || 0,
            musicScore: Number(result.musicScore) || 0,
            offSeasonDay: recap.offSeasonDay,
          });
        }
      }
      if (showHasResults) showCountTotal += 1;
    }
  }

  /** @type {Record<string, Array<Object>>} */
  const classes = {};
  /** @type {Record<string, number>} */
  const classCounts = {};
  for (const classKey of RANKED_CLASSES) {
    const entries = [...corpsMap.values()].filter((e) => e.corpsClass === classKey);
    if (entries.length === 0) continue;

    const rows = entries.map((entry) => {
      const latest = entry.history[0];
      return {
        rank: 0, // assigned after the sort below
        corps: entry.corps,
        corpsName: entry.corpsName,
        corpsClass: entry.corpsClass,
        uid: entry.uid,
        displayName: entry.displayName,
        avatarUrl: entry.avatarUrl,
        score: latest ? latest.score : 0,
        totalScore: latest ? latest.score : 0,
        showCount: entry.showCount,
        GE_Total: latest ? latest.geScore : 0,
        VIS_Total: latest ? latest.visualScore : 0,
        MUS_Total: latest ? latest.musicScore : 0,
        Total_Score: latest ? latest.score : 0,
        trend: calculateTrend(entry.history),
        scores: entry.history,
      };
    });

    rows.sort((a, b) => b.totalScore - a.totalScore);
    rows.forEach((row, index) => {
      row.rank = index + 1;
    });

    // Per-class caption ranks (the client computed these across the combined
    // list; per-class is the meaningful comparison and no shipped surface
    // renders the cross-class variant).
    for (const [totalKey, rankKey] of [
      ["GE_Total", "GE_Rank"],
      ["VIS_Total", "VIS_Rank"],
      ["MUS_Total", "MUS_Rank"],
    ]) {
      const order = rows
        .map((row, index) => [row[totalKey] || 0, index])
        .sort((a, b) => b[0] - a[0]);
      order.forEach(([, rowIndex], rank) => {
        rows[rowIndex][rankKey] = rank + 1;
      });
    }

    classes[classKey] = rows;
    classCounts[classKey] = rows.length;
  }

  const topScore = allScores.length > 0 ? Math.max(...allScores).toFixed(3) : "-";
  const avgScore =
    allScores.length > 0
      ? (allScores.reduce((sum, s) => sum + s, 0) / allScores.length).toFixed(3)
      : "0.000";

  return {
    summary: {
      scoredDays,
      lastScoredDay: scoredDays.length > 0 ? scoredDays[scoredDays.length - 1] : null,
      stats: {
        recentShows: showCountTotal,
        topScore,
        corpsActive: uniqueCorps.size,
        avgScore,
      },
      classCounts,
    },
    classes,
  };
}

/**
 * Read a season's recap days and publish the standings docs. Called at the
 * end of the nightly scoring run; also safe to invoke for backfill.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} seasonUid
 */
async function writeSeasonStandings(db, seasonUid) {
  const recapsSnapshot = await db.collection(`fantasy_recaps/${seasonUid}/days`).get();
  const recapDays = recapsSnapshot.docs.map((doc) => doc.data());
  const { summary, classes } = buildSeasonStandings(recapDays);

  const batch = db.batch();
  batch.set(db.doc(`fantasy_standings/${seasonUid}`), {
    seasonUid,
    ...summary,
    updatedAt: new Date(),
  });
  for (const [classKey, entries] of Object.entries(classes)) {
    batch.set(db.doc(`fantasy_standings/${seasonUid}/classes/${classKey}`), {
      seasonUid,
      classKey,
      entries,
      updatedAt: new Date(),
    });
  }
  await batch.commit();
  logger.info(
    `Materialized standings for ${seasonUid}: ${summary.scoredDays.length} days, ` +
      `${Object.keys(classes).length} classes.`
  );
}

module.exports = {
  buildSeasonStandings,
  writeSeasonStandings,
};
