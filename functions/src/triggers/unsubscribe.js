/**
 * GET/POST /unsubscribe?t=<token> — one-click, no-login email opt-out.
 *
 * Backs the hosting rewrite (firebase.json + vercel.json). The token
 * (helpers/unsubscribeToken.js) names a uid and is signed with a key derived
 * from the Brevo API key, so the endpoint binds BREVO_API_KEY and nothing
 * else. Both verbs unsubscribe: mail clients implementing RFC 8058 POST
 * `List-Unsubscribe=One-Click` with no UI, humans clicking the footer link
 * GET a confirmation page. Idempotent — the write is a merge of
 * `settings.emailPreferences.allEmails: false`, the same switch the Settings
 * modal flips, which helpers/emailService.js isEmailTypeEnabled honours over
 * every per-type preference.
 */

const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { paths } = require("../helpers/paths");
const { escapeHtml } = require("../helpers/escapeHtml");
const { brevoApiKey, EMAIL_CONFIG } = require("../helpers/emailService");
const { deriveUnsubscribeKey, verifyUnsubscribeToken } = require("../helpers/unsubscribeToken");

/**
 * Turn off all engagement email for a director. Pure Firestore; exported for
 * tests. Returns false when the profile does not exist (a deleted account),
 * which the endpoint still reports as done — there is nothing left to send to.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} uid
 */
async function applyUnsubscribe(db, uid) {
  const ref = db.doc(paths.userProfile(uid));
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.set(
    {
      settings: {
        emailPreferences: {
          allEmails: false,
          unsubscribedAt: new Date().toISOString(),
          unsubscribedVia: "one_click",
        },
      },
    },
    { merge: true }
  );
  return true;
}

/**
 * The small confirmation / error page. Inline styles only — it is served
 * from a function, not the SPA, and must read fine with no stylesheet.
 * @param {"done" | "invalid"} state
 */
function renderUnsubscribePage(state) {
  const prefs = escapeHtml(EMAIL_CONFIG.unsubscribeUrl);
  const home = escapeHtml(EMAIL_CONFIG.appUrl);
  const body =
    state === "done"
      ? `<h1>You're unsubscribed</h1>
      <p>marching.art will stop sending you engagement email (digests, reminders, win-back notes).
      Emails you need to run your account, like password resets, still arrive.</p>
      <p>Changed your mind, or want just some of them back? Sign in and open
      <a href="${prefs}">Email Preferences</a>.</p>`
      : `<h1>That unsubscribe link didn't work</h1>
      <p>The link is incomplete or has expired. You can still turn email off after signing in, under
      <a href="${prefs}">Email Preferences</a>.</p>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>${state === "done" ? "Unsubscribed" : "Unsubscribe link invalid"} | marching.art</title>
  <style>
    body { margin: 0; background: #0f172a; color: #e2e8f0; font-family: -apple-system, system-ui, Segoe UI, Roboto, sans-serif; }
    main { max-width: 32rem; margin: 10vh auto; padding: 2rem; }
    h1 { font-size: 1.5rem; margin: 0 0 1rem; }
    p { line-height: 1.5; color: #94a3b8; }
    a { color: #7dd3fc; }
  </style>
</head>
<body>
  <main>
    <p><a href="${home}">marching.art</a></p>
    ${body}
  </main>
</body>
</html>`;
}

exports.getUnsubscribeHttp = onRequest(
  {
    cors: false,
    timeoutSeconds: 15,
    cpu: 1,
    secrets: [brevoApiKey],
  },
  async (req, res) => {
    if (req.method !== "GET" && req.method !== "POST") {
      res.set("Allow", "GET, POST").status(405).send("Method Not Allowed");
      return;
    }
    res.set("Cache-Control", "no-store");

    const token = req.query.t ?? req.body?.t;
    let apiKey = "";
    try {
      apiKey = brevoApiKey.value() || "";
    } catch {
      /* unbound secret: every token is invalid below */
    }
    const uid = verifyUnsubscribeToken(token, deriveUnsubscribeKey(apiKey));

    if (!uid) {
      if (req.method === "POST") {
        res.status(400).send("Invalid unsubscribe token");
        return;
      }
      res.status(400).type("html").send(renderUnsubscribePage("invalid"));
      return;
    }

    try {
      const existed = await applyUnsubscribe(getDb(), uid);
      logger.info(`One-click unsubscribe for ${uid} (profile ${existed ? "updated" : "missing"})`);
    } catch (error) {
      logger.error(`One-click unsubscribe failed for ${uid}:`, error);
      res.status(500).send("Could not update your email preferences. Please try again.");
      return;
    }

    if (req.method === "POST") {
      res.status(200).send("Unsubscribed");
      return;
    }
    res.status(200).type("html").send(renderUnsubscribePage("done"));
  }
);

exports.applyUnsubscribe = applyUnsubscribe;
exports.renderUnsubscribePage = renderUnsubscribePage;
