/**
 * Audit (and repair) the Podium season roster against the corps that actually
 * registered for the season.
 *
 * A Podium corps takes the field for a season only by registering for it
 * (callable/podium.js registerPodiumCorps), which writes its roster doc
 * (`podium-season/{seasonUid}/corps/{uid}`) and stamps `seasonUid` onto its
 * state doc in ONE transaction. The nightly processor iterates that roster, so
 * the roster IS the field: any roster entry whose state doc is missing or still
 * holds another season names a corps that is NOT registered this season — a
 * director who walked away after last season, a roster left behind by a
 * re-minted seasonUid (the admin "start season" override pressed mid-season,
 * now refused: helpers/season.js assertNotReminting), or a cross-namespace
 * stray. Until the processor learned to prune them (partitionRoster), such
 * orphans rode into the daily standings sheet and the weekly power column, and
 * had this season's rank and medals written back onto their archived state.
 *
 * This script answers "who is really on the field?" and cleans up what an
 * orphan left behind:
 *
 *   1. ROSTER: list every roster entry with its registration time and the
 *      season its state doc holds; classify ACTIVE (state agrees) vs ORPHAN.
 *      Each ACTIVE row also shows the director's last login (profile
 *      `engagement.lastLogin`) and the corps' season activity — days the
 *      director personally rehearsed or declared rest vs. days the assistant
 *      director ran the plan — and is tagged NEVER-PLAYED when the director
 *      has not touched the corps since registering. Those corps are scored
 *      by design (the assistant director carries a registered corps all
 *      season); the tag is there so "haven't logged in since last season"
 *      can be checked against the record rather than remembered.
 *   2. RECAPS: for every `podium-recaps/{season}/days/{day}`, find result rows
 *      whose corps is not an active roster member (stray rows), drop them, and
 *      re-rank the show within division (helpers/podium/showRanking.js — the
 *      same rule the processor and correctPodiumMedals use).
 *   3. SHEETS: drop the same corps from every daily standings sheet
 *      (`standings/{day}`) and weekly power column (`power/{week}`) and
 *      re-number the ranks.
 *   4. With --commit: delete the orphan roster docs and write the corrected
 *      recap / standings / power docs. Rows of active corps are never touched.
 *
 * Idempotent: a second run finds nothing and writes nothing. The medal
 * counters on active corps are not recomputed here — run the medal correction
 * (correctPodiumMedals.js) afterwards if strays held a medal at any show.
 *
 * Run from the GitHub Actions tab — .github/workflows/audit-podium-roster.yml —
 * or locally:
 *   node src/scripts/auditPodiumRoster.js --dry-run
 *   node src/scripts/auditPodiumRoster.js --commit
 *   node src/scripts/auditPodiumRoster.js --season overture_2026-27 --dry-run
 */

const { getFirestore } = require("firebase-admin/firestore");
const { initializeApp, getApps } = require("firebase-admin/app");

if (!getApps().length) initializeApp();

const store = require("../helpers/podium/store");
const { rankShowResults } = require("../helpers/podium/showRanking");

/**
 * Classify a season roster against the state docs behind it (pure).
 * @param {Array<{uid: string, roster: Object, state: Object|null}>} entries
 * @param {string} seasonUid
 * @returns {{active: Array<{uid: string, corpsName: string, createdAt: string|null}>,
 *   orphans: Array<{uid: string, corpsName: string, createdAt: string|null, reason: string}>}}
 */
function classifyRoster(entries, seasonUid) {
  const active = [];
  const orphans = [];
  for (const { uid, roster, state } of entries) {
    const corpsName = (state && state.corpsName) || (roster && roster.corpsName) || "?";
    const createdAt = (roster && roster.createdAt) || null;
    if (!state) {
      orphans.push({ uid, corpsName, createdAt, reason: "no state doc" });
    } else if (state.seasonUid !== seasonUid) {
      orphans.push({ uid, corpsName, createdAt, reason: `state holds ${state.seasonUid || "no season"}` });
    } else {
      active.push({ uid, corpsName, createdAt });
    }
  }
  return { active, orphans };
}

/**
 * Drop every result row whose corps is not in `allowed` from a recap day and
 * re-rank each touched show within division (pure; mutates the recap).
 * @param {Object} recap podium-recaps/{season}/days/{day} data
 * @param {Set<string>} allowed active roster uids
 * @param {{minFieldSize: number}} medalsCfg
 * @returns {{changed: boolean, removed: Array<{uid: string, eventName: string}>}}
 */
