/**
 * Championship-week cuts — "who marches tomorrow", on the night it's decided.
 *
 * Three nights of championship week end with a cut, and each one is the most
 * dramatic thing that happens in the game all year:
 *
 *   Day 45 Prelims  -> top 8 Open + top 4 A march the Open & A Class Finals
 *   Day 47 Prelims  -> top 25 march World Championship Semifinals
 *   Day 48 Semis    -> top 12 march World Championship Finals
 *
 * The cut was already being computed — `scoringAwards.buildChampionshipConfig`
 * derives tomorrow's participant list from tonight's recap, applies the
 * tie-inclusive cutoff, and falls back to season standings when a night's
 * recap is missing — and then announced to nobody but the logs.
 *
 * This module reads it out. It calls THAT function rather than re-deriving the
 * cutoff: a second implementation of "top 25, ties included" would eventually
 * disagree with the one that decides who actually gets scored, and a post that
 * names a corps the scorer then leaves out is worse than no post at all. The
 * recap is used only to put names and scores on the uids it returns.
 *
 * The embed rides the nightly score drop (helpers/scoreDrop.js) — same
 * channel, same message, same moment as the scores that decided it, and no
 * new lease, secret, or scheduled job. On the other 46 nights of the season
 * `cutForDrop` returns null and nothing changes.
 */

const { COLORS, clampName, joinLines, link, payloadOf } = require("./discord");
const { buildChampionshipConfig } = require("./scoringAwards");

const CLASS_LABELS = {
  worldClass: "World Class",
  openClass: "Open Class",
  aClass: "A Class",
};
const CLASS_ORDER = ["worldClass", "openClass", "aClass"];

/**
 * The nights that end in a cut, keyed by the day whose field gets decided.
 * `from` is the night that decides it — the drop this embed rides.
 *
 * `rule` is display copy for a cutoff that lives in buildChampionshipConfig;
 * it is not used to compute anything. `perClass` marks the one cut that is
 * really two separate competitions (Open and A Class run their own finals),
 * where a single cross-class ranking would be nonsense.
 */
const CUTS = {
  46: {
    from: 45,
    rule: "Top 8 Open Class · Top 4 A Class",
    perClass: true,
  },
  48: {
    from: 47,
    rule: "Top 25 from Prelims",
    perClass: false,
  },
  49: {
    from: 48,
    rule: "Top 12 from Semifinals",
    perClass: false,
  },
};

const SCORES_URL = link("/scores");

/** Best row per (uid, class) on the night, for names and scores. */
function rowsFromRecap(dailyRecap) {
  const rows = new Map();
  for (const show of (dailyRecap && dailyRecap.shows) || []) {
    for (const result of show.results || []) {
      if (!result || !result.uid || !result.corpsClass) continue;
      const key = `${result.uid}_${result.corpsClass}`;
      const score = Number(result.totalScore) || 0;
      const previous = rows.get(key);
      if (!previous || score > previous.score) {
        rows.set(key, {
          uid: result.uid,
          corpsClass: result.corpsClass,
          corpsName: result.corpsName || "",
          displayName: result.displayName || "",
          score,
        });
      }
    }
  }
  return rows;
}

/**
 * The cut tonight's results just decided, or null on a night that decides
 * nothing (every night outside championship week, plus the auto-enrolled
 * prelims where everyone marches).
 *
 * @param {Object} dailyRecap - fantasy_recaps/{seasonUid}/days/{scoredDay}.
 * @param {number} scoredDay - The night being announced.
 * @returns {?{eventName: string, announcedDay: number, rule: string,
 *   perClass: boolean, advancing: Array<Object>, missed: number,
 *   cutLine: ?number}}
 */
