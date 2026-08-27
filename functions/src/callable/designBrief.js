// =============================================================================
// DESIGN BRIEF CALLABLES — the weekly styling side game (UNIFORM_STUDIO.md §7.4)
// =============================================================================
// getDesignBrief serves this week's brief, the caller's entry, and the top of
// the public leaderboard in one read. submitDesignBrief scores one of the
// caller's saved designs against the brief (deterministic trait scoring —
// helpers/designBrief.js), keeps their best score of the week, and pays the
// small participation token on their first scored submission. Cosmetic side
// game: no competitive scores are touched, the reward is a fixed weekly CC
// token, and the leaderboard is bragging rights.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { paths } = require("../helpers/paths");
const { assertAuth, assertWriteBudget, clampLimit } = require("../helpers/callableGuards");
const {
  addCoinHistoryEntryToTransaction,
  TRANSACTION_TYPES,
} = require("../helpers/economy");
const {
  DESIGN_ID_RE,
  validateDesign,
  colorwayStrip,
} = require("../helpers/uniformValidation");
const { BRIEF_REWARD, weekIdFor, briefForWeek, scoreBrief } = require("../helpers/designBrief");

/** The client-facing brief view (id + prose + wants, never the tag lists). */
function briefView(weekId) {
  const brief = briefForWeek(weekId);
  return {
    weekId,
    id: brief.id,
    title: brief.title,
    blurb: brief.blurb,
    wants: brief.wants.map((w) => ({ label: w.label, points: w.points })),
  };
}

/**
 * This week's brief + the caller's entry + the top of the leaderboard.
 * Read-only (exempt from the write-budget census).
 */
const getDesignBrief = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const db = getDb();
  const weekId = weekIdFor(new Date());
  const limit = clampLimit(request.data?.limit, { fallback: 10, max: 25 });

  const [mineDoc, topSnap] = await Promise.all([
    db.doc(paths.briefEntry(weekId, uid)).get(),
    db.collection(paths.briefEntries(weekId)).orderBy("score", "desc").limit(limit).get(),
  ]);

  return {
    brief: briefView(weekId),
    myEntry: mineDoc.exists ? mineDoc.data() : null,
    top: topSnap.docs.map((d) => {
      const { username, designName, colors, score, updatedAt } = d.data();
      return { uid: d.id, username, designName, colors, score, updatedAt };
    }),
  };
});

/**
 * Score one of the caller's saved designs against this week's brief. The
 * stored entry keeps the WEEK'S BEST score (resubmitting a worse design never
 * lowers it); the first scored submission of the week pays the token.
 */
const submitDesignBrief = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const { designId } = request.data || {};
  if (!designId || !DESIGN_ID_RE.test(String(designId))) {
    throw new HttpsError("invalid-argument", "Invalid design id.");
  }

  const db = getDb();
  await assertWriteBudget(db, uid, "designBrief");

  const designDoc = await db.doc(paths.userWardrobeDesign(uid, String(designId))).get();
  if (!designDoc.exists) {
    throw new HttpsError("not-found", "That design is not in your wardrobe.");
  }
  const design = designDoc.data();
  if (validateDesign(design).length > 0) {
    throw new HttpsError("invalid-argument", "That design failed validation — re-save it first.");
  }

  const weekId = weekIdFor(new Date());
  const brief = briefForWeek(weekId);
  const { score, matched, missed } = scoreBrief(brief, design);

  const profileDoc = await db.doc(paths.userProfile(uid)).get();
  const username = (profileDoc.exists && profileDoc.data().username) || "a director";

  const entryRef = db.doc(paths.briefEntry(weekId, uid));
  const profileRef = db.doc(paths.userProfile(uid));
  const now = new Date().toISOString();

  const { paid, best } = await db.runTransaction(async (tx) => {
    const [entryDoc, profileNow] = await Promise.all([tx.get(entryRef), tx.get(profileRef)]);
    const prior = entryDoc.exists ? entryDoc.data() : null;
    const firstOfWeek = !prior;
    const bestScore = Math.max(score, prior ? prior.score || 0 : 0);
    // keep the entry describing the BEST-scoring submission, not the latest
    const describeThisRun = !prior || score >= (prior.score || 0);
    tx.set(entryRef, {
      score: bestScore,
      briefId: brief.id,
      username,
      designName: describeThisRun ? design.name : prior.designName,
      designId: describeThisRun ? designDoc.id : prior.designId,
      colors: describeThisRun ? colorwayStrip(design.colorway) : prior.colors,
      submissions: (prior ? prior.submissions || 0 : 0) + 1,
      createdAt: prior ? prior.createdAt || now : now,
      updatedAt: now,
    });
    if (firstOfWeek && profileNow.exists) {
      const newBalance = (profileNow.data().corpsCoin || 0) + BRIEF_REWARD;
      tx.update(profileRef, { corpsCoin: newBalance });
      addCoinHistoryEntryToTransaction(tx, db, uid, {
        type: TRANSACTION_TYPES.DESIGN_BRIEF,
        amount: BRIEF_REWARD,
        balance: newBalance,
        description: `Design Brief entered: ${brief.title} (${weekId})`,
      });
    }
    return { paid: firstOfWeek, best: bestScore };
  });

  logger.info(`Design Brief ${brief.id}/${weekId}: ${uid} scored ${score}`, { paid });
  return {
    brief: briefView(weekId),
    score,
    best,
    matched,
    missed,
    paid,
    message: paid
      ? `Scored ${score}/100 — +${BRIEF_REWARD} CorpsCoin for entering this week.`
      : `Scored ${score}/100${best > score ? ` (your week's best stays ${best})` : ""}.`,
  };
});

module.exports = { getDesignBrief, submitDesignBrief };
