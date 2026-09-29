/**
 * Admin Reports queue — the moderation surface for every player report.
 *
 * Reports land in two collections, written by three callables:
 *   - `reports` (type "comment")        ← reportComment (profile comments)
 *   - `reports` (type "league_message") ← reportLeagueMessage (league chat)
 *   - `article_comments_reports`        ← reportArticleComment
 *
 * Until this module nothing in the admin UI read either collection: reports
 * reached admins only as an email, and the article reports stayed "pending"
 * forever (so the twice-daily digest nagged about them indefinitely). These
 * callables normalize all three into one queue with one status vocabulary
 * (new → reviewed → resolved) and let an admin remove the reported content in
 * the same step, which also resolves every other open report on that content.
 *
 * Deliberately index-free: the queries are single-field equality filters (or a
 * single-field orderBy for "all") and the merge/sort happens in memory, because
 * composite indexes are not deployed by CI (see deploy-functions.yml). Report
 * volume is small; the per-source cap bounds the read.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { FieldValue } = require("firebase-admin/firestore");
const { getDb } = require("../config");
const { paths } = require("../helpers/paths");
const { assertAdmin, assertDocId, clampLimit } = require("../helpers/callableGuards");
const { createLeagueActivity } = require("../helpers/leagueHelpers");

const REPORT_STATUSES = ["new", "reviewed", "resolved"];
const REPORT_TYPES = ["comment", "league_message", "article_comment"];
const SOURCES = { reports: "reports", article: "article_comments_reports" };
const MAX_NOTE_LENGTH = 500;

/** Article reports were written with "pending" for what the queue calls "new". */
const toArticleStatus = (status) => (status === "new" ? "pending" : status);
const fromArticleStatus = (status) => (status === "pending" ? "new" : status);

const isoOf = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : null;
};

const millisOf = (value) => {
  const iso = isoOf(value);
  return iso ? Date.parse(iso) || 0 : 0;
};

/**
 * Normalize a raw report doc from either collection into the queue's shape.
 * Enrichment fields (names, text for article reports, content liveness) are
 * filled in afterwards by enrichReports.
 */
function normalizeReport(source, doc) {
  const data = doc.data() || {};
  if (source === SOURCES.article) {
    return {
      id: doc.id,
      source,
      type: "article_comment",
      status: fromArticleStatus(data.status || "pending"),
      reason: data.reason || null,
      text: "",
      contentId: data.commentId || null,
      authorUid: data.commentAuthorId || null,
      reporterUid: data.reporterId || null,
      context: { articleId: data.articleId || null },
      createdAt: isoOf(data.createdAt),
      resolution: data.resolution || null,
      adminNote: data.adminNote || null,
      resolvedAt: isoOf(data.resolvedAt),
      resolvedBy: data.resolvedBy || null,
    };
  }
  const isLeague = data.type === "league_message";
  return {
    id: doc.id,
    source,
    type: isLeague ? "league_message" : "comment",
    status: data.status || "new",
    reason: data.reason || null,
    text: typeof data.commentText === "string" ? data.commentText : "",
    contentId: (isLeague ? data.messageId : data.commentId) || null,
    authorUid: data.commentAuthorUid || null,
    reporterUid: data.reporterUid || null,
    context: isLeague
      ? { leagueId: data.leagueId || null, leagueName: data.leagueName || null }
      : { profileUid: data.reportedOnProfileUid || null },
    createdAt: isoOf(data.createdAt),
    resolution: data.resolution || null,
    adminNote: data.adminNote || null,
    resolvedAt: isoOf(data.resolvedAt),
    resolvedBy: data.resolvedBy || null,
  };
}

/** The live doc a report points at, or null when the report lacks the ids. */
function contentRefFor(db, report) {
  if (!report.contentId) return null;
  if (report.type === "article_comment") {
    return db.collection("article_comments").doc(report.contentId);
  }
  if (report.type === "league_message") {
    const leagueId = report.context.leagueId;
    return leagueId ? db.doc(`${paths.league(leagueId)}/chat/${report.contentId}`) : null;
  }
  const profileUid = report.context.profileUid;
  return profileUid ? db.doc(paths.userComment(profileUid, report.contentId)) : null;
}

