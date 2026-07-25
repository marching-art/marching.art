/**
 * Fan Favorite → Discord (decision 30).
 *
 * The Fan Favorite ballot is a community ritual, and the community lives in
 * Discord — a ballot nobody knows is open collects nobody's vote. Three
 * announcements post to the server's #announcements channel:
 *
 *   1. PRELIMS OPEN — the night a major's scores land, that major's ballot
 *      opens: the candidate field by division, and the day voting closes.
 *   2. FINALS OPEN — the night finalists publish (Day 44): each major's
 *      prelims RESULTS with vote counts, plus the finals ballot.
 *   3. CROWNED — at season archival: the finals results and the winner.
 *
 * The webhook is its OWN secret (DISCORD_ANNOUNCEMENTS_WEBHOOK_URL), separate
 * from the nightly score drop's scores-channel webhook: these are event posts
 * for a different channel, and either can be rotated or switched off without
 * touching the other. Unset/empty disables the announcements only.
 *
 * Each post is guarded by its own scoringRunGuard lease
 * (`{seasonUid}_fanfav_{event}`), so the nightly stage re-runs every night —
 * and the scheduler retries it — without ever double-posting. A failed post
 * marks the lease failed, so tomorrow night re-claims and re-posts.
 *
 * Isolation contract, same as the score drop: nothing here throws into the
 * caller. Ballots, scoring and archival never depend on Discord being up.
 */

const {
  discordAnnouncementsWebhookUrl,
  COLORS,
  clampName,
  joinLines,
  place,
  link,
  payloadOf,
  postOnce,
} = require("../discord");
const fanFavorite = require("./fanFavorite");

const MAJOR_LABELS = {
  28: "Southwestern Championship",
  35: "Southeastern Championship",
  41: "Eastern Classic",
};

const DIVISION_LABELS = { worldClass: "World Class", openClass: "Open Class", aClass: "A Class" };
const DIVISION_ORDER = ["worldClass", "openClass", "aClass"];

/**
 * The competition day each major's ballot is ANNOUNCED on, mapped to the major
 * it belongs to. Southwestern and Southeastern announce the night they are
 * scored; the Eastern Classic announces on its SECOND night (42) because the
 * candidate field isn't complete until both nights' recaps land. Voting is
 * open in-app from day 41 either way, and the window runs through day 44, so
 * the day-42 post still leaves the ballot's whole tail.
 */
const ANNOUNCE_DAY_TO_MAJOR = { 28: 28, 35: 35, 42: 41 };

const PODIUM_URL = link("/podium");

// Log tag on every announcement this module posts.
const TAG = "fan-favorite";

/** The major whose ballot is announced on `competitionDay`, or null. */
function majorAnnouncedOn(competitionDay) {
  return ANNOUNCE_DAY_TO_MAJOR[competitionDay] || null;
}

/** "1 vote" / "12 votes" — counts are the whole point of a results post. */
function votes(count) {
  const n = Number(count) || 0;
  return `${n} vote${n === 1 ? "" : "s"}`;
}

/** Ranked "medal — corps — votes" lines for a published tally. */
function resultLines(rows) {
  return rows.map((row, index) => `${place(index)} **${clampName(row.corpsName)}** — ${votes(row.votes)}`);
}

/**
 * "The ballot for {major} is open" — the candidate field by division.
 *
 * @param {Object} params
 * @param {string} params.seasonName
 * @param {number} params.major
 * @param {Array<{corpsName: string, division: string}>} params.candidates
 * @param {number} params.closesOnDay - Last competition day votes are taken.
 * @returns {Object|null} Webhook payload, or null when nobody performed.
 */
