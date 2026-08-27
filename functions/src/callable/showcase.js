// =============================================================================
// SHOWCASE CALLABLES — enter, get dealt a ballot, vote (UNIFORM_STUDIO.md §7.4)
// =============================================================================
// Entries and ballots live in server-only collections so pairwise voting
// stays anonymous: a voter is dealt two designs with no names attached, and
// the served pair is recorded on their ballot doc — a vote only counts
// against the exact pair the server dealt. Tokens: entering pays once per
// month; the first few votes a month pay per ballot. Finalization and the
// champion's grant-only title are the nightly pipeline's job
// (helpers/showcase.finalizeShowcase), never a client call.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { paths } = require("../helpers/paths");
const { assertAuth, assertWriteBudget, assertNotRestricted } = require("../helpers/callableGuards");
const {
  addCoinHistoryEntryToTransaction,
  TRANSACTION_TYPES,
} = require("../helpers/economy");
const {
  DESIGN_ID_RE,
  validateDesign,
  sanitizeDesign,
  colorwayStrip,
} = require("../helpers/uniformValidation");
const {
  SHOWCASE_ENTRY_REWARD,
  SHOWCASE_VOTE_REWARD,
  SHOWCASE_PAID_VOTES,
  MAX_SHOWCASE_ENTRIES,
  previousMonthId,
  themeForMonth,
  phaseFor,
  showcaseNow,
} = require("../helpers/showcase");

/** The client-facing cycle view. @param {Date} now */
function cycleView(now) {
  const { monthId, phase, votingOpensDay } = phaseFor(now);
  const theme = themeForMonth(monthId);
  return {
    monthId,
    phase,
    votingOpensDay,
    theme: { id: theme.id, title: theme.title, blurb: theme.blurb },
  };
}

/**
 * The current cycle + the caller's own entry/ballot state + last month's
 * public results, in one read. Read-only.
 */
const getShowcase = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const db = getDb();
  const now = showcaseNow();
  const { monthId } = phaseFor(now);

  const [entryDoc, voteDoc, countSnap, resultsDoc] = await Promise.all([
    db.doc(paths.showcaseEntry(monthId, uid)).get(),
    db.doc(paths.showcaseVote(monthId, uid)).get(),
    db.collection(paths.showcaseEntries(monthId)).count().get(),
    db.doc(paths.showcaseResults(previousMonthId(now))).get(),
  ]);

  const myEntry = entryDoc.exists ? entryDoc.data() : null;
  const myVotes = voteDoc.exists ? voteDoc.data() : null;
  return {
    cycle: cycleView(now),
    entryCount: countSnap.data().count,
    myEntry: myEntry
      ? { designName: myEntry.designName, submittedAt: myEntry.submittedAt }
      : null,
    myVoteCount: myVotes ? myVotes.count || 0 : 0,
    lastResults: resultsDoc.exists ? resultsDoc.data() : null,
  };
});

/**
 * Enter (or replace) the caller's design for this month's Showcase.
 * Submissions phase only; the first entry of the month pays the token.
 */
const submitShowcaseEntry = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const { designId } = request.data || {};
  if (!designId || !DESIGN_ID_RE.test(String(designId))) {
    throw new HttpsError("invalid-argument", "Invalid design id.");
  }

  const db = getDb();
  await assertWriteBudget(db, uid, "showcase");
  await assertNotRestricted(db, uid);

  const now = showcaseNow();
  const { monthId, phase } = phaseFor(now);
  if (phase !== "submissions") {
    throw new HttpsError("failed-precondition", "Submissions are closed — voting is underway.");
  }

  const designDoc = await db.doc(paths.userWardrobeDesign(uid, String(designId))).get();
  if (!designDoc.exists) {
    throw new HttpsError("not-found", "That design is not in your wardrobe.");
  }
  const design = designDoc.data();
  if (validateDesign(design).length > 0) {
    throw new HttpsError("invalid-argument", "That design failed validation — re-save it first.");
  }
  const clean = sanitizeDesign(design);

  const entryRef = db.doc(paths.showcaseEntry(monthId, uid));
  const preexisting = await entryRef.get();
  if (!preexisting.exists) {
    const countSnap = await db.collection(paths.showcaseEntries(monthId)).count().get();
    if (countSnap.data().count >= MAX_SHOWCASE_ENTRIES) {
      throw new HttpsError("resource-exhausted", "This month's Showcase is full.");
    }
  }

  const profileDoc = await db.doc(paths.userProfile(uid)).get();
  const username = (profileDoc.exists && profileDoc.data().username) || "a director";
  const profileRef = db.doc(paths.userProfile(uid));
  const nowIso = new Date().toISOString();

  const { paid } = await db.runTransaction(async (tx) => {
    const [entryNow, profileNow] = await Promise.all([tx.get(entryRef), tx.get(profileRef)]);
    const prior = entryNow.exists ? entryNow.data() : null;
    const firstEntry = !prior;
    tx.set(entryRef, {
      design: {
        schema: 2,
        name: clean.name,
        colorway: clean.colorway,
        figure: clean.figure,
      },
      designName: clean.name,
      username,
      colors: colorwayStrip(clean.colorway),
      wins: prior ? prior.wins || 0 : 0,
      losses: prior ? prior.losses || 0 : 0,
      submittedAt: prior ? prior.submittedAt || nowIso : nowIso,
      updatedAt: nowIso,
    });
    if (firstEntry && profileNow.exists) {
      const newBalance = (profileNow.data().corpsCoin || 0) + SHOWCASE_ENTRY_REWARD;
      tx.update(profileRef, { corpsCoin: newBalance });
      addCoinHistoryEntryToTransaction(tx, db, uid, {
        type: TRANSACTION_TYPES.SHOWCASE_ENTRY,
        amount: SHOWCASE_ENTRY_REWARD,
        balance: newBalance,
        description: `Showcase entered: ${themeForMonth(monthId).title} (${monthId})`,
      });
    }
    return { paid: firstEntry };
  });

  logger.info(`Showcase ${monthId}: entry from ${uid}`, { paid });
  return {
    message: paid
      ? `You're in — +${SHOWCASE_ENTRY_REWARD} CorpsCoin. Voting opens on the 21st.`
      : "Entry updated.",
    paid,
  };
});

