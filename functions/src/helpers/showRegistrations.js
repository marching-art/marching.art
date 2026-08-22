/**
 * Materialized "who's attending this show" index.
 *
 * getShowRegistrations used to answer every show-detail page view with a
 * collectionGroup scan over EVERY active profile (each carrying the full
 * corps map) — O(all players) document reads per view. The index inverts
 * that: one document per (week, eventName, date) event under
 *   artifacts/{ns}/show_registrations/{seasonUid}/events/{eventKey}
 * holding a registrations map keyed `${uid}_${corpsClass}`.
 *
 * Consistency model (three cooperating writers, callable-read):
 *  - selectUserShows write-through keeps the current week fresh in real time
 *    (best-effort — a failure never blocks the save);
 *  - the nightly lifetime-leaderboard job rebuilds the whole season's index
 *    from profiles (the source of truth), self-healing any missed or raced
 *    write-throughs;
 *  - getShowRegistrations materializes an event doc on a cache miss so a hot
 *    show page pays the legacy scan at most once.
 * The collection is server-only: no firestore.rules match exists for it, so
 * clients cannot read or write it directly.
 */

/**
 * Deterministic document key for an event. base64url keeps arbitrary event
 * names (slashes, unicode) safe as a single Firestore doc id.
 */
function showRegistrationEventKey(week, eventName, date) {
  return Buffer.from(`${week}|${eventName}|${date ?? ""}`).toString("base64url");
}

/** The registrations-map entry key for one corps of one user. */
function registrationEntryKey(uid, corpsClass) {
  return `${uid}_${corpsClass}`;
}

/**
 * Extract every (event, registration entry) pair from one profile document.
 * Mirrors the legacy scan's matching semantics: every class's selectedShows,
 * matched later by eventName + date within a week.
 *
 * @returns {Array<{key: string, week: number, eventName: string,
 *   date: *, entryKey: string, entry: Object}>}
 */
function collectRegistrationsFromProfile(uid, profile) {
  const out = [];
  const corps = profile?.corps || {};
  for (const corpsClass of Object.keys(corps)) {
    const corpsData = corps[corpsClass] || {};
    const selectedShows = corpsData.selectedShows || {};
    for (const weekKey of Object.keys(selectedShows)) {
      const week = parseInt(String(weekKey).replace(/^week/, ""), 10);
      if (!Number.isFinite(week)) continue;
      for (const show of selectedShows[weekKey] || []) {
        if (!show || typeof show.eventName !== "string" || !show.eventName) continue;
        out.push({
          key: showRegistrationEventKey(week, show.eventName, show.date),
          week,
          eventName: show.eventName,
          date: show.date ?? null,
          entryKey: registrationEntryKey(uid, corpsClass),
          entry: {
            uid,
            corpsClass,
            corpsName: corpsData.corpsName || "Unnamed Corps",
            username: profile.username || null,
          },
        });
      }
    }
  }
  return out;
}

/**
 * Fold per-profile registration pairs into event documents ready to write.
 *
 * @param {Array} pairs output of collectRegistrationsFromProfile (concatenated)
 * @returns {Map<string, Object>} eventKey -> event doc data
 */
function buildEventDocs(pairs) {
  const docs = new Map();
  for (const pair of pairs) {
    let doc = docs.get(pair.key);
    if (!doc) {
      doc = { week: pair.week, eventName: pair.eventName, date: pair.date, registrations: {} };
      docs.set(pair.key, doc);
    }
    doc.registrations[pair.entryKey] = pair.entry;
  }
  return docs;
}

/**
 * Fold Podium corps into a show's registration list (pure).
 *
 * Podium picks live on each corps' podium/state doc as
 * `selectedShows[day] = { eventName, location }` — outside the fantasy
 * registration index. Given the season's roster states, keep the corps whose
 * pick for `day` names this show and shape each into a registration entry
 * (corpsClass "podiumClass"; a Podium corps carries no @username in the roster,
 * so username is null and the caller dedupes it into a slot by uid). A stale
 * prior-season state is skipped by the seasonUid check. `selectedShows` keys
 * are strings once round-tripped through Firestore, so both the numeric and
 * string forms of `day` are tried.
 *
 * @param {Array<{uid: string, state: Object}>} entries roster uid + state data
 * @param {{day: number, eventName: string, activeSeasonId: string}} params
 * @returns {Array<{uid: string|null, corpsName: string, corpsClass: string,
 *   username: null}>}
 */
function collectPodiumRegistrations(entries, { day, eventName, activeSeasonId }) {
  const out = [];
  for (const { uid, state } of entries || []) {
    if (!state || state.seasonUid !== activeSeasonId) continue;
    const picks = state.selectedShows || {};
    const pick = picks[day] || picks[String(day)] || null;
    if (!pick || pick.eventName !== eventName) continue;
    out.push({
      uid: uid || null,
      corpsName: state.corpsName || "Podium Corps",
      corpsClass: "podiumClass",
      username: null,
    });
  }
  return out;
}

module.exports = {
  showRegistrationEventKey,
  registrationEntryKey,
  collectRegistrationsFromProfile,
  buildEventDocs,
  collectPodiumRegistrations,
};