function buildBallotOpenPayload({ seasonName, major, candidates, closesOnDay }) {
  const list = (candidates || []).filter((c) => c && c.corpsName);
  if (list.length === 0) return null;

  const label = MAJOR_LABELS[major] || `Day ${major}`;
  const fields = [];
  for (const division of DIVISION_ORDER) {
    const inDivision = list.filter((c) => (c.division || "aClass") === division);
    if (inDivision.length === 0) continue;
    fields.push({
      name: `${DIVISION_LABELS[division]} (${inDivision.length})`,
      value: joinLines(inDivision.map((c) => `• ${clampName(c.corpsName)}`)),
    });
  }

  return payloadOf(
    {
      title: `🗳️ Fan Favorite ballot — ${label}`,
      url: PODIUM_URL,
      description:
        `${seasonName} — voting is open for the corps that stole the show at the ${label}. ` +
        `One vote each, and you don't need a corps to cast it. ` +
        `The ballot closes after Day ${closesOnDay}. Cosmetic only — zero score impact.`,
      color: COLORS.fan,
      fields,
      footer: { text: `${list.length} corps on the ballot · vote on the Podium page` },
    }
  );
}

/**
 * "The finals ballot is set" — each major's prelims results, then the
 * finalists those polls produced.
 *
 * @param {Object} params
 * @param {string} params.seasonName
 * @param {Array<{corpsName: string, prelimVotes: number}>} params.finalists
 * @param {Object<string, Array<{corpsName: string, votes: number}>>} [params.prelimsResults]
 * @returns {Object|null}
 */
function buildFinalsOpenPayload({ seasonName, finalists, prelimsResults }) {
  const list = (finalists || []).filter((f) => f && f.corpsName);
  if (list.length === 0) return null;

  const fields = [];
  for (const major of fanFavorite.MAJORS) {
    const rows = ((prelimsResults || {})[String(major)] || []).filter((r) => r && r.corpsName);
    if (rows.length === 0) continue;
    fields.push({
      name: `${MAJOR_LABELS[major] || `Day ${major}`} — prelims results`,
      value: joinLines(resultLines(rows)),
    });
  }
  fields.push({
    name: `Finalists (${list.length})`,
    value: joinLines(
      list.map((f) => `• **${clampName(f.corpsName)}** — ${votes(f.prelimVotes)} in prelims`)
    ),
  });

  return payloadOf({
    title: "🏆 Fan Favorite finals — the ballot is set",
    url: PODIUM_URL,
    description:
      `${seasonName} — the prelims polls are in and the finals ballot is open for ` +
      `championship week. One vote each, everyone eligible, winner crowned when the ` +
      `season is archived.`,
    color: COLORS.fan,
    fields,
    footer: { text: "Vote on the Podium page · cosmetic only" },
  });
}

/**
 * "{corps} is the Fan Favorite" — the finals results and the crown.
 *
 * @param {Object} params
 * @param {string} params.seasonName
 * @param {{corpsName: string, finalsVotes: number}} params.winner
 * @param {Array<{corpsName: string, votes: number}>} [params.finalsResults]
 * @returns {Object|null}
 */
function buildWinnerPayload({ seasonName, winner, finalsResults }) {
  if (!winner || !winner.corpsName) return null;

  const rows = (finalsResults || []).filter((r) => r && r.corpsName);
  const fields =
    rows.length > 0 ? [{ name: "Finals results", value: joinLines(resultLines(rows)) }] : [];
  // A finals ballot nobody voted in falls back to prelim vote order
  // (fanFavorite.crownWinner) — say so rather than claiming zero votes won it.
  const margin =
    Number(winner.finalsVotes) > 0
      ? `with ${votes(winner.finalsVotes)} in the finals`
      : "on the strength of the prelims ballots — the finals drew no votes";

  return payloadOf({
    title: `💗 ${clampName(winner.corpsName)} is the ${seasonName} Fan Favorite`,
    url: PODIUM_URL,
    description:
      `The community's ballot is closed. **${clampName(winner.corpsName)}** takes the crown ` +
      `${margin}. The trophy goes to their director's case and onto the season record — ` +
      `hardware voted for entirely by the room.`,
    color: COLORS.fan,
    fields,
    footer: { text: "Fan Favorite · cosmetic, and the one trophy the field can't score for" },
  });
}

/**
 * Announce whatever the season's ballot state calls for tonight: a newly
 * opened prelims ballot, the finals ballot with its prelims results, and (for
 * a season crowned in this same doc) the winner. Every branch is
 * lease-guarded, so calling this nightly is the intended usage.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Object} params
 * @param {string} params.seasonUid
 * @param {string} params.seasonName
 * @param {number} params.competitionDay
 * @param {Object} params.cfg - store.balance (fanFavorite window config).
 * @param {string} params.webhookUrl
 * @param {typeof fetch} [params.fetchImpl]
 * @returns {Promise<Array<Object>>} One entry per announcement considered.
 */
