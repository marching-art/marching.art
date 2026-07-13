// Nightly reconcile of Buy Me a Coffee supporters against the BMAC REST API.
//
// The webhook is the real-time path, but webhooks get dropped and BMAC never
// sends a "your membership lapsed" event for an expired card. So once a day we
// pull the authoritative active-membership list and: (1) upsert everyone still
// active, (2) mark inactive (and strip flair from) anyone we still have as
// active who is no longer in the list. This is what guarantees cancelled
// supporters actually lose their flair.

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const { getDb } = require("../config");
const { paths } = require("../helpers/paths");
const { parseSupporterEvent } = require("../helpers/bmacSupporters");
const {
  applyActiveSupport,
  applyInactiveSupport,
} = require("../helpers/supporterStore");

const bmacAccessToken = defineSecret("BMAC_ACCESS_TOKEN");

const BMAC_SUBSCRIPTIONS_URL =
  "https://developers.buymeacoffee.com/api/v1/subscriptions?status=active";
const MAX_PAGES = 50; // safety cap (~5k members) against a pagination loop

/**
 * Fetch every active membership record, following pagination.
 * @param {string} token
 * @returns {Promise<Array<object>>}
 */
async function fetchActiveMemberships(token) {
  const records = [];
  let url = BMAC_SUBSCRIPTIONS_URL;
  for (let page = 0; page < MAX_PAGES && url; page += 1) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`BMAC API ${res.status}: ${await res.text()}`);
    }
    const json = await res.json();
    if (Array.isArray(json.data)) records.push(...json.data);
    url = json.next_page_url || null;
  }
  return records;
}

exports.reconcileSupporters = onSchedule(
  { schedule: "every day 03:00", secrets: [bmacAccessToken], timeoutSeconds: 300 },
  async () => {
    const token = bmacAccessToken.value();
    if (!token) {
      logger.warn("reconcileSupporters: BMAC_ACCESS_TOKEN not set — skipping");
      return;
    }

    const db = getDb();
    let records;
    try {
      records = await fetchActiveMemberships(token);
    } catch (err) {
      logger.error("reconcileSupporters: fetch failed", err);
      return;
    }

    // Upsert everyone currently active; collect their hashes.
    const activeHashes = new Set();
    for (const record of records) {
      const parsed = parseSupporterEvent({ type: "membership.updated", data: record });
      if (!parsed || !parsed.tier) continue;
      activeHashes.add(parsed.emailHash);
      try {
        await applyActiveSupport(db, parsed);
      } catch (err) {
        logger.error("reconcileSupporters: upsert failed", { err: err.message });
      }
    }

    // Anyone we still hold as active but who isn't in the pulled list has
    // lapsed — revoke their flair.
    const activeSnap = await db
      .collection(paths.supporters())
      .where("active", "==", true)
      .get();
    let revoked = 0;
    for (const doc of activeSnap.docs) {
      if (!activeHashes.has(doc.id)) {
        try {
          await applyInactiveSupport(db, doc.id);
          revoked += 1;
        } catch (err) {
          logger.error("reconcileSupporters: revoke failed", { err: err.message });
        }
      }
    }

    logger.info("reconcileSupporters done", {
      active: activeHashes.size,
      revoked,
    });
  }
);