/**
 * Deal the caller an anonymous pair to judge. Voting phase only. The served
 * pair is stored on the caller's ballot doc; castShowcaseVote only accepts a
 * verdict on that exact pair.
 */
const getShowcasePair = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const db = getDb();
  await assertWriteBudget(db, uid, "showcase", { max: 120 });

  const now = showcaseNow();
  const { monthId, phase } = phaseFor(now);
  if (phase !== "voting") {
    throw new HttpsError("failed-precondition", "Voting has not opened yet.");
  }

  // Refs only (no field data) — cheap even at the entry cap.
  const refs = await db.collection(paths.showcaseEntries(monthId)).listDocuments();
  const eligible = refs.filter((ref) => ref.id !== uid);
  if (eligible.length < 2) {
    throw new HttpsError("failed-precondition", "Not enough entries to vote on yet.");
  }
  const first = Math.floor(Math.random() * eligible.length);
  let second = Math.floor(Math.random() * (eligible.length - 1));
  if (second >= first) second += 1;

  const [aDoc, bDoc] = await Promise.all([eligible[first].get(), eligible[second].get()]);
  if (!aDoc.exists || !bDoc.exists) {
    throw new HttpsError("unavailable", "The ballot changed — try again.");
  }

  await db.doc(paths.showcaseVote(monthId, uid)).set(
    { pending: { a: aDoc.id, b: bDoc.id, servedAt: new Date().toISOString() } },
    { merge: true }
  );

  // Anonymized: the design only, never the designer.
  return {
    monthId,
    pair: [
      { key: "a", design: aDoc.data().design },
      { key: "b", design: bDoc.data().design },
    ],
  };
});

/** Record the caller's verdict on the pair they were dealt. */
const castShowcaseVote = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const { pick } = request.data || {};
  if (pick !== "a" && pick !== "b") {
    throw new HttpsError("invalid-argument", "Pick 'a' or 'b'.");
  }

  const db = getDb();
  await assertWriteBudget(db, uid, "showcase", { max: 120 });
  await assertNotRestricted(db, uid);

  const now = showcaseNow();
  const { monthId, phase } = phaseFor(now);
  if (phase !== "voting") {
    throw new HttpsError("failed-precondition", "Voting is closed.");
  }

  const voteRef = db.doc(paths.showcaseVote(monthId, uid));
  const profileRef = db.doc(paths.userProfile(uid));

  const { paid, count } = await db.runTransaction(async (tx) => {
    const [voteDoc, profileNow] = await Promise.all([tx.get(voteRef), tx.get(profileRef)]);
    const ballot = voteDoc.exists ? voteDoc.data() : {};
    const pending = ballot.pending;
    if (!pending || !pending.a || !pending.b) {
      throw new HttpsError("failed-precondition", "No ballot in hand — deal a pair first.");
    }
    const winnerId = pick === "a" ? pending.a : pending.b;
    const loserId = pick === "a" ? pending.b : pending.a;
    const [winnerDoc, loserDoc] = await Promise.all([
      tx.get(db.doc(paths.showcaseEntry(monthId, winnerId))),
      tx.get(db.doc(paths.showcaseEntry(monthId, loserId))),
    ]);
    if (!winnerDoc.exists || !loserDoc.exists) {
      // an entry vanished (admin removal); clear the stale ballot
      tx.set(voteRef, { pending: null }, { merge: true });
      throw new HttpsError("unavailable", "That pair is gone — deal a new one.");
    }

    const votesSoFar = ballot.count || 0;
    const payThis = votesSoFar < SHOWCASE_PAID_VOTES;
    tx.update(winnerDoc.ref, { wins: (winnerDoc.data().wins || 0) + 1 });
    tx.update(loserDoc.ref, { losses: (loserDoc.data().losses || 0) + 1 });
    tx.set(
      voteRef,
      {
        pending: null,
        count: votesSoFar + 1,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    if (payThis && profileNow.exists) {
      const newBalance = (profileNow.data().corpsCoin || 0) + SHOWCASE_VOTE_REWARD;
      tx.update(profileRef, { corpsCoin: newBalance });
      addCoinHistoryEntryToTransaction(tx, db, uid, {
        type: TRANSACTION_TYPES.SHOWCASE_VOTE,
        amount: SHOWCASE_VOTE_REWARD,
        balance: newBalance,
        description: `Showcase ballot cast (${monthId})`,
      });
    }
    return { paid: payThis, count: votesSoFar + 1 };
  });

  return {
    message: paid ? `Vote counted — +${SHOWCASE_VOTE_REWARD} CorpsCoin.` : "Vote counted.",
    paid,
    voteCount: count,
  };
});

module.exports = {
  getShowcase,
  submitShowcaseEntry,
  getShowcasePair,
  castShowcaseVote,
};
