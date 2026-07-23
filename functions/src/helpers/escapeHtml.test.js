const { test } = require("node:test");
const assert = require("node:assert/strict");

const { escapeHtml } = require("./escapeHtml");

test("escapes the five HTML-significant characters", () => {
  assert.equal(
    escapeHtml(`<script>alert("xss")</script> & 'quotes'`),
    "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &#39;quotes&#39;"
  );
});

test("escapes & first so entities are not double-escaped incorrectly", () => {
  assert.equal(escapeHtml("&lt;"), "&amp;lt;");
});

test("leaves plain text untouched", () => {
  assert.equal(escapeHtml("Mendota DBC — 68.198"), "Mendota DBC — 68.198");
});

test("coerces null/undefined to empty string", () => {
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
});

test("coerces non-strings", () => {
  assert.equal(escapeHtml(42), "42");
});

test("neutralizes attribute breakout attempts", () => {
  const out = escapeHtml(`" onmouseover="alert(1)`);
  assert.ok(!out.includes('"'));
  assert.equal(out, "&quot; onmouseover=&quot;alert(1)");
});
