// Verifies that every user-derived string interpolated into the email HTML
// templates is escaped — user-chosen usernames, corps names (via rival event
// titles), submission headlines/summaries, and report reasons/excerpts must
// never land in an inbox as live HTML.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  EMAIL_TYPES,
  EMAIL_PREFERENCE_MAP,
  isEmailTypeEnabled,
  welcomeEmailTemplate,
  rivalContextEmailTemplate,
  winBackEmailTemplate,
  adminArticleSubmissionEmailTemplate,
  adminCommentReportEmailTemplate,
  adminPendingApprovalsDigestEmailTemplate,
} = require("./emailService");

const XSS = '<script>alert("xss")</script>';
const XSS_ESCAPED = "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;";

test("welcome email escapes the username", () => {
  const html = welcomeEmailTemplate({ username: XSS });
  assert.ok(!html.includes(XSS));
  assert.ok(html.includes(XSS_ESCAPED));
});

test("rival-context email escapes headline, username, and event fields", () => {
  const html = rivalContextEmailTemplate({
    username: XSS,
    headline: `${XSS} headline`,
    events: [
      {
        title: `Rival ${XSS} passed you`,
        detail: `Detail ${XSS}`,
        icon: "<b>!</b>",
        color: '#fff" onmouseover="alert(1)',
      },
    ],
  });
  assert.ok(!html.includes(XSS));
  assert.ok(!html.includes("<b>!</b>"));
  assert.ok(!html.includes('onmouseover="alert(1)"'));
  assert.ok(html.includes(XSS_ESCAPED));
  // The event color cannot break out of the style attribute.
  assert.ok(html.includes("#fff&quot; onmouseover=&quot;alert(1)"));
});

test("win-back email escapes the username", () => {
  const html = winBackEmailTemplate({
    username: XSS,
    daysMissed: 7,
    streakLost: 5,
    corpsCoinBalance: 100,
  });
  assert.ok(!html.includes(XSS));
  assert.ok(html.includes(XSS_ESCAPED));
});

test("admin submission email escapes headline, summary, author, and category", () => {
  const html = adminArticleSubmissionEmailTemplate({
    headline: `${XSS} big win`,
    summary: `Summary ${XSS}`,
    authorName: `author ${XSS}`,
    category: `dci ${XSS}`,
    submissionId: "sub<>&123",
  });
  assert.ok(!html.includes(XSS));
  assert.ok(html.includes(XSS_ESCAPED));
  // The submission id is URL-encoded into the review link, not interpolated raw.
  assert.ok(html.includes("id=sub%3C%3E%26123"));
});

test("admin comment report email escapes reason, excerpt, and names", () => {
  const html = adminCommentReportEmailTemplate({
    reason: `spam ${XSS}`,
    commentExcerpt: `excerpt ${XSS}`,
    commentAuthor: `author ${XSS}`,
    reporterName: `reporter ${XSS}`,
    articleId: "art<1>",
    reportId: `rep ${XSS}`,
  });
  assert.ok(!html.includes(XSS));
  assert.ok(html.includes(XSS_ESCAPED));
  assert.ok(html.includes("/article/art%3C1%3E"));
});

test("pending-approvals digest renders per-queue counts, links, and total", () => {
  const html = adminPendingApprovalsDigestEmailTemplate({
    pendingArticles: 2,
    pendingComments: 5,
    pendingReports: 1,
  });
  // Total (2 + 5 + 1 = 8) in the heading and preheader.
  assert.ok(html.includes("8 items awaiting review"));
  // Each queue's count is rendered.
  assert.ok(html.includes(">2<"));
  assert.ok(html.includes(">5<"));
  assert.ok(html.includes(">1<"));
  // Deep links to the two admin tabs.
  assert.ok(html.includes("https://marching.art/admin?tab=submissions"));
  assert.ok(html.includes("https://marching.art/admin?tab=moderation"));
  // Singular vs. plural is respected.
  assert.ok(html.includes("reported comment to review"));
  assert.ok(html.includes("comments awaiting moderation"));
});

test("pending-approvals digest hides empty queues and coerces bad counts", () => {
  const html = adminPendingApprovalsDigestEmailTemplate({
    pendingArticles: 3,
    pendingComments: 0,
    pendingReports: "not-a-number",
  });
  // Only the article row survives: total is 3.
  assert.ok(html.includes("3 items awaiting review"));
  assert.ok(html.includes("article submissions pending approval"));
  // Empty / invalid queues produce no row.
  assert.ok(!html.includes("awaiting moderation"));
  assert.ok(!html.includes("to review"));
});

test("trusted URLs and layout are not escaped", () => {
  const html = welcomeEmailTemplate({ username: "Sarah" });
  assert.ok(html.includes('<a href="https://marching.art/dashboard"'));
  assert.ok(html.includes("Welcome to the Field, Sarah!"));
});

// --- per-type opt-outs (N-H1) -------------------------------------------------
// The Settings modal writes camelCase keys; the senders used to look up the
// snake_case EMAIL_TYPES value and so ignored every per-type opt-out.

test("every engagement email type maps to a Settings-modal preference key", () => {
  for (const type of Object.values(EMAIL_TYPES)) {
    if (type.startsWith("admin_")) continue;
    assert.equal(typeof EMAIL_PREFERENCE_MAP[type], "string", `no preference key for ${type}`);
    assert.doesNotMatch(EMAIL_PREFERENCE_MAP[type], /_/, `${type} key must be camelCase`);
  }
});

test("a camelCase opt-out disables that email type", () => {
  const prefs = { allEmails: true, weeklyDigest: false, streakBroken: true };
  assert.equal(isEmailTypeEnabled(prefs, EMAIL_TYPES.WEEKLY_DIGEST), false);
  assert.equal(isEmailTypeEnabled(prefs, EMAIL_TYPES.STREAK_BROKEN), true);
  // Untouched types fall back to the caller's default.
  assert.equal(isEmailTypeEnabled(prefs, EMAIL_TYPES.WIN_BACK), true);
  assert.equal(isEmailTypeEnabled(prefs, EMAIL_TYPES.WIN_BACK, false), false);
});

test("allEmails:false wins over every per-type setting", () => {
  assert.equal(isEmailTypeEnabled({ allEmails: false, weeklyDigest: true }, EMAIL_TYPES.WEEKLY_DIGEST), false);
});

test("legacy snake_case keys are still honored; missing prefs default on", () => {
  assert.equal(isEmailTypeEnabled({ weekly_digest: false }, EMAIL_TYPES.WEEKLY_DIGEST), false);
  assert.equal(isEmailTypeEnabled(undefined, EMAIL_TYPES.WEEKLY_DIGEST), true);
  assert.equal(isEmailTypeEnabled(null, EMAIL_TYPES.MILESTONE_ACHIEVED), true);
  // Non-boolean junk never counts as an opt-out or an opt-in.
  assert.equal(isEmailTypeEnabled({ weeklyDigest: "no" }, EMAIL_TYPES.WEEKLY_DIGEST, false), false);
});
