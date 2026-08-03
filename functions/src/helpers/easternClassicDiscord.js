/**
 * Eastern Classic night-lineup announcement → #announcements.
 *
 * The Eastern Classic is ONE event across two nights (days 41-42,
 * helpers/easternSplit.js). Registering once covers both; every corps
 * performs exactly one night, seeded by season score and snaked so the two
 * nights carry equal strength. The split is computed and published after the
 * day-38 scoring run — the "who got Friday?" moment the design calls for
 * (PODIUM.md §5.11) — but until now it landed silently in
 * `eastern-classic/{seasonUid}` and a director only found their night by
 * opening the app.
 *
 * This is the post that reads it out. It announces both sides of the split
 * the doc carries: the fantasy classes (`preview.assignments`, night ->
 * entries with corps names) and, when the Podium stage has already written
 * its own snake that night, the Podium counts (`podium.assignments`, which
 * is uid-keyed and so contributes numbers, not names).
 *
 * Announcing is a READ over state someone else wrote, which makes the stage
 * safe to run every night: before the preview exists it returns
 * "not-published" without claiming anything, and the `{seasonUid}_eastern_
 * preview` lease makes the post itself at-most-once. That combination is
 * what lets the announce window span days 38-40 — the post normally goes out
 * with the day-38 score drop, but a night when Discord was unreachable (or
 * when the preview landed late) self-heals on the next run, still ahead of
 * the event.
 *
 * THE SEEDING MOVES AFTER THE POST. Week-6 selections stay editable, and the
 * split is a snake over whoever is enrolled — so one registration on day 39
 * re-seeds everyone below it and can flip nights that were already announced.
 * The first post's footer admitted this ("corps that join or drop before show
 * night are re-seeded") and then left the director to go and check. So this
 * module does not post once: after each republish (`easternSplit
 * .publishEasternPreview`) it compares the live lineup against the one it
 * actually announced — kept on the split doc as `announced.lineup` — and when
 * a corps has changed nights, joined or dropped, it posts an UPDATE naming
 * exactly what moved. Diffing against what was announced, rather than against
 * the previous revision, is what makes a night of Discord downtime collapse
 * into one cumulative update instead of losing a change nobody ever saw.
 */

const { COLORS, clampName, joinLines, link, payloadOf, postOnce } = require("./discord");
const {
  EASTERN_NIGHTS,
  PREVIEW_TRIGGER_DAY,
  diffLineups,
  hasLineupChange,
  lineupIndex,
  splitDocRef,
} = require("./easternSplit");

/** Log tag on every announcement this module posts. */
const TAG = "eastern-classic";

// The two posts this module can make: the first read-out of a published
// lineup, and every later "it moved" correction to it.
const PREVIEW_KIND = "eastern-preview";
const UPDATE_KIND = "eastern-lineup-update";

// The preview is written by the day-38 run; the post stops being news once
// the first night is actually scored.
const ANNOUNCE_FROM_DAY = PREVIEW_TRIGGER_DAY;
const ANNOUNCE_THROUGH_DAY = EASTERN_NIGHTS[0] - 1;

// Fantasy classes in tier order. Registry order rather than the registry
// itself: this is presentation copy, exactly like scoreDrop.js CLASS_LABELS.
const CLASS_LABELS = {
  worldClass: "World Class",
  openClass: "Open Class",
  aClass: "A Class",
  soundSport: "SoundSport",
};
const CLASS_ORDER = ["worldClass", "openClass", "aClass", "soundSport"];

// Per-class roster budget inside a night's field. Discord caps a field value
// at 1024 characters total (joinLines guards that); this keeps one huge class
// from eating the whole field and pushing the other classes out of the post.
const ROSTER_CHARS_MAX = 170;

const SCHEDULE_URL = link("/schedule");

/** "Night 1 · Day 41" — one label shape across every field in every post. */
function nightLabel(night, nights) {
  const index = nights.indexOf(Number(night));
  return index >= 0 ? `Night ${index + 1} · Day ${night}` : `Day ${night}`;
}

/**
 * Corps names for one class, strongest seed first, clamped to a character
 * budget with a "+N more" tail.
 *
 * @param {Array<{corpsName: ?string, seed: ?number}>} entries
 * @returns {string}
 */
