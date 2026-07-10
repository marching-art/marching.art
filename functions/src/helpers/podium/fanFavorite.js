/**
 * Fan Favorite (design §14.1.5, decision 30) — the FMA community ritual,
 * productized as a two-level ballot. Purely cosmetic: zero score impact.
 *
 *   PRELIMS — each major (Southwestern day 28, Southeastern day 35, the
 *   Eastern Classic days 41-42) opens a ballot for `voteWindowDays` days.
 *   Any signed-in user casts ONE vote per major for any Podium corps that
 *   performed there. The top `finalistsPerMajor` per major advance.
 *
 *   FINALS — championship week (from `finalsFromDay`), one ballot across
 *   the union of finalists. The winner is crowned at season archival:
 *   banner on the season record, Fan Favorite trophy on the profile.
 *
 * Ballots: podium-fan/{seasonUid}/ballots/{voterUid} (server-only — votes
 * are private). Tallies/finalists/winner: podium-fan/{seasonUid} (public).
 */

const { logger } = require("firebase-functions/v2");
const store = require("./store");

const MAJORS = [28, 35, 41]; // 41 covers the two-night Eastern (41-42)

function fanDocRef(db, seasonUid) {
  return db.doc(`podium-fan/${seasonUid}`);
}

function ballotRef(db, seasonUid, voterUid) {
  return db.doc(`podium-fan/${seasonUid}/ballots/${voterUid}`);
}

/** The major whose prelims ballot is open on `competitionDay`, or null. */
function openPrelimsMajor(competitionDay, cfg) {
  const window = cfg.fanFavorite.voteWindowDays;
  for (const major of MAJORS) {
    const lastNight = major === 41 ? 42 : major; // Eastern spans two nights
    if (competitionDay >= major && competitionDay <= lastNight + window - 1) {
      return major;
    }
  }
  return null;
}

/** True while the finals ballot is open. */
function finalsOpen(competitionDay, cfg) {
  return competitionDay >= cfg.fanFavorite.finalsFromDay && competitionDay <= 49;
}

/** Podium corps that performed at a major: {uid, corpsName, division}. */
async function candidatesForMajor(db, seasonUid, majorDay) {
  const days = majorDay === 41 ? [41, 42] : [majorDay];
  const seen = new Map();
  for (const day of days) {
    const recap = await store.recapDayRef(db, seasonUid, day).get();
    for (const result of (recap.exists && recap.data().results) || []) {
      if (result.uid && !seen.has(result.uid)) {
        seen.set(result.uid, {
          uid: result.uid,
          corpsName: result.corpsName || null,
          division: result.division || "aClass",
        });
      }
    }
  }
  return [...seen.values()];
}

/** Tally every ballot's votes for one prelims major (or the finals). */
async function tally(db, seasonUid, field) {
  const snapshot = await db.collection(`podium-fan/${seasonUid}/ballots`).get();
  const counts = {};
  for (const doc of snapshot.docs) {
    const vote = field === "finals" ? doc.data().finals : (doc.data().prelims || {})[field];
    if (vote) counts[vote] = (counts[vote] || 0) + 1;
  }
  return counts;
}

/**
 * Compute + publish the finalists (called once, at the end of the last
 * prelims window — the Day-44 processor run). Idempotent.
 */
async function publishFinalists(db, seasonUid, cfg) {
  const fanRef = fanDocRef(db, seasonUid);
  const existing = await fanRef.get();
  if (existing.exists && existing.data().finalists) return existing.data().finalists;

  const finalists = new Map();
  for (const major of MAJORS) {
    const counts = await tally(db, seasonUid, String(major));
    const candidates = await candidatesForMajor(db, seasonUid, major);
    const byUid = Object.fromEntries(candidates.map((c) => [c.uid, c]));
    const top = Object.entries(counts)
      .filter(([uid]) => byUid[uid])
      .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
      .slice(0, cfg.fanFavorite.finalistsPerMajor);
    for (const [uid, votes] of top) {
      const prior = finalists.get(uid);
      finalists.set(uid, {
        ...byUid[uid],
        prelimVotes: (prior ? prior.prelimVotes : 0) + votes,
        fromMajors: [...(prior ? prior.fromMajors : []), major],
      });
    }
  }
  const list = [...finalists.values()].sort((a, b) => b.prelimVotes - a.prelimVotes);
  await fanRef.set(
    { seasonUid, finalists: list, finalistsPublishedAt: new Date().toISOString() },
    { merge: true }
  );
  logger.info(`[podium] Fan Favorite finalists published: ${list.length}`);
  return list;
}

/**
 * Crown the winner at season archival. Idempotent; returns the winner or
 * null when there were no finals votes (falls back to prelim vote order).
 */
async function crownWinner(db, seasonUid) {
  const fanRef = fanDocRef(db, seasonUid);
  const snapshot = await fanRef.get();
  if (!snapshot.exists) return null;
  const data = snapshot.data();
  if (data.winner) return data.winner;
  const finalists = data.finalists || [];
  if (finalists.length === 0) return null;

  const counts = await tally(db, seasonUid, "finals");
  const eligible = new Set(finalists.map((f) => f.uid));
  const ranked = Object.entries(counts)
    .filter(([uid]) => eligible.has(uid))
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
  const winnerUid = ranked.length > 0 ? ranked[0][0] : finalists[0].uid;
  const winner = {
    ...finalists.find((f) => f.uid === winnerUid),
    finalsVotes: ranked.length > 0 ? ranked[0][1] : 0,
  };
  await fanRef.set({ winner, crownedAt: new Date().toISOString() }, { merge: true });

  // Cosmetic hardware: a Fan Favorite entry in the profile trophy case and
  // a banner flag on the Podium display copy. Never score, never budget.
  try {
    const profileSnapshot = await store.profileRef(db, winnerUid).get();
    const existing =
      (profileSnapshot.exists &&
        profileSnapshot.data().trophies &&
        profileSnapshot.data().trophies.fanFavorites) ||
      [];
    if (!existing.some((t) => t && t.seasonName === seasonUid)) {
      await store.profileRef(db, winnerUid).set(
        {
          trophies: {
            fanFavorites: [
              ...existing,
              {
                type: "fanFavorite",
                corpsClass: "podiumClass",
                seasonName: seasonUid,
                corpsName: winner.corpsName,
                votes: winner.finalsVotes,
              },
            ],
          },
        },
        { merge: true }
      );
    }
  } catch (error) {
    logger.warn(`[podium] Fan Favorite trophy write failed: ${error.message}`);
  }
  logger.info(`[podium] Fan Favorite: ${winner.corpsName} (${winnerUid})`);
  return winner;
}

module.exports = {
  MAJORS,
  fanDocRef,
  ballotRef,
  openPrelimsMajor,
  finalsOpen,
  candidatesForMajor,
  tally,
  publishFinalists,
  crownWinner,
};