/** db.getAll with an empty-list guard (getAll() with no refs throws). */
async function getAllSafe(db, refs) {
  if (refs.length === 0) return [];
  return db.getAll(...refs);
}

/**
 * Fill in display names, the reported text for article reports (stored only
 * on the comment), and whether the content is still live. Best-effort: a
 * failed read leaves the fields at their defaults rather than failing the list.
 */
async function enrichReports(db, reports) {
  // Content liveness (+ article comment text).
  const contentRefs = reports.map((r) => contentRefFor(db, r));
  const liveRefs = contentRefs.filter(Boolean);
  let contentSnaps = [];
  try {
    contentSnaps = await getAllSafe(db, liveRefs);
  } catch (error) {
    logger.warn(`[reports] content lookup failed: ${error.message}`);
  }
  const contentByPath = new Map(contentSnaps.map((snap) => [snap.ref.path, snap]));

  for (let i = 0; i < reports.length; i++) {
    const report = reports[i];
    const ref = contentRefs[i];
    const snap = ref ? contentByPath.get(ref.path) : undefined;
    if (!snap) {
      report.contentLive = null; // unknown: no ids to look up, or the lookup failed
      continue;
    }
    if (!snap.exists) {
      report.contentLive = false;
      continue;
    }
    const content = snap.data() || {};
    if (report.type === "article_comment") {
      report.text = String(content.content || content.text || "");
      report.contentLive = content.status !== "hidden" && content.status !== "rejected";
      if (!report.authorUid) report.authorUid = content.userId || null;
    } else {
      report.contentLive = true;
    }
  }

  // Display names for authors, reporters and profile owners, one getAll.
  const uids = new Set();
  for (const r of reports) {
    for (const uid of [r.authorUid, r.reporterUid, r.context.profileUid]) {
      if (typeof uid === "string" && uid) uids.add(uid);
    }
  }
  const names = new Map();
  try {
    const uidList = [...uids];
    const snaps = await getAllSafe(db, uidList.map((uid) => db.doc(paths.userProfile(uid))));
    snaps.forEach((snap, i) => {
      if (!snap.exists) return;
      const data = snap.data() || {};
      names.set(uidList[i], data.displayName || data.username || null);
    });
  } catch (error) {
    logger.warn(`[reports] name lookup failed: ${error.message}`);
  }
  for (const r of reports) {
    r.authorName = names.get(r.authorUid) || null;
    r.reporterName = names.get(r.reporterUid) || null;
    if (r.context.profileUid) r.context.profileName = names.get(r.context.profileUid) || null;
  }
  return reports;
}

/**
 * Pull up to `cap + 1` rows from one source for a status filter. Equality on a
 * single field (or a single-field orderBy for "all") — no composite index.
 */
async function fetchSource(db, source, status, cap) {
  let query = db.collection(source);
  if (status === "all") {
    query = query.orderBy("createdAt", "desc");
  } else {
    query = query.where("status", "==", source === SOURCES.article ? toArticleStatus(status) : status);
  }
  const snap = await query.limit(cap + 1).get();
  return snap.docs;
}

async function countSource(db, source, status) {
  try {
    const value = source === SOURCES.article ? toArticleStatus(status) : status;
    const snap = await db.collection(source).where("status", "==", value).count().get();
    return snap.data().count || 0;
  } catch (error) {
    logger.warn(`[reports] count ${source}/${status} failed: ${error.message}`);
    return 0;
  }
}

/**
 * Count open (status "new") reports across both collections. Shared with the
 * pending-approvals digest so the email and the queue can never disagree.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Promise<number>}
 */
async function countNewReports(db) {
  const [a, b] = await Promise.all([
    countSource(db, SOURCES.reports, "new"),
    countSource(db, SOURCES.article, "new"),
  ]);
  return a + b;
}