function rosterNames(entries) {
  const names = [];
  let length = 0;
  for (const entry of entries) {
    const name = clampName(entry.corpsName || "Unnamed corps", 40);
    const cost = name.length + (names.length > 0 ? 2 : 0);
    // Always keep at least one name, so a single very long name still shows.
    if (names.length > 0 && length + cost > ROSTER_CHARS_MAX) break;
    names.push(name);
    length += cost;
  }
  const dropped = entries.length - names.length;
  return dropped > 0 ? `${names.join(", ")} +${dropped} more` : names.join(", ");
}

/** Group a night's entries by class, each sorted by seed (strongest first). */
function seededByClass(entries) {
  const byClass = new Map();
  for (const entry of entries) {
    const corpsClass = entry.corpsClass || "unknown";
    if (!byClass.has(corpsClass)) byClass.set(corpsClass, []);
    byClass.get(corpsClass).push(entry);
  }
  for (const list of byClass.values()) {
    list.sort((a, b) => (a.seed || 0) - (b.seed || 0));
  }
  // Known classes in tier order, then anything the registry gains later.
  const ordered = [
    ...CLASS_ORDER.filter((id) => byClass.has(id)),
    ...[...byClass.keys()].filter((id) => !CLASS_ORDER.includes(id)).sort(),
  ];
  return ordered.map((id) => [id, byClass.get(id)]);
}

/** {night: count} of Podium corps, from the uid-keyed podium snake. */
function podiumCountsByNight(assignments, nights) {
  const counts = {};
  for (const night of nights) counts[String(night)] = 0;
  for (const night of Object.values(assignments || {})) {
    const key = String(night);
    if (key in counts) counts[key] += 1;
  }
  return counts;
}

/**
 * One night's field: a per-class line of counts and names, plus the Podium
 * headcount when that snake has been published too.
 */
function buildNightField(night, index, entries, podiumCount) {
  const lines = seededByClass(entries).map(
    ([corpsClass, list]) =>
      `**${CLASS_LABELS[corpsClass] || corpsClass}** (${list.length}) — ${rosterNames(list)}`
  );
  // Podium assignments are uid-keyed (no corps names in the doc), so this
  // side of the split is announced as a headcount.
  if (podiumCount > 0) lines.push(`**Podium** (${podiumCount})`);
  return {
    name: `Night ${index + 1} · Day ${night}`,
    value: lines.length > 0 ? joinLines(lines) : "No corps assigned.",
  };
}

/**
 * The night-lineup embed, or null when there is nothing to announce (no
 * preview published yet, or an empty event).
 *
 * @param {Object} params
 * @param {string} params.seasonName
 * @param {Object} params.data - The `eastern-classic/{seasonUid}` doc.
 * @returns {?Object} Webhook payload.
 */
function buildEasternPreviewPayload({ seasonName, data }) {
  const assignments = data && data.preview && data.preview.assignments;
  if (!assignments) return null;

  const nights =
    Array.isArray(data.nights) && data.nights.length === 2 ? data.nights : EASTERN_NIGHTS;
  const podiumCounts = podiumCountsByNight(
    data.podium && data.podium.assignments,
    nights
  );

  const perNight = nights.map((night) => ({
    night,
    entries: assignments[String(night)] || [],
    podium: podiumCounts[String(night)] || 0,
  }));
  const total = perNight.reduce((sum, n) => sum + n.entries.length + n.podium, 0);
  if (total === 0) return null;

  const eventName = clampName(data.eventName || "marching.art Eastern Classic", 80);
  const splitLine = perNight
    .map((n, i) => `${n.entries.length + n.podium} on Night ${i + 1}`)
    .join(" · ");

  return payloadOf({
    title: "🎺 Eastern Classic — here's who marches which night",
    url: SCHEDULE_URL,
    description:
      `${seasonName} — ${eventName} is one show across two nights ` +
      `(Days ${nights[0]} and ${nights[1]}). One registration covers both, and every corps ` +
      "performs exactly one night — seeded by season score and split so the two nights " +
      `carry equal strength. ${total} corps so far: ${splitLine}.`,
    color: COLORS.lineup,
    fields: perNight.map((n, i) => buildNightField(n.night, i, n.entries, n.podium)),
    // Honest framing: the final split is recomputed from FINAL enrollment on
    // night one (easternSplit.resolveEasternNightSet), and week-6 selections
    // are still editable until then — so this lineup is a preview, and saying
    // otherwise would make a late registrant think the post had lost them.
    footer: {
      text:
        "Seeded off tonight's standings — corps that join or drop before show night " +
        "are re-seeded into the final split. One registration covers both nights.",
    },
  });
}

