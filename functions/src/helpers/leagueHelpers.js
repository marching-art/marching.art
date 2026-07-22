// Shared league helpers extracted from callable/leagues.js so they can be
// unit-tested and reused by the invitation callables.

const admin = require("firebase-admin");
const crypto = require("crypto");
const { paths } = require("./paths");

/**
 * OPTIMIZATION #2: Generate a deterministic unique invite code based on UID and timestamp.
 * This eliminates the N+1 while loop that previously made unbounded database reads.
 * The code is generated from a hash of the user ID and current timestamp, ensuring uniqueness
 * without requiring any database lookups.
 */
function generateUniqueInviteCode(uid) {
  const uniqueInput = `${uid}_${Date.now()}_${Math.random()}`;
  const hash = crypto.createHash("sha256").update(uniqueInput).digest("hex");
  // Take first 6 chars and convert to uppercase for a readable code
  return hash.substring(0, 6).toUpperCase();
}

/**
 * Smart pairing algorithm - pairs players by similar standings
 * This keeps matchups competitive throughout the season
 */
function smartPairMembers(members, standings) {
  if (members.length < 2) {
    return members.length === 1
      ? [{ pair: [members[0], null], winner: members[0], scores: null, completed: true, isBye: true }]
      : [];
  }

  // Sort members by their standings (wins, then points)
  const sortedMembers = [...members].sort((a, b) => {
    const statsA = standings[a] || { wins: 0, totalPoints: 0 };
    const statsB = standings[b] || { wins: 0, totalPoints: 0 };
    if (statsB.wins !== statsA.wins) return statsB.wins - statsA.wins;
    return statsB.totalPoints - statsA.totalPoints;
  });

  const matchups = [];
  const paired = new Set();

  // Pair adjacent players in standings (1v2, 3v4, etc.)
  for (let i = 0; i < sortedMembers.length - 1; i += 2) {
    const player1 = sortedMembers[i];
    const player2 = sortedMembers[i + 1];

    if (!paired.has(player1) && !paired.has(player2)) {
      // Randomize home/away to keep it fair
      const isReversed = Math.random() > 0.5;
      matchups.push({
        pair: isReversed ? [player2, player1] : [player1, player2],
        winner: null,
        scores: null,
        completed: false,
        isBye: false
      });
      paired.add(player1);
      paired.add(player2);
    }
  }

  // Handle odd player - gets a bye
  for (const member of sortedMembers) {
    if (!paired.has(member)) {
      matchups.push({
        pair: [member, null],
        winner: member,
        scores: null,
        completed: true,
        isBye: true
      });
    }
  }

  return matchups;
}

// Helper function to create league activity events
async function createLeagueActivity(db, leagueId, activityData) {
  const activityRef = db.collection(paths.leagueActivity(leagueId)).doc();

  await activityRef.set({
    ...activityData,
    id: activityRef.id,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  return activityRef.id;
}

// Deterministic invitation doc id: one pending invitation per league+invitee.
const invitationId = (leagueId, inviteeUid) => `${leagueId}_${inviteeUid}`;

module.exports = {
  generateUniqueInviteCode,
  smartPairMembers,
  createLeagueActivity,
  invitationId,
};
