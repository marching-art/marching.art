/**
 * The Podium Class score drop → #scores.
 *
 * The fantasy classes have had a nightly "results are in" post since the
 * channel existed (helpers/scoreDrop.js). Podium — the class with the most
 * invested players, a corps they rehearse day by day — scored every night into
 * a page nobody was told had updated. This is the other half of that habit.
 *
 * It is a SEPARATE post from the fantasy drop, not another embed on it:
 *   - The two boards are never cross-ranked (PODIUM.md §7.2), and one message
 *     mixing both invites exactly that comparison.
 *   - They are scored by different jobs at different hours — Podium at 9 PM ET
 *     nightly, the fantasy drop at the night's own drop time — so there is no
 *     single moment that could carry both.
 * Same channel, though: a score drop is a score drop, and a director who
 * follows one follows the other.
 *
 * Podium is scored PER SHOW (design §5.4): a corps' placement means something
 * only against the corps that stood on the same field, so this reads out the
 * night show by show and never composes a cross-show ranking. Divisions are
 * named per row rather than sectioned — a tour night can be one show or a
 * dozen, and a dozen sectioned shows is not a post anyone reads.
 *
 * Championship week appends the cut the night decided, straight off
 * `recap.championshipCut` — the same field the recap sheet renders, published
 * by the processor from the function the next round's gate calls
 * (store.championshipCutFor). Nothing here re-derives who advances.
 *
 * Lease-guarded per (season, day) like every other announcement, so the
 * nightly stage can run as often as it likes and the channel sees one post.
 */

const { logger } = require("firebase-functions/v2");
const { COLORS, MEDALS, clampName, joinLines, link, payloadOf, postOnce } = require("../discord");
const divisions = require("./divisions");

const TAG = "podium-drop";
const SCORES_URL = link("/scores?tab=podium");

// A tour night can carry many self-selected shows. Beyond this the post stops
// being readable, so the biggest fields lead and the rest are counted in the
// footer — Discord's 25-field ceiling is never the thing that decides.
const MAX_SHOWS = 6;
// Per show: the podium, the way a recap box is read out loud.
const PLACES_PER_SHOW = 3;

/** Division initial for a row — "World", "Open", "A". */
function divisionLabel(division) {
  return (divisions.DIVISION_LABELS[divisions.normalizeDivision(division)] || "").replace(
    " Class",
    ""
  );
}

/**
 * A night's shows, biggest field first, with each show's results ranked.
 *
 * The recap already stores results ranked and placed per show; this re-sorts
 * defensively (a legacy or hand-repaired recap is not guaranteed ordered) and
 * counts the night.
 *
 * @param {Object} recap - podium-recaps/{seasonUid}/days/{day} doc data.
 * @returns {{shows: Array<{eventName: ?string, location: ?string, results: Array}>,
 *   showCount: number, corpsCount: number, topScore: ?number}}
 */
function aggregatePodiumNight(recap) {
  const shows = ((recap && recap.shows) || [])
    .map((show) => ({
      eventName: show.eventName || null,
      location: show.location || null,
      results: [...(show.results || [])]
        .filter((row) => row && row.corpsName)
        .sort((a, b) => (Number(b.totalScore) || 0) - (Number(a.totalScore) || 0)),
    }))
    .filter((show) => show.results.length > 0)
    .sort((a, b) => b.results.length - a.results.length);

  const corpsCount = shows.reduce((sum, show) => sum + show.results.length, 0);
  // The night's best number, across shows. Not a ranking — the corps that
  // posted it beat only the field it stood in front of — but it IS the number
  // the channel argues about, and hiding it would be precious.
  const topScore = shows.length
    ? Math.max(...shows.map((show) => Number(show.results[0].totalScore) || 0))
    : null;

  return { shows, showCount: shows.length, corpsCount, topScore };
}

/** "🥇 **Blue Devils** — 92.150 · World · DirectorDan" */
function resultLines(results) {
  return results.slice(0, PLACES_PER_SHOW).map((row, index) => {
    const division = divisionLabel(row.division);
    const director = row.displayName ? ` · ${clampName(row.displayName, 24)}` : "";
    const score = Number(row.totalScore);
    const total = Number.isFinite(score) ? ` — ${score.toFixed(3)}` : "";
    return `${MEDALS[index]} **${clampName(row.corpsName, 40)}**${total}${
      division ? ` · ${division}` : ""
    }${director}`;
  });
}

/**
 * Build the night's Podium drop, or null when there is nothing to announce
 * (a rest night, spring training, an empty or joint-rehearsals-only recap).
 *
 * @param {Object} params
 * @param {Object} params.recap - The day's podium recap doc.
 * @param {string} params.seasonName
 * @param {number} params.competitionDay
 * @returns {?Object} A Discord webhook payload.
 */