/** Strongest class first, strongest seed first — the order every list uses. */
function byClassThenSeed(a, b) {
  const rankA = CLASS_ORDER.indexOf(a.corpsClass);
  const rankB = CLASS_ORDER.indexOf(b.corpsClass);
  const orderA = rankA === -1 ? CLASS_ORDER.length : rankA;
  const orderB = rankB === -1 ? CLASS_ORDER.length : rankB;
  return orderA - orderB || (a.seed || 0) - (b.seed || 0) || a.key.localeCompare(b.key);
}

/** "**Blue Devils** (World Class)" — the subject of every change line. */
function changeSubject(entry) {
  const name = clampName(entry.corpsName || "Unnamed corps", 40);
  return `**${name}** (${CLASS_LABELS[entry.corpsClass] || entry.corpsClass})`;
}

/**
 * One "what changed" field, or null when that category is empty.
 *
 * @param {string} name - Field heading.
 * @param {Array<Object>} entries - Lineup diff entries.
 * @param {(entry: Object) => string} describe - The tail of each line.
 */
function buildChangeField(name, entries, describe) {
  if (!entries || entries.length === 0) return null;
  const lines = [...entries]
    .sort(byClassThenSeed)
    .map((entry) => `${changeSubject(entry)} — ${describe(entry)}`);
  return { name, value: joinLines(lines) };
}

/**
 * The "the lineup moved" embed: what changed since the last post, then the
 * full current lineup so the post stands on its own.
 *
 * @param {Object} params
 * @param {string} params.seasonName
 * @param {Object} params.data - The `eastern-classic/{seasonUid}` doc.
 * @param {{moved: Array, added: Array, removed: Array}} params.changes - The
 *   diff between the announced lineup and the live one.
 * @returns {?Object} Webhook payload, or null when nothing material changed.
 */
function buildEasternUpdatePayload({ seasonName, data, changes }) {
  const assignments = data && data.preview && data.preview.assignments;
  if (!assignments || !hasLineupChange(changes)) return null;

  const nights =
    Array.isArray(data.nights) && data.nights.length === 2 ? data.nights : EASTERN_NIGHTS;
  const podiumCounts = podiumCountsByNight(data.podium && data.podium.assignments, nights);
  const perNight = nights.map((night) => ({
    night,
    entries: assignments[String(night)] || [],
    podium: podiumCounts[String(night)] || 0,
  }));

  const eventName = clampName(data.eventName || "marching.art Eastern Classic", 80);
  const { moved = [], added = [], removed = [] } = changes;
  // The headline number is the moved corps: those are the directors holding a
  // night that is no longer theirs. Joins and drops are the reason it moved.
  const headline = moved.length > 0
    ? `${moved.length} corps ${moved.length === 1 ? "has" : "have"} changed nights`
    : "the field has changed";
  const reasons = [
    added.length > 0 ? `${added.length} joined` : null,
    removed.length > 0 ? `${removed.length} dropped` : null,
  ].filter(Boolean);

  const fields = [
    buildChangeField("🔀 Changed nights", moved, (entry) => `now ${nightLabel(entry.to, nights)}`),
    buildChangeField("➕ Newly registered", added, (entry) => nightLabel(entry.night, nights)),
    buildChangeField("➖ No longer registered", removed, () => "withdrawn from the event"),
    ...perNight.map((n, i) => buildNightField(n.night, i, n.entries, n.podium)),
  ].filter(Boolean);

  return payloadOf({
    title: "🔄 Eastern Classic lineup updated — check your night",
    url: SCHEDULE_URL,
    description:
      `${seasonName} — since the lineup was posted, ${headline}` +
      `${reasons.length > 0 ? ` (${reasons.join(", ")})` : ""}. ${eventName} seeds by season ` +
      "score and splits the field so both nights carry equal strength, so a corps joining or " +
      "leaving re-seeds the corps around it. Here is where every corps stands now.",
    color: COLORS.lineup,
    fields,
    footer: {
      text:
        "Still a preview — the final split is locked from enrollment on show night. " +
        "One registration covers both nights.",
    },
  });
}

