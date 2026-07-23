// HTML escaping for user-derived strings interpolated into email templates.
// Every username, corps name, headline, reason, excerpt, or other value a user
// can influence MUST pass through escapeHtml() before landing in an HTML
// string, or it becomes stored XSS in the recipient's inbox.

/**
 * Escape a value for safe interpolation into HTML.
 *
 * Escapes the five significant characters, so the result is safe both in
 * element content and inside single- or double-quoted attribute values.
 * Null/undefined become the empty string.
 *
 * @param {*} value - User-derived value (coerced to string).
 * @returns {string} HTML-safe string.
 */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

module.exports = { escapeHtml };
