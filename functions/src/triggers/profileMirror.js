// Keeps users/{uid}/profile/public in step with profile/data.
//
// Every write to a profile doc — the nightly scoring pass, a daily-login
// claim, a cosmetic edit — re-projects the public view (helpers/
// publicProfileMirror.js) and writes it to the sibling `public` doc, or
// deletes the sibling when the source is deleted. Writes that touch only
// private fields (a lineup save, a prediction pick, a CorpsCoin debit) are
// skipped: the before/after projections are compared first, so the mirror
// costs one extra write only when something public actually changed.
//
// Backfill for profiles that predate the trigger:
//   node src/scripts/backfillPublicProfiles.js --dry-run | --commit
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { paths } = require("../helpers/paths");
const { projectPublicProfile, publicProjectionEquals } = require("../helpers/publicProfileMirror");

exports.onProfileDataWritten = onDocumentWritten(
  {
    document: "artifacts/{namespace}/users/{userId}/profile/data",
    // The nightly scoring pass writes every active profile in a burst; the
    // mirror write is tiny, so a handful of instances keeps up without ever
    // becoming a fleet.
    maxInstances: 5,
    cpu: 1,
  },
  async (event) => {
    const { namespace, userId } = event.params;
    // Only the live namespace is mirrored (the path helpers are bound to it);
    // a frozen legacy namespace never receives profile writes anyway.
    if (!paths.users().startsWith(`artifacts/${namespace}/`)) return;
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    const publicRef = getDb().doc(paths.userProfilePublic(userId));

    try {
      if (!after) {
        await publicRef.delete();
        return;
      }
      const next = projectPublicProfile(after);
      // Skip when nothing public changed AND a mirror already exists (a
      // pre-trigger profile has no mirror yet — its first write must create it).
      if (before && publicProjectionEquals(projectPublicProfile(before), next)) {
        const existing = await publicRef.get();
        if (existing.exists) return;
      }
      await publicRef.set({ ...next, mirroredAt: new Date().toISOString() });
    } catch (error) {
      logger.error(`Public profile mirror failed for ${userId}:`, error);
    }
  }
);

module.exports = { onProfileDataWritten: exports.onProfileDataWritten };
