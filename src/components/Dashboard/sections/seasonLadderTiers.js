// Season reward ladder tier table — shared by SeasonLadderPanel and the
// Director's Report (pending-claim row). Lives outside the component file so
// SeasonLadderPanel only exports components (react-refresh/only-export-components).
// Mirrors functions/src/helpers/seasonLadder.js LADDER_TIERS — keep in sync.

export const TIERS = [
  { tier: 1, xp: 150, coin: 50 },
  { tier: 2, xp: 300, coin: 50 },
  { tier: 3, xp: 500, coin: 75 },
  { tier: 4, xp: 750, coin: 75 },
  { tier: 5, xp: 1000, coin: 100 },
  { tier: 6, xp: 1300, coin: 100 },
  { tier: 7, xp: 1600, coin: 125 },
  { tier: 8, xp: 2000, coin: 150 },
  { tier: 9, xp: 2400, coin: 175 },
  { tier: 10, xp: 2800, coin: 200 },
  { tier: 11, xp: 3200, coin: 250 },
  { tier: 12, xp: 3600, coin: 300, exclusive: 'Laureate title' },
];
