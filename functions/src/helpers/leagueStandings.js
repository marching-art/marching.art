/**
 * League standings updater — shared by the commissioner callable
 * (callable/leagues.js updateMatchupResults) and the automatic weekly
 * matchup resolution in the nightly scoring run
 * (helpers/scoringAwards.js processWeeklyMatchups).
 *
 * Takes resolved pairs in the shape both producers emit:
 *   { player1, player2|null, player1Score?, player2Score?,
 *     winner: uid | 'tie', completed: boolean }
 * and folds them into the league's standings/current doc (records map +
 * sorted standings array the frontend reads).
 *
 * NOT idempotent per pair — callers must ensure each pair is folded in
 * exactly once (the automatic path runs inside the scoringRunGuard claim;
 * the callable skips already-completed matchups).
 */

const admin = require("firebase-admin");

async function updateStandings(db, leagueRef, pairs) {
  const standingsRef = leagueRef.collection('standings').doc('current');
  const standingsDoc = await standingsRef.get();

  if (!standingsDoc.exists) return;

  const records = { ...standingsDoc.data().records };

  pairs.forEach(pair => {
    if (!pair.completed || pair.winner === null) return;

    if (pair.player2 === null) {
      // Bye week - count as a win
      if (records[pair.player1]) {
        records[pair.player1].wins += 1;
        records[pair.player1].currentStreak = records[pair.player1].streakType === 'W'
          ? records[pair.player1].currentStreak + 1
          : 1;
        records[pair.player1].streakType = 'W';
      }
    } else if (pair.winner === 'tie') {
      // Tie
      if (records[pair.player1]) {
        records[pair.player1].ties += 1;
        records[pair.player1].pointsFor += pair.player1Score || 0;
        records[pair.player1].pointsAgainst += pair.player2Score || 0;
        records[pair.player1].currentStreak = 0;
        records[pair.player1].streakType = null;
      }
      if (records[pair.player2]) {
        records[pair.player2].ties += 1;
        records[pair.player2].pointsFor += pair.player2Score || 0;
        records[pair.player2].pointsAgainst += pair.player1Score || 0;
        records[pair.player2].currentStreak = 0;
        records[pair.player2].streakType = null;
      }
    } else {
      // One player won
      const loser = pair.winner === pair.player1 ? pair.player2 : pair.player1;

      if (records[pair.winner]) {
        records[pair.winner].wins += 1;
        records[pair.winner].pointsFor += (pair.winner === pair.player1 ? pair.player1Score : pair.player2Score) || 0;
        records[pair.winner].pointsAgainst += (pair.winner === pair.player1 ? pair.player2Score : pair.player1Score) || 0;
        records[pair.winner].currentStreak = records[pair.winner].streakType === 'W'
          ? records[pair.winner].currentStreak + 1
          : 1;
        records[pair.winner].streakType = 'W';
      }

      if (records[loser]) {
        records[loser].losses += 1;
        records[loser].pointsFor += (loser === pair.player1 ? pair.player1Score : pair.player2Score) || 0;
        records[loser].pointsAgainst += (loser === pair.player1 ? pair.player2Score : pair.player1Score) || 0;
        records[loser].currentStreak = records[loser].streakType === 'L'
          ? records[loser].currentStreak + 1
          : 1;
        records[loser].streakType = 'L';
      }
    }
  });

  // Convert records object to sorted standings array (for frontend compatibility)
  const standings = Object.entries(records)
    .map(([uid, data]) => ({
      uid,
      wins: data.wins || 0,
      losses: data.losses || 0,
      ties: data.ties || 0,
      totalPoints: data.pointsFor || 0,
      pointsAgainst: data.pointsAgainst || 0,
      streak: data.currentStreak || 0,
      streakType: data.streakType || null,
    }))
    .sort((a, b) => {
      // Sort by wins, then by total points
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.totalPoints - a.totalPoints;
    });

  await standingsRef.update({
    records,
    standings, // Array format for frontend API
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  });
}

module.exports = { updateStandings };
