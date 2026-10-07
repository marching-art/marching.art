/**
 * League identity: which game a league plays, and how roleplay fits into it.
 *
 * Directors cover a lot of ground — some only play Fantasy, some only Podium,
 * some both; some want raw competition and data, some enjoy the occasional
 * storyline, and some run their corps as a living world with a media
 * department. A league used to say none of that: the one "Roleplay" vibe tag
 * could not tell "storylines welcome, never required" from "you are expected
 * to post in character every week", and nothing said which game the league
 * even played. Players joined the wrong room in both directions.
 *
 * Three commissioner-set fields answer it, validated here for both createLeague
 * and updateLeagueSettings so the two doors can never disagree:
 *
 *   settings.gameMode — "fantasy" | "podium" | "both" (absent = both). Not a
 *     label: weekly matchup generation pairs only the classes the mode covers
 *     (leagueMatchupClasses below), so a Fantasy-only league never draws a
 *     Podium duel and vice versa.
 *   roleplay          — { level, expectations }: how much in-character play the
 *     league runs, and in the commissioner's own words what participation
 *     means. Supersedes the old "roleplay" vibe tag, which could only say
 *     "roleplay happens here" and nothing about how much.
 *   lore              — the league's setting / storyline bible, shown on the
 *     League tab to members and on the discovery card to prospects.
 *   abbreviation      — the league's tag: a short bold acronym ("DCFL") the
 *     league wears as its crest and every member wears on their profile and
 *     ensembles (callable/leagueTags.js). Setting one is the commissioner's
 *     opt-in to that display, so a league without one is never named on a
 *     member's profile — private leagues stay private by default.
 *
 * League docs are listable by any signed-in user (firestore.rules), which is
 * the point here: all three exist to be read before joining.
 */

const { HttpsError } = require("firebase-functions/v2/https");
const { registry, MATCHUP_CLASSES } = require("./classRegistry");
const { isProfaneCorpsName } = require("./corpsHelpers");

const GAME_MODES = Object.freeze(["fantasy", "podium", "both"]);
const ROLEPLAY_LEVELS = Object.freeze(["none", "optional", "encouraged", "immersive"]);
const MAX_ROLEPLAY_EXPECTATIONS_LENGTH = 500;
const MAX_LORE_LENGTH = 2000;
const MIN_ABBREVIATION_LENGTH = 2;
const MAX_ABBREVIATION_LENGTH = 5;
/** Letters and digits only, stored uppercase — a tag reads as one bold mark. */
const ABBREVIATION_PATTERN = /^[A-Z0-9]+$/;

/**
 * Which game a matchup class belongs to. Podium is the class that fields no
 * caption lineup; every lineup class is Fantasy. Registry-derived so a new
 * class lands in the right game without touching this file.
 *
 * @param {string} classId
 * @returns {"fantasy" | "podium"}
 */
function gameModeOfClass(classId) {
  const entry = registry.classes[classId];
  return entry && entry.capabilities && entry.capabilities.hasLineup === false ? "podium" : "fantasy";
}

/**
 * The league's game mode, defaulting a missing or unknown value to "both" —
 * every league created before the field existed played every class.
 *
 * @param {Object} [league]
 * @returns {"fantasy" | "podium" | "both"}
 */
function leagueGameMode(league) {
  const mode = league && league.settings && league.settings.gameMode;
  return GAME_MODES.includes(mode) ? mode : "both";
}

/**
 * The matchup classes a league's weekly generator pairs. Resolution and
 * standings keep iterating every MATCHUP_CLASSES array; the excluded ones are
 * simply written empty.
 *
 * @param {Object} [league]
 * @param {string[]} [classes] - defaults to the registry's MATCHUP_CLASSES
 * @returns {string[]}
 */
function leagueMatchupClasses(league, classes = MATCHUP_CLASSES) {
  const mode = leagueGameMode(league);
  if (mode === "both") return classes;
  return classes.filter((c) => gameModeOfClass(c) === mode);
}

/**
 * Normalize and validate a league tag. Blank or null clears it.
 *
 * @param {*} value
 * @returns {string | null}
 */
