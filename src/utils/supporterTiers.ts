// Client mirror of the Buy Me a Coffee supporter tiers. Ids and `minAmount`
// MUST stay in sync with functions/src/helpers/bmacSupporters.js — the server
// derives the tier from the monthly amount and is authoritative; this mirror
// only drives display (settings panel, Supporters wall, profile flair).

export type SupporterTierId = 'rookie' | 'veteran' | 'staff' | 'corps_angel';

export interface SupporterTier {
  id: SupporterTierId;
  name: string;
  /** Monthly USD floor — must match the BMAC membership level price. */
  minAmount: number;
  /** Coffee cups shown as a quick visual weight. */
  coffees: string;
  /** One-line pitch for the tier. */
  blurb: string;
  /** Tailwind text color for the flair/badge. */
  color: string;
}

export const BMAC_URL = 'https://buymeacoffee.com/marching.art';

export const SUPPORTER_TIERS: SupporterTier[] = [
  {
    id: 'rookie',
    name: 'Rookie',
    minAmount: 3,
    coffees: '☕',
    blurb: 'Buy the corps a coffee and keep the game marching.',
    color: 'text-amber-400',
  },
  {
    id: 'veteran',
    name: 'Veteran',
    minAmount: 6,
    coffees: '☕☕',
    blurb: 'The everyday-fan tier — a coffee-cup frame and a spot on the wall.',
    color: 'text-cyan-400',
  },
  {
    id: 'staff',
    name: 'Staff',
    minAmount: 12,
    coffees: '☕☕☕',
    blurb: 'For the die-hard who would show up at 6am. Rare animated badge.',
    color: 'text-purple-400',
  },
  {
    id: 'corps_angel',
    name: 'Corps Angel',
    minAmount: 25,
    coffees: '☕✨',
    blurb: 'The patron who keeps the lights on. Pinned in gold with your message.',
    color: 'text-yellow-400',
  },
];

// Corps Angel is a prestige/reward surface where gold is on-role (like medals
// and champions). These surface class strings live here — with the tier color
// palette, in this design-census-allowlisted util — rather than as raw page
// chrome, so the page consumes them as categorical data.
export const ANGEL_STYLES = {
  card: 'border-yellow-500/50 bg-yellow-500/5',
  heading: 'text-yellow-400',
  message: 'text-yellow-200/90',
};
export const DEFAULT_CARD = 'border-line bg-surface-sunken';

const BY_ID: Record<string, SupporterTier> = SUPPORTER_TIERS.reduce(
  (acc, t) => {
    acc[t.id] = t;
    return acc;
  },
  {} as Record<string, SupporterTier>
);

/** Rank a tier for sorting (higher = more support). -1 for unknown ids. */
export function supporterTierRank(id?: string | null): number {
  return id ? SUPPORTER_TIERS.findIndex((t) => t.id === id) : -1;
}

/** Look up tier display metadata by id. */
export function getSupporterTier(id?: string | null): SupporterTier | null {
  return id ? (BY_ID[id] ?? null) : null;
}

/** Mirror of the server's tier-from-amount mapping (for previews only). */
export function tierFromMonthlyAmount(usd: number): SupporterTierId | null {
  if (!Number.isFinite(usd) || usd <= 0) return null;
  let match: SupporterTierId | null = null;
  for (const tier of SUPPORTER_TIERS) {
    if (usd + 1e-9 >= tier.minAmount) match = tier.id;
  }
  return match;
}