function buildPodiumScoreDropPayload({ recap, seasonName, competitionDay }) {
  const { shows, showCount, corpsCount, topScore } = aggregatePodiumNight(recap);
  if (showCount === 0) return null;

  const fields = shows.slice(0, MAX_SHOWS).map((show) => {
    const where = show.location ? ` · ${clampName(show.location, 28)}` : "";
    return {
      name: `${clampName(show.eventName || "Podium Class Tour Stop", 60)}${where} (${
        show.results.length
      })`,
      value: joinLines(resultLines(show.results)),
    };
  });

  const showWord = showCount === 1 ? "show" : "shows";
  const embed = {
    title: `🏟️ Day ${competitionDay} Podium Class Scores`,
    url: SCORES_URL,
    description:
      `${seasonName} — ${corpsCount} corps performed at ${showCount} ${showWord} tonight` +
      `${topScore != null ? `, high score ${topScore.toFixed(3)}` : ""}. ` +
      "Every show is ranked on its own field; full sheets on marching.art.",
    color: COLORS.scores,
    fields,
  };

  const hidden = showCount - fields.length;
  if (hidden > 0) {
    embed.footer = { text: `Plus ${hidden} more ${hidden === 1 ? "show" : "shows"} on the sheet` };
  }

  return payloadOf(embed);
}

/**
 * The championship-week cut embed, from the cut the processor published with
 * this recap. Returns null on the other 46 nights.
 *
 * Deliberately reads the stored field instead of recomputing: the recap sheet,
 * the next round's gate, and this post are then three renderings of one
 * decision rather than three chances to disagree.
 *
 * @param {Object} recap - The day's podium recap doc.
 * @param {Object} params
 * @param {string} params.seasonName
 * @returns {?Object} A Discord embed, for the drop to append.
 */
function buildPodiumCutEmbed(recap, { seasonName }) {
  const cut = recap && recap.championshipCut;
  if (!cut || !Array.isArray(cut.uids) || cut.uids.length === 0) return null;

  // Name the advancing corps from tonight's rows — the cut stores uids only,
  // and a list of uids is not an announcement.
  const nameByUid = new Map();
  for (const show of (recap && recap.shows) || []) {
    for (const row of show.results || []) {
      if (row && row.uid && !nameByUid.has(row.uid)) nameByUid.set(row.uid, row);
    }
  }
  const advancing = cut.uids
    .map((uid) => nameByUid.get(uid))
    .filter(Boolean)
    .sort((a, b) => (Number(b.totalScore) || 0) - (Number(a.totalScore) || 0));
  if (advancing.length === 0) return null;

  const lines = advancing.map((row, index) => {
    const division = divisionLabel(row.division);
    const score = Number(row.totalScore);
    return (
      `${index + 1}. **${clampName(row.corpsName, 40)}**` +
      `${Number.isFinite(score) ? ` — ${score.toFixed(3)}` : ""}${division ? ` · ${division}` : ""}`
    );
  });

  const missed =
    cut.missedCount > 0 && typeof cut.cutLine === "number"
      ? ` ${cut.missedCount} ${cut.missedCount === 1 ? "corps misses" : "corps miss"} the cut, at ` +
        `${cut.cutLine.toFixed(3)}.`
      : "";

  return {
    title: `✂️ The Podium field is set — ${clampName(cut.eventName || "", 80)}`,
    url: SCORES_URL,
    description:
      `${seasonName} — Day ${cut.toDay}. ${clampName(cut.rule || "", 100)}. ` +
      `${advancing.length} advance.${missed}`,
    color: COLORS.cut,
    fields: [{ name: `Advancing (${advancing.length})`, value: joinLines(lines) }],
  };
}

/**
 * Post tonight's Podium score drop, at most once per (season, day).
 *
 * Safe to call every night, scored or not: spring training, rest nights and
 * days with no recap all return without claiming a lease.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Object} params
 * @param {string} params.seasonUid
 * @param {string} params.seasonName
 * @param {number} params.competitionDay
 * @param {string} params.webhookUrl
 * @param {typeof fetch} [params.fetchImpl]
 * @returns {Promise<{kind: string, status: string, [k: string]: unknown}>}
 */
async function announcePodiumScoreDrop(
  db,
  { seasonUid, seasonName, competitionDay, webhookUrl, fetchImpl }
) {
  if (!webhookUrl) return { kind: "podium-drop", status: "disabled" };
  // Spring training scores nothing (§5.9) and the season ends at 49.
  if (!(competitionDay >= 1 && competitionDay <= 49)) {
    return { kind: "podium-drop", status: "out-of-season", competitionDay };
  }

  const snapshot = await db.doc(`podium-recaps/${seasonUid}/days/${competitionDay}`).get();
  if (!snapshot.exists) return { kind: "podium-drop", status: "no-recap", competitionDay };
  const recap = snapshot.data();

  const payload = buildPodiumScoreDropPayload({ recap, seasonName, competitionDay });
  if (!payload) return { kind: "podium-drop", status: "empty-recap", competitionDay };

  // Championship week: the cut rides the same message as the scores that
  // decided it — same channel, same moment, one notification. Isolated, so a
  // malformed cut can never cost the channel the night's scores.
  try {
    const cutEmbed = buildPodiumCutEmbed(recap, { seasonName });
    if (cutEmbed) payload.embeds.push(cutEmbed);
  } catch (error) {
    logger.warn(`[${TAG}] cut embed skipped: ${error.message}`);
  }

  return postOnce(db, {
    kind: `podium-drop-day-${competitionDay}`,
    tag: TAG,
    leaseKey: `${seasonUid}_discord_podium`,
    leaseDay: competitionDay,
    payload,
    webhookUrl,
    fetchImpl,
  });
}

module.exports = {
  MAX_SHOWS,
  PLACES_PER_SHOW,
  aggregatePodiumNight,
  buildPodiumScoreDropPayload,
  buildPodiumCutEmbed,
  announcePodiumScoreDrop,
};
