/**
 * Split an archived fantasy season into a lean profile summary row and a heavy
 * per-season detail doc.
 *
 * The profile doc (artifacts/{ns}/users/{uid}/profile/data) sits behind a live
 * onSnapshot listener in the client (src/store/profileStore.ts): every
 * server-side profile write re-ships the WHOLE document to every connected tab.
 * A director's seasonHistory grows one row per class per season forever, and the
 * bulk of each row — the eight-caption lineup and the week-by-week show picks —
 * is read in exactly one place, when a director opens a single season's detail
 * panel (src/pages/CorpsHistory.jsx). Keeping that on the hot document meant
 * decades of never-read history rode along on every nightly-scoring write and
 * marched the doc toward Firestore's 1 MiB ceiling.
 *
 * So the heavy fields move to a per-season detail doc
 * (artifacts/{ns}/users/{uid}/seasonDetail/{seasonId}__{corpsClass}), fetched
 * lazily only when a director drills into that season. The summary row keeps
 * everything the history chart, the timeline list, the director rating
 * (helpers/directorRating.js), and the career aggregates (helpers/corpsHelpers.js)
 * read — placement, scores, shows, show concept — plus a `weeks` count so the
 * timeline can still label a row without loading its detail.
 *
 * The same split is applied at season rollover (helpers/season.js) and by the
 * one-time backfill (scripts/migrateSeasonHistoryDetail.js), so a summary row's
 * shape is identical whether it was archived before or after this change.
 */

const { colorwayStrip } = require("./uniformValidation");

// The archived fields that move off the profile summary row into the detail
// doc. weeklyScores is included even though nothing currently writes it (see
// helpers/seasonParticipation.js) — if a writer ever populates it, that bulky
// per-week map belongs with the other detail, not on the hot profile document.
// uniformSnapshot is the season's full equipped-uniform figure (the Uniform
// History timeline renders it when a director drills into the season); the
// compact `uniform` row ({designId, name, colors}) stays on the summary.
const HEAVY_FIELDS = ["lineup", "selectedShows", "weeklyScores", "uniformSnapshot"];

/**
 * The equipped uniform reduced to what the seasonHistory SUMMARY row keeps:
 * design id, look name, and a validated [primary, secondary, accent] triple
 * (~100 bytes — the timeline list renders swatches without loading detail).
 * Null when nothing valid is equipped, so pre-Studio seasons stay unchanged.
 *
 * @param {Object|undefined} equipped corps.{class}.uniform snapshot.
 * @returns {{designId: string|null, name: string, colors: string[]} | null}
 */
function compactEquippedUniform(equipped) {
  if (!equipped || typeof equipped !== "object") return null;
  const colors = colorwayStrip(equipped.colorway);
  if (!colors) return null;
  return {
    designId: typeof equipped.designId === "string" ? equipped.designId : null,
    name: typeof equipped.name === "string" && equipped.name ? equipped.name : "Equipped uniform",
    colors,
  };
}

/**
 * Stable detail-doc id for a season a corps competed in. Keyed by the season
 * and the class COMPETED IN (the row's own corpsClass) — unique per director,
 * since a corps fields at most one entry per class per season, and stable when
 * the corps later climbs classes or is retired/unretired (the summary row
 * travels between class slots but the class it was earned in does not).
 *
 * @param {string} seasonId e.g. "adagio_2025-26"
 * @param {string} corpsClass e.g. "worldClass"
 */
function seasonDetailId(seasonId, corpsClass) {
  return `${seasonId}__${corpsClass}`;
}

/** True when a value is a non-empty plain object worth storing as detail. */
function hasContent(value) {
  return value != null && typeof value === "object" && Object.keys(value).length > 0;
}

/**
 * Split a full archived record into `{ summary, detail }`.
 *
 * `detail` is null when the record carries no non-empty heavy field (a Podium
 * row, say, which never had a lineup), so no detail doc is written for it.
 * `summary` always carries a `weeks` count derived from weeklyScores so the
 * timeline keeps its per-row week label after the map moves to detail.
 *
 * Idempotent: re-splitting a row that has already been slimmed (no heavy
 * fields present) returns the same summary and a null detail, so the backfill
 * is safe to run twice.
 *
 * @param {Object} record the full season record as archived historically
 * @returns {{summary: Object, detail: Object|null}}
 */
function splitSeasonRecord(record) {
  const summary = {};
  const detail = {};
  let hasDetail = false;

  for (const [key, value] of Object.entries(record)) {
    if (HEAVY_FIELDS.includes(key)) {
      if (hasContent(value)) {
        detail[key] = value;
        hasDetail = true;
      }
    } else {
      summary[key] = value;
    }
  }

  // Derive the week count from weeklyScores while it is still present; once the
  // map has moved to the detail doc, preserve the count already on the row so a
  // second pass (re-running the backfill) can't reset it to zero.
  summary.weeks = hasContent(record.weeklyScores)
    ? Object.keys(record.weeklyScores).length
    : record.weeks ?? 0;

  return { summary, detail: hasDetail ? detail : null };
}

module.exports = { HEAVY_FIELDS, seasonDetailId, splitSeasonRecord, compactEquippedUniform };
