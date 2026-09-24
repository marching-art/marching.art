/**
 * The World Championship rounds — ONE field, no classes.
 *
 * Days 47, 48 and 49 are the three nights of the marching.art World
 * Championship: Prelims, Semifinals and Finals. Every corps that reaches a
 * round competes on a level playing field — World, Open and A Class together,
 * ranked 1 through N on the one sheet — and carries the same title for having
 * been there: a World Prelims Performer, a World Semifinalist, a World
 * Finalist, and at the top of the Finals sheet the World Champion. That is
 * how the cuts have always been decided (`scoringAwards.buildChampionshipConfig`
 * ranks the whole field for the top 25 and the top 12); this module is the one
 * place that says so for every surface that prints a round, so the sheet, the
 * Discord drop, the public results page and the share card never section a
 * World round by class again.
 *
 * Both divisions run the identical bracket (docs/PODIUM.md §5.7), so the
 * Podium board reads the same table. The client twin is
 * `src/utils/worldChampionship.ts`; worldChampionship.test.js pins them equal.
 *
 * Day 45/46 — the Open & A Class Prelims and Finals — are NOT here on purpose:
 * those two nights are two separate competitions (Open crowns Open, A crowns
 * A), and their sheets stay split by class.
 *
 * Pure: no Firestore, no clock.
 */

/**
 * @typedef {Object} WorldChampionshipRound
 * @property {number} day The competition day the round is played on.
 * @property {"Prelims"|"Semifinals"|"Finals"} round
 * @property {string} eventName The fantasy/Podium event name for the night.
 * @property {string} title Short sheet title — "World Championship Semifinals".
 * @property {string} participants What everyone on the sheet is —
 *   "World Semifinalists".
 * @property {string} participant The singular — "World Semifinalist".
 * @property {?string} winner The title first place carries, Finals only —
 *   "World Champion".
 */

/** @type {Readonly<Record<number, Readonly<WorldChampionshipRound>>>} */
const WORLD_CHAMPIONSHIP_ROUNDS = Object.freeze({
  47: Object.freeze({
    day: 47,
    round: "Prelims",
    eventName: "marching.art World Championship Prelims",
    title: "World Championship Prelims",
    participants: "World Prelims Performers",
    participant: "World Prelims Performer",
    winner: null,
  }),
  48: Object.freeze({
    day: 48,
    round: "Semifinals",
    eventName: "marching.art World Championship Semifinals",
    title: "World Championship Semifinals",
    participants: "World Semifinalists",
    participant: "World Semifinalist",
    winner: null,
  }),
  49: Object.freeze({
    day: 49,
    round: "Finals",
    eventName: "marching.art World Championship Finals",
    title: "World Championship Finals",
    participants: "World Finalists",
    participant: "World Finalist",
    winner: "World Champion",
  }),
});

/** The three World Championship nights, in order. */
const WORLD_CHAMPIONSHIP_DAYS = Object.freeze([47, 48, 49]);

/**
 * The key a World round's single combined field is filed under wherever a
 * night's standings are keyed by class (the Discord drop's `byClass`, the
 * public results page, the `/share/scores/{season}/{day}/{key}` card). It is
 * deliberately not a class: nothing about the round is.
 */
const WORLD_FIELD_KEY = "worldChampionship";

/** Display label for WORLD_FIELD_KEY wherever a class label is expected. */
const WORLD_FIELD_LABEL = "World Championship";

/** Matches the World Championship event names (fantasy and Podium alike). */
const WORLD_EVENT_PATTERN = /world\s+championship/i;

/**
 * The World Championship round played on `day`, or null on every other night.
 *
 * When an `eventName` is supplied it has to be the World Championship show:
 * a live season maps every scraped DCI event to its calendar day, so an
 * unrelated show that happens to land on day 47 keeps its class sections.
 * The SoundSport festival on Finals night never reaches these sheets (it is
 * filtered out before them), so no special case is needed for it.
 *
 * @param {number|string|null|undefined} day
 * @param {string|null} [eventName]
 * @returns {?Readonly<WorldChampionshipRound>}
 */
function worldChampionshipRound(day, eventName = null) {
  const round = WORLD_CHAMPIONSHIP_ROUNDS[Number(day)];
  if (!round) return null;
  if (eventName && !WORLD_EVENT_PATTERN.test(String(eventName))) return null;
  return round;
}

/**
 * True when `day` is one of the three World Championship nights (and, when
 * given, `eventName` is the World Championship show).
 * @param {number|string|null|undefined} day
 * @param {string|null} [eventName]
 */
function isWorldChampionshipRound(day, eventName = null) {
  return worldChampionshipRound(day, eventName) !== null;
}

/**
 * The title a placement on a World round's sheet carries: "World Champion"
 * for first at Finals, otherwise the round's participant title.
 * @param {number|string|null|undefined} day
 * @param {number|null|undefined} place 1-based.
 * @returns {?string}
 */
function worldChampionshipTitle(day, place) {
  const round = worldChampionshipRound(day);
  if (!round) return null;
  return place === 1 && round.winner ? round.winner : round.participant;
}

module.exports = {
  WORLD_CHAMPIONSHIP_ROUNDS,
  WORLD_CHAMPIONSHIP_DAYS,
  WORLD_FIELD_KEY,
  WORLD_FIELD_LABEL,
  worldChampionshipRound,
  isWorldChampionshipRound,
  worldChampionshipTitle,
};
