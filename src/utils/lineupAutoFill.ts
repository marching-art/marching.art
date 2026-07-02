// =============================================================================
// LINEUP AUTO-FILL
// =============================================================================
// Fills the empty captions of a lineup with distinct corps, maximizing total
// points without exceeding the point limit (hitting it exactly whenever the
// available point values allow). This is a small "choose K distinct items,
// maximize sum <= budget" knapsack, solved exactly with dynamic programming —
// a greedy highest-first pass can strand later captions with no affordable
// corps and rarely lands on the full budget.

export interface CorpsOption {
  corpsName: string;
  sourceYear?: string | number | null;
  points?: number;
}

export interface AutoFillResult {
  /** captionId -> "corpsName|sourceYear|points", existing picks preserved */
  lineup: Record<string, string>;
  /** true when every caption ended up filled */
  filledAll: boolean;
  /** total points of the whole lineup (existing picks + new fills) */
  totalPoints: number;
}

/** Encode a pick in the "name|year|points" format the lineup uses. */
function encodePick(corps: CorpsOption): string {
  return `${corps.corpsName}|${corps.sourceYear}|${corps.points}`;
}

/**
 * Fill every empty caption in `currentLineup` with a distinct corps from
 * `availableCorps`, maximizing the lineup's total points without exceeding
 * `pointLimit`. Existing picks are never changed. Corps already used in the
 * lineup (by name) are excluded; at most one entry per corps name is used
 * even when a corps appears with multiple source years.
 */
export function autoFillLineup(
  availableCorps: CorpsOption[],
  currentLineup: Record<string, string | null | undefined>,
  captionIds: string[],
  pointLimit: number
): AutoFillResult {
  const existing = Object.entries(currentLineup).filter(([, v]) => v) as [string, string][];
  const usedNames = new Set(existing.map(([, v]) => v.split('|')[0]));
  const usedPoints = existing.reduce((sum, [, v]) => sum + (parseFloat(v.split('|')[2]) || 0), 0);

  const remainingCaps = captionIds.filter((id) => !currentLineup[id]);
  const target = remainingCaps.length;
  const budget = pointLimit - usedPoints;

  const baseLineup: Record<string, string> = Object.fromEntries(existing);

  if (target === 0) {
    return { lineup: baseLineup, filledAll: true, totalPoints: usedPoints };
  }

  // Group candidates by corps name: at most one pick per name.
  const groups = new Map<string, CorpsOption[]>();
  for (const corps of availableCorps) {
    const pts = corps?.points ?? 0;
    if (!corps?.corpsName || usedNames.has(corps.corpsName)) continue;
    if (pts <= 0 || pts > budget) continue;
    const group = groups.get(corps.corpsName);
    if (group) group.push(corps);
    else groups.set(corps.corpsName, [corps]);
  }

  // dp[s] maps an achievable point sum (using exactly s picks) to one set of
  // picks producing it. Map keys keep this exact even for non-integer points.
  const dp: Array<Map<number, CorpsOption[]>> = Array.from({ length: target + 1 }, () => new Map());
  dp[0].set(0, []);

  for (const options of groups.values()) {
    // Iterate slot counts downward so every extension in this group derives
    // from states that existed before the group (one pick max per group).
    for (let s = target - 1; s >= 0; s--) {
      for (const [sum, picks] of dp[s]) {
        for (const option of options) {
          const newSum = sum + (option.points as number);
          if (newSum <= budget && !dp[s + 1].has(newSum)) {
            dp[s + 1].set(newSum, [...picks, option]);
          }
        }
      }
    }
  }

  // Prefer filling every caption; within that, maximize total points. If the
  // full fill is impossible (not enough distinct affordable corps), fall back
  // to the most captions we can fill, again maximizing points.
  let picks: CorpsOption[] = [];
  let picksSum = 0;
  for (let s = target; s >= 1; s--) {
    let bestSum = -1;
    for (const sum of dp[s].keys()) {
      if (sum > bestSum) bestSum = sum;
    }
    if (bestSum >= 0) {
      picks = dp[s].get(bestSum) as CorpsOption[];
      picksSum = bestSum;
      break;
    }
  }

  // Assign the picks to captions in order, biggest corps first.
  const orderedPicks = [...picks].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  const lineup = { ...baseLineup };
  orderedPicks.forEach((corps, i) => {
    lineup[remainingCaps[i]] = encodePick(corps);
  });

  return {
    lineup,
    filledAll: picks.length === target,
    totalPoints: usedPoints + picksSum,
  };
}
