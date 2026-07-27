/**
 * The vocabulary every check speaks.
 *
 * A finding is `pass`, `fail`, or `warn`. `warn` is for something real that is
 * a judgement call rather than a defect the harness can rule on — a batch whose
 * ceiling only production can test, a definition that does not match its own
 * docstring. Keeping the three constructors (and the recap readers every check
 * group needs) in one place keeps the check modules free of anything but
 * checks.
 */

function pass(area, name, detail = "") {
  return { area, name, status: "pass", detail };
}

function fail(area, name, detail) {
  return { area, name, status: "fail", detail };
}

function warn(area, name, detail) {
  return { area, name, status: "warn", detail };
}

/** Read every recap day the season wrote, keyed by competition day. */
async function readRecaps(db, seasonUid) {
  const snapshot = await db.collection(`fantasy_recaps/${seasonUid}/days`).get();
  const byDay = new Map();
  for (const doc of snapshot.docs) {
    byDay.set(Number(doc.id), doc.data());
  }
  return byDay;
}

/** Every result row in a day's recap, flattened across its shows. */
function resultsFor(recap) {
  return (recap?.shows || []).flatMap((show) => show.results || []);
}

/** Result rows for one named show on a day. */
function resultsForShow(recap, eventName) {
  const show = (recap?.shows || []).find((s) => s.eventName === eventName);
  return show ? show.results || [] : [];
}

module.exports = { pass, fail, warn, readRecaps, resultsFor, resultsForShow };
