/**
 * First Season Journey
 *
 * A one-time quest line that walks a new director through every core
 * mechanic — lineup, show registration, show concepts, recaps, predictions,
 * the trade-window system, leagues, and finishing a season. Each step pays
 * XP + CorpsCoin once, validated server-side by completeJourneyStep
 * (callable/journey.js) against profile state wherever the game records it.
 *
 * Completion is stored on the profile as journey.{stepId} = ISO timestamp
 * (a server-only field in firestore.rules — steps carry currency).
 *
 * The client mirror of this catalog lives in
 * src/components/Dashboard/sections/JourneyPanel.jsx — keep ids in sync.
 */

const JOURNEY_STEPS = [
  {
    id: 'full_lineup',
    order: 1,
    title: 'Field a Full Corps',
    description: 'Fill all 8 caption slots in your lineup',
    xp: 50,
    coin: 50,
    verify: 'lineup',
  },
  {
    id: 'register_shows',
    order: 2,
    title: 'Hit the Road',
    description: 'Register your corps for shows on the Schedule page',
    xp: 50,
    coin: 50,
    verify: 'shows',
  },
  {
    id: 'show_concept',
    order: 3,
    title: 'Design Your Show',
    description: 'Set a show concept — theme, music, and drill earn synergy bonuses at scoring',
    xp: 50,
    coin: 50,
    verify: 'concept',
  },
  {
    id: 'check_scores',
    order: 4,
    title: 'Read the Recaps',
    description: 'Scores drop overnight around 2 AM ET — check your first recap',
    xp: 25,
    coin: 0,
    verify: 'trust',
  },
  {
    id: 'make_prediction',
    order: 5,
    title: 'Call Your Shot',
    description: 'Submit a daily prediction from the dashboard',
    xp: 25,
    coin: 25,
    verify: 'prediction',
  },
  {
    id: 'caption_trade',
    order: 6,
    title: 'Work the Trade Window',
    description: 'Make a caption change during a weekly trade window (3 per week after Day 14)',
    xp: 50,
    coin: 50,
    verify: 'trade',
  },
  {
    id: 'join_league',
    order: 7,
    title: 'Find Your Circuit',
    description: 'Join a league to compete in weekly head-to-head matchups',
    xp: 75,
    coin: 100,
    verify: 'league',
  },
  {
    id: 'finish_season',
    order: 8,
    title: 'Complete a Season',
    description: 'Stay with your corps through Finals',
    xp: 100,
    coin: 100,
    verify: 'season',
  },
];

/**
 * Server-side verification per step, evaluated against the profile document.
 * 'trust' steps (page visits the server can't observe) always pass — same
 * trust model as the visit-type daily challenges.
 */
function verifyJourneyStep(step, profileData) {
  const corpsList = Object.values(profileData.corps || {}).filter(Boolean);
  switch (step.verify) {
    case 'lineup':
      return corpsList.some((c) => c.lineup && Object.keys(c.lineup).length === 8);
    case 'shows':
      return corpsList.some((c) =>
        Object.values(c.selectedShows || {}).some((shows) => Array.isArray(shows) && shows.length > 0)
      );
    case 'concept':
      return corpsList.some((c) => !!c.showConcept);
    case 'prediction':
      return Object.keys(profileData.predictions || {}).length > 0;
    case 'trade':
      return corpsList.some((c) => (c.weeklyTrades?.used || 0) > 0);
    case 'league':
      return (profileData.leagueIds || []).length > 0;
    case 'season':
      return (profileData.lifetimeStats?.totalSeasons || 0) >= 1;
    case 'trust':
      return true;
    default:
      return false;
  }
}

function getJourneyStep(stepId) {
  return JOURNEY_STEPS.find((s) => s.id === stepId) || null;
}

module.exports = {
  JOURNEY_STEPS,
  verifyJourneyStep,
  getJourneyStep,
};