/**
 * List reports for the admin queue.
 * request.data: { status?: "new"|"reviewed"|"resolved"|"all", type?: "all"|ReportType, limit? }
 */
exports.listReports = onCall({ cors: true, timeoutSeconds: 60 }, async (request) => {
  assertAdmin(request);
  const db = getDb();

  const status = request.data?.status ?? "new";
  if (status !== "all" && !REPORT_STATUSES.includes(status)) {
    throw new HttpsError("invalid-argument", `Status must be one of: all, ${REPORT_STATUSES.join(", ")}`);
  }
  const type = request.data?.type ?? "all";
  if (type !== "all" && !REPORT_TYPES.includes(type)) {
    throw new HttpsError("invalid-argument", `Type must be one of: all, ${REPORT_TYPES.join(", ")}`);
  }
  const limit = clampLimit(request.data?.limit, { fallback: 50, max: 100 });

  try {
    const wantReports = type !== "article_comment";
    const wantArticle = type === "all" || type === "article_comment";
    const [reportDocs, articleDocs] = await Promise.all([
      wantReports ? fetchSource(db, SOURCES.reports, status, limit) : [],
      wantArticle ? fetchSource(db, SOURCES.article, status, limit) : [],
    ]);

    const truncated = reportDocs.length > limit || articleDocs.length > limit;
    const merged = [
      ...reportDocs.slice(0, limit).map((doc) => normalizeReport(SOURCES.reports, doc)),
      ...articleDocs.slice(0, limit).map((doc) => normalizeReport(SOURCES.article, doc)),
    ]
      .filter((r) => type === "all" || r.type === type)
      .sort((x, y) => millisOf(y.createdAt) - millisOf(x.createdAt));

    const page = merged.slice(0, limit);
    await enrichReports(db, page);

    const counts = {};
    await Promise.all(
      REPORT_STATUSES.map(async (s) => {
        const [a, b] = await Promise.all([
          countSource(db, SOURCES.reports, s),
          countSource(db, SOURCES.article, s),
        ]);
        counts[s] = a + b;
      })
    );

    return {
      success: true,
      reports: page,
      hasMore: truncated || merged.length > limit,
      counts,
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("[reports] listReports failed:", error);
    throw new HttpsError("internal", "Failed to list reports.");
  }
});

/**
 * Resolve every other open report on the same piece of content — once a
 * comment is gone (or kept after review), its duplicate reports are answered.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{type: string, contentId: string, adminUid: string, resolution: string,
 *          note?: string|null, excludeId?: string|null}} opts
 * @returns {Promise<number>} how many sibling reports were resolved
 */
async function resolveReportsForContent(db, { type, contentId, adminUid, resolution, note = null, excludeId = null }) {
  if (!contentId) return 0;
  const source = type === "article_comment" ? SOURCES.article : SOURCES.reports;
  const field = type === "league_message" ? "messageId" : "commentId";
  const snap = await db.collection(source).where(field, "==", contentId).limit(200).get();

  const now = FieldValue.serverTimestamp();
  const batch = db.batch();
  let count = 0;
  for (const doc of snap.docs) {
    if (doc.id === excludeId) continue;
    const data = doc.data() || {};
    if (data.status === "resolved") continue;
    if (source === SOURCES.reports && (data.type || "comment") !== type) continue;
    batch.update(doc.ref, {
      status: "resolved",
      resolution,
      adminNote: note,
      resolvedAt: now,
      resolvedBy: adminUid,
    });
    count++;
  }
  if (count > 0) await batch.commit();
  return count;
}

/**
 * Remove the content a report points at. Returns false when it was already gone.
 */
async function removeReportedContent(db, report, adminUid, note) {
  const ref = contentRefFor(db, report);
  if (!ref) {
    throw new HttpsError("failed-precondition", "This report doesn't identify the content to remove.");
  }
  const snap = await ref.get();
  if (!snap.exists) return false;

  if (report.type === "article_comment") {
    // Article comments are hidden, not deleted — the Comments queue keeps the
    // moderation history and can restore them.
    const now = new Date();
    await ref.update({
      status: "hidden",
      moderatedAt: now,
      moderatedBy: adminUid,
      moderationReason: note || "Removed after a player report",
      updatedAt: now,
    });
    return true;
  }

  await ref.delete();
  if (report.type === "league_message" && report.context.leagueId) {
    // Same feed line a commissioner removal leaves, so members see why a
    // message vanished. Best-effort — the removal itself already landed.
    try {
      await createLeagueActivity(db, report.context.leagueId, {
        type: "message_removed",
        title: "Message Removed",
        message: "A site moderator removed a chat message.",
        userId: adminUid,
        metadata: { messageId: report.contentId },
      });
    } catch (error) {
      logger.warn(`[reports] league activity write failed: ${error.message}`);
    }
  }
  return true;
}

/**
 * Move a report through the queue, optionally removing the reported content.
 * request.data: { reportId, source, status, note?, removeContent? }
 *   - removeContent forces status "resolved" (resolution "content_removed")
 *     and resolves every other open report on the same content.
 *   - status "resolved" without removal records resolution "no_action".
 *   - "new" / "reviewed" reopen or triage; they clear the resolution.
 */
exports.resolveReport = onCall({ cors: true, timeoutSeconds: 30 }, async (request) => {
  const adminUid = assertAdmin(request);
  const db = getDb();

  const reportId = assertDocId(request.data?.reportId, "report ID");
  const source = request.data?.source;
  if (!Object.values(SOURCES).includes(source)) {
    throw new HttpsError("invalid-argument", "Unknown report source.");
  }
  const removeContent = request.data?.removeContent === true;
  const status = removeContent ? "resolved" : request.data?.status;
  if (!REPORT_STATUSES.includes(status)) {
    throw new HttpsError("invalid-argument", `Status must be one of: ${REPORT_STATUSES.join(", ")}`);
  }
  const rawNote = request.data?.note;
  if (rawNote != null && typeof rawNote !== "string") {
    throw new HttpsError("invalid-argument", "Note must be text.");
  }
  const note = rawNote ? rawNote.trim().slice(0, MAX_NOTE_LENGTH) || null : null;

  const reportRef = db.collection(source).doc(reportId);
  const reportSnap = await reportRef.get();
  if (!reportSnap.exists) {
    throw new HttpsError("not-found", "That report no longer exists.");
  }
  const report = normalizeReport(source, reportSnap);

  let contentRemoved = false;
  if (removeContent) {
    contentRemoved = await removeReportedContent(db, report, adminUid, note);
  }

  const resolution =
    status !== "resolved" ? null : removeContent ? "content_removed" : "no_action";
  const storedStatus = source === SOURCES.article ? toArticleStatus(status) : status;
  const done = status === "resolved";
  await reportRef.update({
    status: storedStatus,
    resolution,
    adminNote: note,
    reviewedAt: FieldValue.serverTimestamp(),
    resolvedAt: done ? FieldValue.serverTimestamp() : null,
    resolvedBy: done ? adminUid : null,
  });

  let siblingsResolved = 0;
  if (removeContent) {
    try {
      siblingsResolved = await resolveReportsForContent(db, {
        type: report.type,
        contentId: report.contentId,
        adminUid,
        resolution: "content_removed",
        note,
        excludeId: reportId,
      });
    } catch (error) {
      logger.warn(`[reports] sibling resolve failed for ${reportId}: ${error.message}`);
    }
  }

  logger.info("[reports] report updated", {
    reportId,
    source,
    status,
    resolution,
    contentRemoved,
    siblingsResolved,
    by: adminUid,
  });

  return { success: true, status, resolution, contentRemoved, siblingsResolved };
});

exports.resolveReportsForContent = resolveReportsForContent;
exports.countNewReports = countNewReports;
exports.normalizeReport = normalizeReport;
exports.REPORT_STATUSES = REPORT_STATUSES;
exports.REPORT_TYPES = REPORT_TYPES;
