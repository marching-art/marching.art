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
    id: "full_lineup",
    order: 1,
    title: "Field a Full Corps",
    description: "Fill all 8 caption slots in your lineup",
    xp: 50,
    coin: 50,
    verify: "lineup",
  },
  {
    id: "register_shows",
    order: 2,
    title: "Hit the Road",
    description: "Register your corps for shows on the Schedule page",
    xp: 50,
    coin: 50,
    verify: "shows",
  },
  {
    id: "show_concept",
    order: 3,
    title: "Design Your Show",
    description: "Set a show concept — matching styles earn nightly CorpsCoin design bonuses",
    xp: 50,
    coin: 50,
    verify: "concept",
  },
  {
    id: "check_scores",
    order: 4,
    title: "Read the Recaps",
    description: "Scores drop overnight around 2 AM ET — check your first recap",
    xp: 25,
    coin: 0,
    verify: "trust",
  },
  {
    id: "make_prediction",
    order: 5,
    title: "Call Your Shot",
    description: "Submit a daily prediction from the dashboard",
    xp: 25,
    coin: 25,
    verify: "prediction",
  },
  {
    id: "caption_trade",
    order: 6,
    title: "Work the Trade Window",
    description: "Make a caption change during a weekly trade window (3 per week after Day 14)",
    xp: 50,
    coin: 50,
    verify: "trade",
  },
  {
    id: "join_league",
    order: 7,
    title: "Find Your Circuit",
    description: "Join a league to compete in weekly head-to-head matchups",
    xp: 75,
    coin: 100,
    verify: "league",
  },
  {
    id: "finish_season",
    order: 8,
    title: "Complete a Season",
    description: "Stay with your corps through Finals",
    xp: 100,
    coin: 100,
    verify: "season",
  },
];

/**
 * Podium Rookie Journey (Phase 7.2, PODIUM.md §7) — a separate
 * quest line walking a new Podium director through the daily loop: found,
 * rehearse, delegate, route, perform, shake hands, survive. Verified against
 * the profile display copy AND the server-only podium/state doc (passed as
 * the second verify argument by completeJourneyStep for podium_* steps).
 * Rewards are XP + CorpsCoin only — never competitive advantage.
 *
 * Client mirror: src/components/Podium/podiumConstants.js PODIUM_JOURNEY.
 */
const PODIUM_JOURNEY_STEPS = [
  {
    id: "podium_found",
    order: 101,
    title: "Found a Corps",
    description: "Found your Podium Class corps — pick a name, a challenge, a hometown",
    xp: 50,
    coin: 50,
    verify: "podium_found",
  },
  {
    id: "podium_rehearse",
    order: 102,
    title: "First Blocks",
    description: "Allocate your first rehearsal blocks — content installs, then it cleans",
    xp: 50,
    coin: 25,
    verify: "podium_rehearse",
  },
  {
    id: "podium_template",
    order: 103,
    title: "Hire the Assistant",
    description: "Save a rehearsal plan template so missed days still grow (at reduced yield)",
    xp: 50,
    coin: 25,
    verify: "podium_template",
  },
  {
    id: "podium_tour",
    order: 104,
    title: "Route the Tour",
    description: "Pick your first shows in the tour planner — miles cost money and legs",
    xp: 50,
    coin: 25,
    verify: "podium_tour",
  },
  {
    id: "podium_score",
    order: 105,
    title: "First Box Score",
    description: "Perform at a show and read your first full-caption recap sheet",
    xp: 75,
    coin: 50,
    verify: "podium_score",
  },
  {
    id: "podium_joint",
    order: 106,
    title: "Shake Hands",
    description: "Complete a joint rehearsal — the scrimmage report is the only scouting there is",
    xp: 75,
    coin: 50,
    verify: "podium_joint",
  },
  {
    id: "podium_season",
    order: 107,
    title: "Survive the Grind",
    description: "Finish a full Podium season — reputation is earned across years",
    xp: 100,
    coin: 100,
    verify: "podium_season",
  },
];

/**
 * Server-side verification per step, evaluated against the profile document.
 * 'trust' steps (page visits the server can't observe) always pass — same
 * trust model as the visit-type daily challenges. Podium steps additionally
 * receive the server-only podium/state doc (or null).
 */
function verifyJourneyStep(step, profileData, podiumState = null) {
  const corpsList = Object.values(profileData.corps || {}).filter(Boolean);
  const podiumCorps = (profileData.corps || {}).podiumClass || null;
  switch (step.verify) {
  case "lineup":
    return corpsList.some((c) => c.lineup && Object.keys(c.lineup).length === 8);
  case "shows":
    return corpsList.some((c) =>
      Object.values(c.selectedShows || {}).some((shows) => Array.isArray(shows) && shows.length > 0)
    );
  case "concept":
    // Must be the structured concept the synergy scorer reads — a legacy
    // free-text string doesn't count
    return corpsList.some((c) => !!(c.showConcept && c.showConcept.theme));
  case "prediction":
    return Object.keys(profileData.predictions || {}).length > 0;
  case "trade":
    return corpsList.some((c) => (c.weeklyTrades?.used || 0) > 0);
  case "league":
    return (profileData.leagueIds || []).length > 0;
  case "season":
    return (profileData.lifetimeStats?.totalSeasons || 0) >= 1;
  case "trust":
    return true;
  case "podium_found":
    return Boolean(podiumCorps && podiumCorps.corpsName);
  case "podium_rehearse":
    return Boolean(
      podiumState &&
          ((podiumState.today && podiumState.today.blocksUsed > 0) ||
            Object.values(podiumState.captions || {}).some((c) => c && c.lastRehearsedDay != null))
    );
  case "podium_template":
    return Boolean(podiumState && (podiumState.planTemplate || []).length > 0);
  case "podium_tour":
    return Boolean(podiumState && (podiumState.selectedShowDays || []).length > 0);
  case "podium_score":
    return Boolean(
      (podiumState && podiumState.lastTotal != null) ||
          (podiumCorps && podiumCorps.totalSeasonScore != null)
    );
  case "podium_joint":
    return Boolean(podiumState && (podiumState.jointHistory || []).length > 0);
  case "podium_season":
    return Boolean(podiumCorps && (podiumCorps.seasonHistory || []).length >= 1);
  default:
    return false;
  }
}

function getJourneyStep(stepId) {
  return (
    JOURNEY_STEPS.find((s) => s.id === stepId) ||
    PODIUM_JOURNEY_STEPS.find((s) => s.id === stepId) ||
    null
  );
}

module.exports = {
  JOURNEY_STEPS,
  PODIUM_JOURNEY_STEPS,
  verifyJourneyStep,
  getJourneyStep,
};