function cutForDrop(dailyRecap, scoredDay) {
  const announcedDay = scoredDay + 1;
  const cut = CUTS[announcedDay];
  if (!cut || cut.from !== scoredDay) return null;

  // Tomorrow's field, from the one function that decides it. `allRecaps` is
  // empty on purpose: its only use is the season-standings fallback for a
  // MISSING recap, and a night whose own recap is empty has no cut to
  // announce — the scorer will auto-enroll everyone instead.
  const config = buildChampionshipConfig(
    announcedDay,
    new Map([[scoredDay, dailyRecap]]),
    []
  );
  if (!config) return null;

  // The event that actually carries a cut. Found by shape, not by name, so a
  // renamed event doesn't silently drop the post — on day 49 the SoundSport
  // festival rides the same config with participants: null (everyone plays).
  const entry = Object.entries(config).find(
    ([, value]) => Array.isArray(value.participants) && value.participants.length > 0
  );
  if (!entry) return null;
  const [eventName, { participants, classFilter }] = entry;

  const rows = rowsFromRecap(dailyRecap);
  // The participant list is ranked before the class filter is applied, so an
  // ineligible class present in the night's recap can occupy a slot in it —
  // the scorer drops those at scoring time via classFilter, and so must the
  // announcement. This matters beyond tidiness: SoundSport is ratings-only and
  // its scores are never revealed anywhere in the product, so a SoundSport row
  // reaching this embed would leak one.
  const advancing = participants
    .map((p) => rows.get(`${p.uid}_${p.corpsClass}`))
    .filter((row) => row && (!classFilter || classFilter.includes(row.corpsClass)))
    .sort((a, b) => b.score - a.score);
  if (advancing.length === 0) return null;

  const eligible = [...rows.values()].filter(
    (row) => !classFilter || classFilter.includes(row.corpsClass)
  );

  return {
    eventName,
    announcedDay,
    rule: cut.rule,
    perClass: cut.perClass,
    advancing,
    missed: Math.max(0, eligible.length - advancing.length),
    cutLine: advancing[advancing.length - 1].score,
  };
}

/** "1. **Blue Devils** — 92.150" */
function advancingLines(entries) {
  return entries.map(
    (entry, index) => `${index + 1}. **${clampName(entry.corpsName)}** — ${entry.score.toFixed(3)}`
  );
}

/**
 * The cut embed, or null when there is nothing to announce.
 *
 * @param {?Object} cut - From cutForDrop.
 * @param {Object} params
 * @param {string} params.seasonName
 * @returns {?Object} A Discord embed, for the score drop to append.
 */
function buildCutsEmbed(cut, { seasonName }) {
  if (!cut || cut.advancing.length === 0) return null;

  const fields = [];
  if (cut.perClass) {
    // Open and A Class run their own finals — one ranked list across both
    // would imply a competition that isn't happening.
    for (const corpsClass of CLASS_ORDER) {
      const entries = cut.advancing.filter((e) => e.corpsClass === corpsClass);
      if (entries.length === 0) continue;
      fields.push({
        name: `${CLASS_LABELS[corpsClass] || corpsClass} (${entries.length} advance)`,
        value: joinLines(advancingLines(entries)),
      });
    }
  } else {
    fields.push({
      name: `Advancing (${cut.advancing.length})`,
      value: joinLines(advancingLines(cut.advancing)),
    });
  }

  const missedCopy =
    cut.missed > 0
      ? ` ${cut.missed} ${cut.missed === 1 ? "corps misses" : "corps miss"} the cut, at ` +
        `${cut.cutLine.toFixed(3)}.`
      : "";

  return {
    title: `✂️ The field is set — ${clampName(cut.eventName, 90)}`,
    url: SCORES_URL,
    description:
      `${seasonName} — Day ${cut.announcedDay}. ${cut.rule}. ` +
      `${cut.advancing.length} advance.${missedCopy}`,
    color: COLORS.cut,
    fields,
  };
}

/**
 * Standalone payload — the same embed as its own message. Unused by the score
 * drop (which appends the embed to the night's post) and exported for an
 * admin/manual re-post.
 */
function buildCutsPayload(cut, { seasonName }) {
  const embed = buildCutsEmbed(cut, { seasonName });
  return embed ? payloadOf(embed) : null;
}

module.exports = {
  CUTS,
  CLASS_LABELS,
  rowsFromRecap,
  cutForDrop,
  advancingLines,
  buildCutsEmbed,
  buildCutsPayload,
};