function stripRecapStrays(recap, allowed, medalsCfg) {
  const shows = Array.isArray(recap && recap.shows)
    ? recap.shows
    : Array.isArray(recap && recap.results)
      ? [{ results: recap.results }]
      : [];
  const removed = [];
  for (const show of shows) {
    const results = Array.isArray(show.results) ? show.results : [];
    const kept = results.filter((row) => {
      const ok = row && allowed.has(row.uid);
      if (!ok && row) removed.push({ uid: row.uid, eventName: show.eventName || "?" });
      return ok;
    });
    if (kept.length === results.length) continue;
    results.length = 0;
    results.push(...kept);
    if (results.length > 0) rankShowResults(results, medalsCfg);
  }
  // A legacy flat recap keeps its flat shape.
  if (!Array.isArray(recap.shows) && Array.isArray(recap.results) && shows[0]) {
    recap.results = shows[0].results;
  }
  return { changed: removed.length > 0, removed };
}

/**
 * Drop stray corps from a standings sheet or power column and re-number the
 * ranks (pure; mutates the sheet). `movement` values are left as stored —
 * they compare against the previous sheet, which is corrected the same way.
 * @param {{entries?: Array, fieldSize?: number}} sheet
 * @param {Set<string>} allowed
 * @returns {{changed: boolean, removed: string[]}}
 */
function stripSheetStrays(sheet, allowed) {
  const entries = Array.isArray(sheet && sheet.entries) ? sheet.entries : [];
  const removed = [];
  const kept = entries.filter((entry) => {
    const ok = entry && allowed.has(entry.uid);
    if (!ok && entry) removed.push(entry.uid);
    return ok;
  });
  if (removed.length === 0) return { changed: false, removed };
  kept.forEach((entry, index) => {
    if (typeof entry.rank === "number") entry.rank = index + 1;
  });
  sheet.entries = kept;
  if (typeof sheet.fieldSize === "number") sheet.fieldSize = kept.length;
  return { changed: true, removed };
}

/**
 * One corps' engagement this season, for the audit log (pure).
 * @param {Object|null} state podium/state data
 * @param {Object|null} profile profile data
 * @returns {{lastLogin: string|null, activeDays: number, autoRunDays: number,
 *   blocksAllocated: number, neverPlayed: boolean}}
 */
function engagementOf(state, profile) {
  const activity = (state && state.activity) || {};
  const raw = profile && profile.engagement && profile.engagement.lastLogin;
  const lastLoginDate =
    raw && typeof raw.toDate === "function" ? raw.toDate() : raw ? new Date(raw) : null;
  const lastLogin =
    lastLoginDate && !Number.isNaN(lastLoginDate.getTime()) ? lastLoginDate.toISOString() : null;
  const activeDays = activity.activeDays || 0;
  const autoRunDays = activity.autoRunDays || 0;
  return {
    lastLogin,
    activeDays,
    autoRunDays,
    blocksAllocated: activity.blocksAllocated || 0,
    neverPlayed: activeDays === 0,
  };
}

function parseArgs(argv) {
  const args = { commit: false, season: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--commit") args.commit = true;
    else if (argv[i] === "--dry-run") args.commit = false;
    else if (argv[i] === "--season") args.season = argv[++i] || null;
  }
  return args;
}