function parseLeagueAbbreviation(value) {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", "League tag must be text.");
  }
  const tag = value.trim().toUpperCase();
  if (!tag) return null;
  if (
    tag.length < MIN_ABBREVIATION_LENGTH ||
    tag.length > MAX_ABBREVIATION_LENGTH ||
    !ABBREVIATION_PATTERN.test(tag)
  ) {
    throw new HttpsError(
      "invalid-argument",
      `League tag must be ${MIN_ABBREVIATION_LENGTH}-${MAX_ABBREVIATION_LENGTH} letters or numbers.`
    );
  }
  if (isProfaneCorpsName(tag)) {
    throw new HttpsError("invalid-argument", "Please choose a different league tag.");
  }
  return tag;
}

/**
 * The league's tag, or null when its commissioner never set one (or a stored
 * value no longer validates — never render a tag the callable would refuse).
 *
 * @param {Object} [league]
 * @returns {string | null}
 */
function leagueAbbreviation(league) {
  const tag = league && league.abbreviation;
  if (typeof tag !== "string") return null;
  try {
    return parseLeagueAbbreviation(tag);
  } catch {
    return null;
  }
}

/**
 * Validate the identity keys of a client patch. Returns the whitelisted
 * values keyed by storage path, skipping keys the patch did not send.
 *
 * @param {{gameMode?: *, roleplay?: *, lore?: *, abbreviation?: *}} patch
 * @returns {{gameMode?: string, roleplay?: {level: string, expectations: string} | null, lore?: string, abbreviation?: string | null}}
 */
function parseLeagueIdentity(patch) {
  const out = {};

  if (patch.abbreviation !== undefined) {
    out.abbreviation = parseLeagueAbbreviation(patch.abbreviation);
  }

  if (patch.gameMode !== undefined) {
    if (!GAME_MODES.includes(patch.gameMode)) {
      throw new HttpsError("invalid-argument", `Game mode must be one of: ${GAME_MODES.join(", ")}.`);
    }
    out.gameMode = patch.gameMode;
  }

  if (patch.roleplay !== undefined) {
    if (patch.roleplay === null) {
      out.roleplay = null;
    } else {
      if (typeof patch.roleplay !== "object" || Array.isArray(patch.roleplay)) {
        throw new HttpsError("invalid-argument", "Roleplay settings must be an object.");
      }
      const { level, expectations = "" } = patch.roleplay;
      if (!ROLEPLAY_LEVELS.includes(level)) {
        throw new HttpsError(
          "invalid-argument",
          `Roleplay level must be one of: ${ROLEPLAY_LEVELS.join(", ")}.`
        );
      }
      if (typeof expectations !== "string" || expectations.length > MAX_ROLEPLAY_EXPECTATIONS_LENGTH) {
        throw new HttpsError(
          "invalid-argument",
          `Roleplay expectations must be text of ${MAX_ROLEPLAY_EXPECTATIONS_LENGTH} characters or fewer.`
        );
      }
      out.roleplay = { level, expectations: expectations.trim() };
    }
  }

  if (patch.lore !== undefined) {
    if (typeof patch.lore !== "string" || patch.lore.length > MAX_LORE_LENGTH) {
      throw new HttpsError(
        "invalid-argument",
        `League lore must be text of ${MAX_LORE_LENGTH} characters or fewer.`
      );
    }
    out.lore = patch.lore.trim();
  }

  return out;
}

/**
 * The roleplay level a league actually runs at. Leagues tagged with the
 * retired "roleplay" vibe tag before the level existed read as "encouraged" —
 * the tag promised "in-character directors and corps lore", which is more than
 * "welcome" and less than a mandate.
 *
 * @param {Object} [league]
 * @returns {string | null} a ROLEPLAY_LEVELS value, or null when unstated
 */
function leagueRoleplayLevel(league) {
  const level = league && league.roleplay && league.roleplay.level;
  if (ROLEPLAY_LEVELS.includes(level)) return level;
  return league && league.tag === "roleplay" ? "encouraged" : null;
}

module.exports = {
  GAME_MODES,
  ROLEPLAY_LEVELS,
  MAX_ROLEPLAY_EXPECTATIONS_LENGTH,
  MAX_LORE_LENGTH,
  MIN_ABBREVIATION_LENGTH,
  MAX_ABBREVIATION_LENGTH,
  gameModeOfClass,
  leagueAbbreviation,
  leagueGameMode,
  leagueMatchupClasses,
  leagueRoleplayLevel,
  parseLeagueAbbreviation,
  parseLeagueIdentity,
};
