// Unit tests for submissionForAuthor — the field allowlist that shapes a
// news_submissions doc for its OWN author (getMyNewsSubmissions). What matters
// here is what LEAVES the server: admin identities, the author's email, and
// publish paths must never ride along, and approved submissions must map to
// null (they surface as published articles, not queue entries).
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { submissionForAuthor } = require("./newsSubmissionsShared");

/** A fully-populated pending press-release submission doc, admin fields included. */
function pressSubmission(overrides = {}) {
  return {
    kind: "press_release",
    headline: "Aurora Announces 2026 Program",
    summary: "The corps reveals its championship-run show.",
    fullStory: "Full body text the author wrote.",
    category: "press",
    imageUrl: "https://example.com/photo.jpg",
    imageOption: "submitted",
    corpsClass: "worldClass",
    pressCorps: { corpsClass: "worldClass", corpsName: "Aurora", location: "Denver, CO" },
    status: "pending",
    authorUid: "uid-author",
    authorName: "Alex Director",
    authorUsername: "alexd",
    authorLocation: "Denver, CO",
    authorEmail: "author@example.com",
    createdAt: new Date("2026-08-30T12:00:00Z"),
    updatedAt: new Date("2026-08-30T12:00:00Z"),
    ...overrides,
  };
}

test("maps a pending press release to the author-facing shape", () => {
  const out = submissionForAuthor("sub-1", pressSubmission());
  assert.deepEqual(out, {
    id: "sub-1",
    kind: "press_release",
    status: "pending",
    headline: "Aurora Announces 2026 Program",
    summary: "The corps reveals its championship-run show.",
    category: "press",
    corpsName: "Aurora",
    createdAt: "2026-08-30T12:00:00.000Z",
    scheduledPublishAt: null,
    rejectionReason: null,
  });
});

test("never leaks non-allowlisted fields (email, admin uids, publish paths, body)", () => {
  const out = submissionForAuthor(
    "sub-2",
    pressSubmission({
      status: "rejected",
      rejectionReason: "Needs a real headline",
      rejectedBy: "uid-admin",
      approvedBy: "uid-admin",
      publishedPath: "news_hub/s1/days/day_3/articles/press_x",
    })
  );
  const allowed = [
    "id",
    "kind",
    "status",
    "headline",
    "summary",
    "category",
    "corpsName",
    "createdAt",
    "scheduledPublishAt",
    "rejectionReason",
  ];
  assert.deepEqual(Object.keys(out).sort(), [...allowed].sort());
  const serialized = JSON.stringify(out);
  assert.ok(!serialized.includes("author@example.com"));
  assert.ok(!serialized.includes("uid-admin"));
  assert.ok(!serialized.includes("news_hub"));
  assert.ok(!serialized.includes("Full body text"));
});

test("rejection reason comes through only on rejected submissions", () => {
  const rejected = submissionForAuthor(
    "sub-3",
    pressSubmission({ status: "rejected", rejectionReason: "Off-topic" })
  );
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.rejectionReason, "Off-topic");

  // A stale reason on a pending doc (e.g. after an admin un-rejects by hand)
  // must not resurface.
  const pending = submissionForAuthor(
    "sub-4",
    pressSubmission({ status: "pending", rejectionReason: "Off-topic" })
  );
  assert.equal(pending.rejectionReason, null);
});

test("approved submissions map to null — they live on as published articles", () => {
  assert.equal(submissionForAuthor("sub-5", pressSubmission({ status: "approved" })), null);
});

test("unknown or missing statuses and empty docs map to null", () => {
  assert.equal(submissionForAuthor("sub-6", pressSubmission({ status: "weird" })), null);
  assert.equal(submissionForAuthor("sub-7", pressSubmission({ status: undefined })), null);
  assert.equal(submissionForAuthor("sub-8", null), null);
  assert.equal(submissionForAuthor("sub-9", undefined), null);
});

test("a scheduled news submission keeps its kind, category, and publish time", () => {
  const out = submissionForAuthor("sub-10", {
    headline: "Circuit Week 6 Analysis",
    summary: "Who moved and why.",
    category: "fantasy",
    status: "scheduled",
    authorUid: "uid-author",
    createdAt: new Date("2026-08-29T15:00:00Z"),
    scheduledPublishAt: new Date("2026-08-30T18:00:00Z"),
  });
  assert.equal(out.kind, "news");
  assert.equal(out.category, "fantasy");
  assert.equal(out.corpsName, null);
  assert.equal(out.scheduledPublishAt, "2026-08-30T18:00:00.000Z");
});

test("tolerates Firestore Timestamp-like dates and garbage date values", () => {
  const timestampLike = { toDate: () => new Date("2026-08-28T10:30:00Z") };
  const out = submissionForAuthor("sub-11", {
    headline: "H".repeat(10),
    summary: "S".repeat(20),
    category: "press",
    status: "pending",
    createdAt: timestampLike,
    scheduledPublishAt: "not a date",
  });
  assert.equal(out.createdAt, "2026-08-28T10:30:00.000Z");
  assert.equal(out.scheduledPublishAt, null);
});

test("non-string content fields degrade to safe defaults, never throw", () => {
  const out = submissionForAuthor("sub-12", {
    status: "pending",
    headline: 42,
    summary: { nested: true },
    category: null,
    pressCorps: { corpsName: 7 },
  });
  assert.equal(out.headline, "");
  assert.equal(out.summary, "");
  assert.equal(out.category, "");
  assert.equal(out.corpsName, null);
});
