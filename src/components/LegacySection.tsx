// =============================================================================
// LEGACY ENDOWMENTS — the recurring CorpsCoin sink
// =============================================================================
// Every other sink in the shop is bought once and owned forever, so an active
// director exhausts the whole catalogue in about a year and every coin after
// that is dead surplus — in a game whose premise is a decades-long career. An
// endowment is repeatable forever and purely commemorative: it buys a permanent
// line in the director's record and nothing that touches a score.
//
// Prices and thresholds come from src/utils/legacy.ts, which legacy.test.ts
// pins against the server catalog the callable actually charges.

import { useState } from 'react';
import { Landmark, Coins, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { makeLegacyEndowment } from '../api/functions';
import {
  endowmentTiersInOrder,
  highestLegacyTitle,
  nextLegacyTitle,
  legacyBandProgress,
  legacyTotal,
  legacyCount,
  legacyEntries,
  canAfford,
  ENDOWMENT_BLURBS,
  DEDICATION_MAX_LENGTH,
  type LegacyEntry,
} from '../utils/legacy';

/** Firestore Timestamp | Date | ISO string -> a short date, or null. */
function formatEntryDate(value: unknown): string | null {
  let date: Date | null = null;
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    try {
      date = (value as { toDate: () => Date }).toDate();
    } catch {
      date = null;
    }
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    date = Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export interface LegacySectionProps {
  /** The signed-in director's profile (reads `legacy` and nothing else). */
  profile: unknown;
  /** Current CorpsCoin balance, for the affordability gate. */
  balance: number;
}

export const LegacySection = ({ profile, balance }: LegacySectionProps) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [dedication, setDedication] = useState('');

  const total = legacyTotal(profile);
  const count = legacyCount(profile);
  const entries = legacyEntries(profile);
  const currentTitle = highestLegacyTitle(total);
  const next = nextLegacyTitle(total);
  const progress = legacyBandProgress(total);

  const handleEndow = async (tierId: string, tierName: string) => {
    setBusy(tierId);
    try {
      const result = await makeLegacyEndowment({
        tierId,
        dedication: dedication.trim() || null,
      });
      toast.success(result.data.message || `${tierName} endowed.`);
      setDedication('');
    } catch (error) {
      toast.error((error as Error)?.message || 'Could not make the endowment');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mb-8">
      <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1 flex items-center gap-2">
        <Landmark className="w-3.5 h-3.5 text-secondary" />
        Legacy
      </h2>
      <p className="text-xs text-muted mb-3">
        Give coin back to the activity. Endowments never expire, can be made as often as you like,
        and change nothing about how you score — they are the record of what you put in.
      </p>

      {/* Standing: the cumulative total is the thing that grows for decades */}
      <div className="bg-surface-card border border-line p-4 mb-3">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <div>
            <p className="text-[9px] uppercase tracking-wider text-muted">Total endowed</p>
            <p className="text-xl font-bold text-brand font-data tabular-nums">
              {total.toLocaleString()} <span className="text-xs text-muted">CC</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wider text-muted">Standing</p>
            <p className="text-sm font-bold text-primary">{currentTitle?.name ?? 'Unrecognized'}</p>
          </div>
        </div>

        {next ? (
          <>
            <div className="h-1.5 bg-surface-sunken overflow-hidden mb-1">
              <div
                className="h-full bg-interactive"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted font-data tabular-nums">
              {next.remaining.toLocaleString()} CC to {next.name}
            </p>
          </>
        ) : (
          <p className="text-[10px] text-muted">
            Founding Legacy — the top of the ladder. Endowments still add to your total.
          </p>
        )}

        {count > 0 && (
          <p className="text-[10px] text-muted mt-2">
            {count.toLocaleString()} {count === 1 ? 'endowment' : 'endowments'} on the record
          </p>
        )}
      </div>

      {/* Optional dedication, applied to the next endowment made */}
      <div className="bg-surface-card border border-line p-3 mb-3">
        <label
          htmlFor="legacy-dedication"
          className="block text-[9px] uppercase tracking-wider text-muted mb-1"
        >
          Dedication (optional)
        </label>
        <input
          id="legacy-dedication"
          type="text"
          value={dedication}
          onChange={(event) => setDedication(event.target.value)}
          maxLength={DEDICATION_MAX_LENGTH}
          placeholder="For the 2009 horn line"
          className="w-full h-9 px-2 bg-background border border-line-muted text-sm text-primary placeholder:text-muted focus:border-interactive focus:outline-none"
        />
        <p className="text-[9px] text-muted mt-1">
          Attached to the next endowment you make. {dedication.length}/{DEDICATION_MAX_LENGTH}
        </p>
      </div>

      {/* The tiers */}
      <div className="grid gap-2 sm:grid-cols-2">
        {endowmentTiersInOrder().map((tier) => {
          const affordable = canAfford(balance, tier.id);
          return (
            <div key={tier.id} className="bg-surface-card border border-line p-3 flex flex-col">
              <p className="text-sm font-bold text-primary">{tier.name}</p>
              <p className="text-xs text-muted flex-1 mb-3">{ENDOWMENT_BLURBS[tier.id]}</p>
              <button
                type="button"
                onClick={() => handleEndow(tier.id, tier.name)}
                disabled={busy !== null || !affordable}
                className={`h-9 px-4 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
                  affordable
                    ? 'bg-interactive hover:bg-interactive-hover text-white'
                    : 'bg-surface-raised text-muted cursor-not-allowed'
                }`}
              >
                {busy === tier.id ? (
                  '...'
                ) : (
                  <>
                    <Coins className="w-3.5 h-3.5" />
                    <span className="font-data tabular-nums">{tier.price.toLocaleString()}</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* The record itself — the reason any of this is worth buying */}
      {entries.length > 0 && (
        <div className="bg-surface-card border border-line mt-3">
          <p className="text-[9px] uppercase tracking-wider text-muted px-3 pt-3">On the record</p>
          <ul className="p-3 space-y-1.5">
            {entries.map((entry: LegacyEntry, index: number) => {
              const when = formatEntryDate(entry.at);
              return (
                <li
                  key={`${entry.tierId ?? 'entry'}-${index}`}
                  className="flex items-start justify-between gap-3 text-[11px]"
                >
                  <span className="min-w-0">
                    <Check className="w-3 h-3 text-interactive inline-block mr-1 align-[-1px]" />
                    <span className="text-primary">{entry.name ?? entry.tierId}</span>
                    {entry.dedication && (
                      <span className="text-muted"> — “{entry.dedication}”</span>
                    )}
                  </span>
                  <span className="text-muted font-data tabular-nums whitespace-nowrap">
                    {(entry.amount ?? 0).toLocaleString()} CC
                    {when ? ` · ${when}` : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default LegacySection;
