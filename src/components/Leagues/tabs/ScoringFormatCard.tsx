// The commissioner's scoring-format control.
//
// A league can decide its weeks as a best-of-three across General Effect,
// Visual and Music instead of one comparison of total score
// (docs/CAPTION_WARS_SPEC.md). It costs CorpsCoin, for one season, out of the
// commissioner's own balance — never per member, because the format is a
// property of a matchup and a member who declined to pay could only be
// excluded, not given a different one.
//
// Its own card rather than a field on LeagueSettingsForm: it is a purchase, it
// is refused once the season starts, and neither of those belongs in a form
// whose other fields save together and are free.

import React, { useState } from 'react';
import { Loader2, Music, Swords } from 'lucide-react';
import toast from 'react-hot-toast';

import { setLeagueScoringFormat } from '../../../api/functions';
import { CAPTION_CATEGORIES } from '../../../utils/captionWars';

/** Matches CAPTION_WARS_SEASON_COST in functions/src/helpers/captionWars.js. */
const SEASON_COST = 2000;

interface ScoringFormatCardProps {
  league?: {
    id?: string;
    seasonId?: string;
    settings?: { scoringFormat?: string; scoringFormatSeasonUid?: string };
  } | null;
  /** True once the season's first week has been generated — the server refuses after that. */
  seasonUnderway?: boolean;
  onChanged?: () => void;
}

const ScoringFormatCard = ({ league, seasonUnderway, onChanged }: ScoringFormatCardProps) => {
  const [saving, setSaving] = useState(false);

  // Both conditions, exactly as the server reads it: a format left over from a
  // previous season is not this season's format.
  const active =
    league?.settings?.scoringFormat === 'captionWars' &&
    !!league?.seasonId &&
    league?.settings?.scoringFormatSeasonUid === league.seasonId;

  const apply = async (format: 'total' | 'captionWars') => {
    if (!league?.id || saving) return;
    setSaving(true);
    try {
      const result = await setLeagueScoringFormat({ leagueId: league.id, format });
      toast.success(result.data?.message || 'Scoring format updated.');
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to change the scoring format');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface-card border border-line">
      <div className="px-4 py-3 border-b border-line bg-surface-raised flex items-center gap-2">
        <Swords className="w-4 h-4 text-muted" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
          Scoring Format
        </span>
        {active && (
          <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-purple-400">
            Caption Wars
          </span>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-purple-500/10 border border-purple-500/40">
            <Music className="w-4 h-4 text-purple-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">Caption Wars</p>
            <p className="text-xs text-muted mt-0.5">
              Every week is a best-of-three across{' '}
              {CAPTION_CATEGORIES.map((c) => c.label).join(', ')}. Take two captions and you take
              the week, whatever the totals say. Nobody&apos;s lineup changes — these are the same
              three groups the recap already shows.
            </p>
          </div>
        </div>

        {/* Say the two things that are easy to get wrong about the purchase
            before it is made, not after. */}
        <ul className="text-[11px] text-muted space-y-1 pl-1">
          <li>
            <strong className="text-white">{SEASON_COST.toLocaleString()} CC</strong> from your own
            balance. The prize pool is untouched.
          </li>
          <li>For this season only. It does not renew, and there are no refunds.</li>
          <li>Can only be changed before the league&apos;s first week is generated.</li>
        </ul>

        {seasonUnderway ? (
          <p className="text-[11px] text-muted border-t border-line-subtle pt-3">
            The season is under way, so the format is locked until it rolls over.
          </p>
        ) : (
          <div className="flex items-center gap-2 border-t border-line-subtle pt-3">
            <button
              onClick={() => apply(active ? 'total' : 'captionWars')}
              disabled={saving}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-bold transition-colors disabled:opacity-50 ${
                active
                  ? 'bg-surface-raised text-muted hover:text-white border border-line'
                  : 'bg-interactive text-white hover:opacity-90'
              }`}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {active
                ? 'Back to standard scoring'
                : `Enable for ${SEASON_COST.toLocaleString()} CC`}
            </button>
            {active && <span className="text-[11px] text-muted">Turning it off is free.</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScoringFormatCard;
