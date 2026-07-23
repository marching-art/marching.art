// Verifies that every user-derived string interpolated into the email HTML
// templates is escaped — user-chosen usernames, corps names (via rival event
// titles), submission headlines/summaries, and report reasons/excerpts must
// never land in an inbox as live HTML.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  welcomeEmailTemplate,
  rivalContextEmailTemplate,
  winBackEmailTemplate,
  adminArticleSubmissionEmailTemplate,
  adminCommentReportEmailTemplate,
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

test("trusted URLs and layout are not escaped", () => {
  const html = welcomeEmailTemplate({ username: "Sarah" });
  assert.ok(html.includes('<a href="https://marching.art/dashboard"'));
  assert.ok(html.includes("Welcome to the Field, Sarah!"));
});
