// =============================================================================
// WRITER TIER — automatic, contribution-earned press credentials
// =============================================================================
// A director earns a writer credential automatically from how much they've
// contributed to the news hub. It is derived, never granted: there's no admin
// action and nothing to store beyond the counters the backend already keeps
// (articleStats.approvedCount, incremented on admin approval, and
// articleStats.pressReleaseCount, incremented when a press release publishes).
//
// Approved articles are weighted above press releases: an article is reviewed
// before it counts, while a press release is self-published, so the score
// leans on the higher-signal contribution and can't be farmed to the top tier
// with volume alone.

export interface WriterContribution {
  approvedCount?: number;
  pressReleaseCount?: number;
}

export type WriterTierId = 'contributor' | 'correspondent' | 'staff_writer';

export interface WriterTierDef {
  id: WriterTierId;
  label: string;
  /** Minimum weighted score to hold this tier. */
  minScore: number;
  textClass: string;
  bgClass: string;
  borderClass: string;
}

/** A reviewed article counts for more than a self-published press release. */
export const APPROVED_WEIGHT = 3;
export const PRESS_WEIGHT = 1;

/** Tiers ascending by threshold. Highest reached tier wins. */
export const WRITER_TIERS: WriterTierDef[] = [
  {
    id: 'contributor',
    label: 'Contributor',
    minScore: 3,
    textClass: 'text-teal-400',
    bgClass: 'bg-teal-500/15',
    borderClass: 'border-teal-500/40',
  },
  {
    id: 'correspondent',
    label: 'Correspondent',
    minScore: 12,
    textClass: 'text-interactive',
    bgClass: 'bg-interactive/15',
    borderClass: 'border-interactive/40',
  },
  {
    id: 'staff_writer',
    label: 'Staff Writer',
    minScore: 30,
    textClass: 'text-brand',
    bgClass: 'bg-brand/15',
    borderClass: 'border-brand/40',
  },
];

/** Weighted contribution score. */
export function writerScore(contribution: WriterContribution | null | undefined): number {
  const approved = Math.max(0, Math.floor(contribution?.approvedCount ?? 0));
  const press = Math.max(0, Math.floor(contribution?.pressReleaseCount ?? 0));
  return approved * APPROVED_WEIGHT + press * PRESS_WEIGHT;
}

/** The highest tier the director has earned, or null if not yet a contributor. */
export function getWriterTier(
  contribution: WriterContribution | null | undefined
): WriterTierDef | null {
  const score = writerScore(contribution);
  let earned: WriterTierDef | null = null;
  for (const tier of WRITER_TIERS) {
    if (score >= tier.minScore) earned = tier;
    else break;
  }
  return earned;
}

/** The next tier up (for progress hints), or null once at the top. */
export function nextWriterTier(
  contribution: WriterContribution | null | undefined
): WriterTierDef | null {
  const score = writerScore(contribution);
  return WRITER_TIERS.find((tier) => score < tier.minScore) ?? null;
}
