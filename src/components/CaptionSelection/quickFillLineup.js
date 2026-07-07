// Quick Fill lineup generation for the Caption Selection modal.
// Extracted from CaptionSelectionModal.jsx to keep that file within the
// max-lines lint budget. Pure logic — no React/DOM dependencies.

// Generate a lineup key matching the server format for duplicate checking.
export const generateLineupKey = (corpsClass, lineup) =>
  `${corpsClass}_${Object.values(lineup).filter(Boolean).sort().join('_')}`;

// Check if picking a corps leaves enough budget for the remaining slots.
const isViablePick = (availableCorps, corps, slotsAfterThis, budgetAfterPick, usedCorpsSet) => {
  if (slotsAfterThis === 0) return true;

  // Get corps that will still be available after this pick
  const remainingCorps = availableCorps
    .filter((c) => !usedCorpsSet.has(c.corpsName) && c.corpsName !== corps.corpsName)
    .sort((a, b) => a.points - b.points);

  // Calculate minimum points needed to fill remaining slots
  const minForRemaining = remainingCorps
    .slice(0, slotsAfterThis)
    .reduce((sum, c) => sum + c.points, 0);

  return budgetAfterPick >= minForRemaining;
};

// Generate a random lineup that fills all empty slots while targeting
// 95-100% of the point limit. Guarantees all captions are filled by
// reserving budget for remaining slots.
const generateRandomLineup = (availableCorps, selections, emptyCaptions, pointLimit) => {
  const newSelections = { ...selections };

  // Track which corps have been used
  const usedCorps = new Set(
    Object.values(newSelections)
      .filter(Boolean)
      .map((s) => s.split('|')[0])
  );

  const usedPoints = Object.values(newSelections).reduce(
    (t, s) => t + (s ? parseInt(s.split('|')[2]) || 0 : 0),
    0
  );
  let remainingBudget = pointLimit - usedPoints;

  // Shuffle empty captions for random ordering
  const shuffledCaptions = [...emptyCaptions].sort(() => Math.random() - 0.5);

  for (let i = 0; i < shuffledCaptions.length; i++) {
    const caption = shuffledCaptions[i];
    const slotsAfterThis = shuffledCaptions.length - i - 1;

    // Get all viable candidates (picking them leaves enough for remaining slots)
    const viableCandidates = availableCorps
      .filter((c) => !usedCorps.has(c.corpsName) && c.points <= remainingBudget)
      .filter((c) =>
        isViablePick(availableCorps, c, slotsAfterThis, remainingBudget - c.points, usedCorps)
      );

    if (viableCandidates.length === 0) {
      // Shouldn't happen with proper math, but safety fallback
      continue;
    }

    // Calculate target to aim for 95-100% utilization
    // Ideal per slot = distribute remaining budget evenly across remaining slots
    const idealPerSlot = Math.floor(remainingBudget / (slotsAfterThis + 1));

    // Prefer higher-point corps (to maximize budget usage) but within viable range
    // Sort by points descending and filter to those near ideal or above
    const sortedByPoints = [...viableCandidates].sort((a, b) => b.points - a.points);

    // Take candidates that are at least 70% of ideal (but still viable)
    const minPreferred = Math.floor(idealPerSlot * 0.7);
    let preferredCandidates = sortedByPoints.filter((c) => c.points >= minPreferred);

    // If no candidates meet preference, use all viable (prioritizing higher points)
    if (preferredCandidates.length === 0) {
      preferredCandidates = sortedByPoints;
    }

    // Randomly select from preferred candidates
    const randomIndex = Math.floor(Math.random() * preferredCandidates.length);
    const selected = preferredCandidates[randomIndex];

    newSelections[caption.id] = `${selected.corpsName}|${selected.sourceYear}|${selected.points}`;
    usedCorps.add(selected.corpsName);
    remainingBudget -= selected.points;
  }

  return newSelections;
};

// Auto-fill empty caption slots randomly while targeting 95-100% of the point
// limit. Ensures the generated lineup doesn't match any existing lineups by
// retrying up to 50 times. Returns { newSelections, filledCount } on success
// or { error } when no unique lineup could be produced.
export const generateQuickFillLineup = ({
  availableCorps,
  selections,
  captions,
  pointLimit,
  activeLineupKeys,
  corpsClass,
}) => {
  if (availableCorps.length === 0) return null;

  const emptyCaptions = captions.filter((c) => !selections[c.id]);
  if (emptyCaptions.length === 0) {
    return { alreadyFull: true };
  }

  // Try to generate a unique lineup (retry up to 50 times to avoid duplicates)
  const maxAttempts = 50;
  let attempt = 0;
  let newSelections;
  let lineupKey;

  do {
    newSelections = generateRandomLineup(availableCorps, selections, emptyCaptions, pointLimit);
    lineupKey = generateLineupKey(corpsClass, newSelections);
    attempt++;
  } while (activeLineupKeys.has(lineupKey) && attempt < maxAttempts);

  // Check if we found a unique lineup
  if (activeLineupKeys.has(lineupKey)) {
    return { error: 'duplicate' };
  }

  const filledCount = emptyCaptions.filter((c) => newSelections[c.id]).length;
  return { newSelections, filledCount };
};