async function announceFanFavorite(
  db,
  { seasonUid, seasonName, competitionDay, cfg, webhookUrl, fetchImpl }
) {
  const announcements = [];
  const fanSnapshot = await fanFavorite.fanDocRef(db, seasonUid).get();
  const fanData = fanSnapshot.exists ? fanSnapshot.data() : {};

  // 1. A major's prelims ballot opened tonight.
  const major = majorAnnouncedOn(competitionDay);
  if (major && !fanData.winner) {
    const candidates = await fanFavorite.candidatesForMajor(db, seasonUid, major);
    const payload = buildBallotOpenPayload({
      seasonName,
      major,
      candidates,
      closesOnDay: fanFavorite.prelimsClosesOn(major, cfg),
    });
    announcements.push(
      payload
        ? await postOnce(db, {
            kind: "prelims-open",
            tag: TAG,
            leaseKey: `${seasonUid}_fanfav_prelims`,
            leaseDay: major,
            payload,
            webhookUrl,
            fetchImpl,
          })
        : { kind: "prelims-open", status: "no-candidates", major }
    );
  }

  // 2. Finalists are published: the prelims results + the finals ballot.
  if ((fanData.finalists || []).length > 0 && !fanData.winner) {
    const payload = buildFinalsOpenPayload({
      seasonName,
      finalists: fanData.finalists,
      prelimsResults: fanData.prelimsResults,
    });
    if (payload) {
      announcements.push(
        await postOnce(db, {
          kind: "finals-open",
          tag: TAG,
          leaseKey: `${seasonUid}_fanfav_finals`,
          leaseDay: 0,
          payload,
          webhookUrl,
          fetchImpl,
        })
      );
    }
  }

  // 3. Crowned (normally announced for the PREVIOUS season — see
  //    announceFanFavoriteWinner — but honored here too if a season is
  //    crowned while it is still the active one).
  if (fanData.winner) {
    announcements.push(
      await announceFanFavoriteWinner(db, {
        seasonUid,
        seasonName,
        webhookUrl,
        fetchImpl,
        fanData,
      })
    );
  }

  return announcements;
}

/**
 * Announce a season's crowned Fan Favorite. Crowning happens at archival —
 * i.e. on the first night of the NEXT season — so the nightly stage calls
 * this for the previous season, passing its already-read doc when it has one.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Object} params
 * @param {string} params.seasonUid
 * @param {string} params.seasonName
 * @param {string} params.webhookUrl
 * @param {typeof fetch} [params.fetchImpl]
 * @param {Object} [params.fanData] - Pre-read podium-fan doc, to save a read.
 * @returns {Promise<{kind: string, status: string, [k: string]: unknown}>}
 */
async function announceFanFavoriteWinner(
  db,
  { seasonUid, seasonName, webhookUrl, fetchImpl, fanData = null }
) {
  let data = fanData;
  if (!data) {
    const snapshot = await fanFavorite.fanDocRef(db, seasonUid).get();
    data = snapshot.exists ? snapshot.data() : {};
  }
  if (!data.winner) return { kind: "crowned", status: "no-winner", seasonUid };

  const payload = buildWinnerPayload({
    seasonName,
    winner: data.winner,
    finalsResults: data.finalsResults,
  });
  if (!payload) return { kind: "crowned", status: "no-winner", seasonUid };

  return postOnce(db, {
    kind: "crowned",
    tag: TAG,
    leaseKey: `${seasonUid}_fanfav_winner`,
    leaseDay: 0,
    payload,
    webhookUrl,
    fetchImpl,
  });
}

module.exports = {
  discordAnnouncementsWebhookUrl,
  MAJOR_LABELS,
  ANNOUNCE_DAY_TO_MAJOR,
  majorAnnouncedOn,
  joinLines,
  buildBallotOpenPayload,
  buildFinalsOpenPayload,
  buildWinnerPayload,
  announceFanFavorite,
  announceFanFavoriteWinner,
};