async function run({ commit, season }) {
  const db = getFirestore();
  let seasonUid = season;
  if (!seasonUid) {
    const seasonSnap = await db.doc("game-settings/season").get();
    seasonUid = seasonSnap.exists ? seasonSnap.data().seasonUid : null;
  }
  if (!seasonUid) throw new Error("No season: pass --season <seasonUid> or set game-settings/season.");
  console.log(`Auditing the Podium roster for ${seasonUid}${commit ? " (COMMIT)" : " (dry run)"}…`);

  // ---- 1. Roster ----------------------------------------------------------
  const rosterSnap = await store.rosterCollection(db, seasonUid).get();
  const entries = [];
  const CHUNK = 300;
  for (let i = 0; i < rosterSnap.docs.length; i += CHUNK) {
    const chunk = rosterSnap.docs.slice(i, i + CHUNK);
    const states = await db.getAll(...chunk.map((doc) => store.stateRef(db, doc.id)));
    chunk.forEach((doc, j) => {
      entries.push({ uid: doc.id, roster: doc.data(), state: states[j].exists ? states[j].data() : null });
    });
  }
  const { active, orphans } = classifyRoster(entries, seasonUid);
  const stateByUid = new Map(entries.map((entry) => [entry.uid, entry.state]));
  const profileByUid = new Map();
  for (let i = 0; i < active.length; i += CHUNK) {
    const chunk = active.slice(i, i + CHUNK);
    const profiles = await db.getAll(...chunk.map((corps) => store.profileRef(db, corps.uid)));
    chunk.forEach((corps, j) => profileByUid.set(corps.uid, profiles[j].exists ? profiles[j].data() : null));
  }
  let neverPlayed = 0;
  console.log(`\nRoster: ${entries.length} entries — ${active.length} active, ${orphans.length} orphan(s).`);
  for (const corps of active) {
    const e = engagementOf(stateByUid.get(corps.uid), profileByUid.get(corps.uid));
    if (e.neverPlayed) neverPlayed += 1;
    console.log(
      `  ACTIVE  ${corps.uid}  ${corps.corpsName}  registered ${corps.createdAt || "?"}  ` +
        `last login ${e.lastLogin || "?"}  played ${e.activeDays}d / auto ${e.autoRunDays}d ` +
        `(${e.blocksAllocated} blocks)${e.neverPlayed ? "  NEVER-PLAYED" : ""}`
    );
  }
  if (neverPlayed > 0) {
    console.log(
      `  ${neverPlayed} registered corps have never been played by their director this season ` +
        "(assistant director every day) — scored by design; not removed."
    );
  }
  for (const corps of orphans) {
    console.log(
      `  ORPHAN  ${corps.uid}  ${corps.corpsName}  registered ${corps.createdAt || "?"}  — ${corps.reason}`
    );
  }
  const allowed = new Set(active.map((corps) => corps.uid));

  // ---- 2. Recaps ----------------------------------------------------------
  const medalsCfg = store.balance.medals;
  const daySnaps = await db.collection(`podium-recaps/${seasonUid}/days`).get();
  let recapsChanged = 0;
  let rowsRemoved = 0;
  let writer = db.batch();
  let pending = 0;
  const flush = async () => {
    if (commit && pending > 0) await writer.commit();
    writer = db.batch();
    pending = 0;
  };
  for (const daySnap of daySnaps.docs) {
    const recap = daySnap.data();
    const { changed, removed } = stripRecapStrays(recap, allowed, medalsCfg);
    if (!changed) continue;
    recapsChanged += 1;
    rowsRemoved += removed.length;
    console.log(
      `  day ${daySnap.id}: ${removed.length} stray row(s) — ` +
        removed.map((r) => `${r.uid} @ ${r.eventName}`).join(", ")
    );
    const patch = Array.isArray(recap.shows) ? { shows: recap.shows } : { results: recap.results };
    writer.update(daySnap.ref, patch);
    pending += 1;
    if (pending >= 400) await flush();
  }
  await flush();
  console.log(`\nRecaps: ${recapsChanged} day(s) with strays, ${rowsRemoved} row(s) ${commit ? "removed" : "to remove"}.`);

  // ---- 3. Standings sheets + power columns ---------------------------------
  let sheetsChanged = 0;
  for (const sub of ["standings", "power"]) {
    const sheetSnaps = await db.collection(`podium-recaps/${seasonUid}/${sub}`).get();
    for (const sheetSnap of sheetSnaps.docs) {
      const sheet = sheetSnap.data();
      const { changed, removed } = stripSheetStrays(sheet, allowed);
      if (!changed) continue;
      sheetsChanged += 1;
      console.log(`  ${sub}/${sheetSnap.id}: dropped ${removed.join(", ")}`);
      writer.update(sheetSnap.ref, { entries: sheet.entries, fieldSize: sheet.fieldSize });
      pending += 1;
      if (pending >= 400) await flush();
    }
  }
  await flush();
  console.log(`Sheets: ${sheetsChanged} standings/power doc(s) ${commit ? "corrected" : "to correct"}.`);

  // ---- 4. Prune orphan roster docs ----------------------------------------
  for (const orphan of orphans) {
    writer.delete(store.rosterRef(db, seasonUid, orphan.uid));
    pending += 1;
    if (pending >= 400) await flush();
  }
  await flush();
  console.log(
    `\n${commit ? "Removed" : "Would remove"} ${orphans.length} orphan roster doc(s), ` +
      `${rowsRemoved} recap row(s), ${sheetsChanged} sheet(s).`
  );
  if (!commit) console.log("Dry run — re-run with --commit to apply.");
}

if (require.main === module) {
  run(parseArgs(process.argv.slice(2))).then(
    () => process.exit(0),
    (error) => {
      console.error(error);
      process.exit(1);
    }
  );
}

module.exports = { classifyRoster, engagementOf, stripRecapStrays, stripSheetStrays, parseArgs };