/**
 * Remember the lineup this module just put on the channel, so the next run
 * diffs against what directors were actually told rather than against
 * whatever the split doc happened to hold.
 */
async function recordAnnouncedLineup(ref, preview, lineup) {
  await ref.set(
    {
      announced: {
        revision: preview.revision || 0,
        postedAt: new Date().toISOString(),
        lineup,
      },
    },
    { merge: true }
  );
}

/**
 * Announce the published night lineups any time in the days-38-40 window —
 * the first time as a lineup post, and after that as an update whenever the
 * re-seeded lineup no longer matches the one that was announced.
 *
 * Reads `eastern-classic/{seasonUid}`; a season with no preview yet (or no
 * Eastern Classic at all) is a no-op that claims no lease, so the nightly
 * stage can call this unconditionally.
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
async function announceEasternPreview(
  db,
  { seasonUid, seasonName, competitionDay, webhookUrl, fetchImpl }
) {
  if (
    typeof competitionDay !== "number" ||
    competitionDay < ANNOUNCE_FROM_DAY ||
    competitionDay > ANNOUNCE_THROUGH_DAY
  ) {
    return { kind: PREVIEW_KIND, status: "out-of-window", competitionDay };
  }

  const ref = splitDocRef(db, seasonUid);
  const snapshot = await ref.get();
  const data = snapshot.exists ? snapshot.data() : null;
  const preview = data && data.preview;
  if (!preview || !preview.assignments) {
    return { kind: PREVIEW_KIND, status: "not-published", competitionDay };
  }
  const lineup = lineupIndex(preview.assignments);
  const announced = data.announced && data.announced.lineup ? data.announced.lineup : null;

  if (!announced) {
    const payload = buildEasternPreviewPayload({ seasonName, data });
    if (!payload) return { kind: PREVIEW_KIND, status: "not-published", competitionDay };
    const result = await postOnce(db, {
      kind: PREVIEW_KIND,
      tag: TAG,
      leaseKey: `${seasonUid}_eastern_preview`,
      // Keyed to the publishing day, not tonight's, so every night in the
      // window contends for the same lease and only the first one posts.
      leaseDay: PREVIEW_TRIGGER_DAY,
      payload,
      webhookUrl,
      fetchImpl,
    });
    // "completed" means a run before this code shipped already posted the
    // lineup without leaving a baseline behind. Adopt the current one so the
    // season still gets its updates, rather than re-posting the lineup.
    if (result.status === "posted" || result.reason === "completed") {
      await recordAnnouncedLineup(ref, preview, lineup);
    }
    return result;
  }

  const changes = diffLineups(announced, lineup);
  if (!hasLineupChange(changes)) {
    return { kind: UPDATE_KIND, status: "unchanged", competitionDay };
  }

  const payload = buildEasternUpdatePayload({ seasonName, data, changes });
  if (!payload) return { kind: UPDATE_KIND, status: "not-published", competitionDay };
  const result = await postOnce(db, {
    kind: UPDATE_KIND,
    tag: TAG,
    // One update per night at most. A failed post leaves the baseline alone,
    // so the next night re-diffs from the same place and posts one cumulative
    // update instead of dropping the change.
    leaseKey: `${seasonUid}_eastern_update`,
    leaseDay: competitionDay,
    payload,
    webhookUrl,
    fetchImpl,
  });
  if (result.status === "posted") await recordAnnouncedLineup(ref, preview, lineup);
  return { ...result, moved: changes.moved.length };
}

module.exports = {
  TAG,
  PREVIEW_KIND,
  UPDATE_KIND,
  ANNOUNCE_FROM_DAY,
  ANNOUNCE_THROUGH_DAY,
  CLASS_LABELS,
  nightLabel,
  rosterNames,
  seededByClass,
  podiumCountsByNight,
  buildNightField,
  buildChangeField,
  buildEasternPreviewPayload,
  buildEasternUpdatePayload,
  announceEasternPreview,
};
