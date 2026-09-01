// The commissioner's scoring-format control.
//
// A league can decide its weeks as a best-of-three across General Effect,
// Visual and Music (Caption Wars, docs/CAPTION_WARS_SPEC.md) or on each
// director's best single show (One-Night Slate,
// functions/src/helpers/oneNightSlate.js) instead of one comparison of total
// score. Each costs CorpsCoin, for one season, out of the commissioner's own
// balance — never per member, because the format is a property of a matchup
// and a member who declined to pay could only be excluded, not given a
// different one.
//
// Its own card rather than a field on LeagueSettingsForm: it is a purchase, it
// is refused once the season starts, and neither of those belongs in a form
// whose other fields save together and are free.

import React, { useState } from 'react';
import { Loader2, Moon, Music, Swords } from 'lucide-react';
import toast from 'react-hot-toast';

import { setLeagueScoringFormat } from '../../../api/functions';
import { CAPTION_CATEGORIES, CAPTION_WARS_SEASON_COST } from '../../../utils/captionWars';
import { ONE_NIGHT_SEASON_COST } from '../../../utils/oneNightSlate';

type PaidFormat = 'captionWars' | 'oneNight';

const FORMATS: Array<{
  id: PaidFormat;
  name: string;
  cost: number;
  icon: React.ComponentType<{ className?: string }>;
  iconClasses: string;
  description: string;
}> = [
  {
    id: 'captionWars',
    name: 'Caption Wars',
    cost: CAPTION_WARS_SEASON_COST,
    icon: Music,
    iconClasses: 'bg-purple-500/10 border-purple-500/40 text-purple-400',
    description:
      `Every week is a best-of-three across ${CAPTION_CATEGORIES.map((c) => c.label).join(', ')}. ` +
      "Take two captions and you take the week, whatever the totals say. Nobody's lineup " +
      'changes — these are the same three groups the recap already shows.',
  },
  {
    id: 'oneNight',
    name: 'One-Night Slate',
    cost: ONE_NIGHT_SEASON_COST,
    icon: Moon,
    iconClasses: 'bg-teal-500/10 border-teal-500/40 text-teal-400',
    description:
      'Every week comes down to your best single show — one great night beats a week of ' +
      'grinding. Identical peaks fall to the weekly total, so the fuller week still breaks ' +
      "the tie. Nobody's lineup changes.",
  },
];

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
  const seasonPinned =
    !!league?.seasonId && league?.settings?.scoringFormatSeasonUid === league.seasonId;
  const activeFormat = seasonPinned ? league?.settings?.scoringFormat : undefined;
  const activeName = FORMATS.find((f) => f.id === activeFormat)?.name;

  const apply = async (format: 'total' | PaidFormat) => {
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
        {activeName && (
          <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-purple-400">
            {activeName}
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {FORMATS.map((format) => {
          const isActive = activeFormat === format.id;
          const Icon = format.icon;
          return (
            <div key={format.id} className="space-y-2">
              <div className="flex items-start gap-3">
                <div
                  className={`w-8 h-8 flex-shrink-0 flex items-center justify-center border ${format.iconClasses}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">
                    {format.name}
                    {isActive && (
                      <span className="ml-2 text-[9px] font-bold uppercase tracking-wider text-teal-400">
                        Active
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted mt-0.5">{format.description}</p>
                </div>
              </div>

              {!seasonUnderway && (
                <div className="flex items-center gap-2 pl-11">
                  <button
                    onClick={() => apply(isActive ? 'total' : format.id)}
                    disabled={saving}
                    className={`flex items-center gap-2 px-3 py-2 text-xs font-bold transition-colors disabled:opacity-50 ${
                      isActive
                        ? 'bg-surface-raised text-muted hover:text-white border border-line'
                        : 'bg-interactive text-white hover:opacity-90'
                    }`}
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    {isActive
                      ? 'Back to standard scoring'
                      : `Enable for ${format.cost.toLocaleString()} CC`}
                  </button>
                  {isActive && (
                    <span className="text-[11px] text-muted">Turning it off is free.</span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Say the things that are easy to get wrong about the purchase before
            it is made, not after. */}
        <ul className="text-[11px] text-muted space-y-1 pl-1 border-t border-line-subtle pt-3">
          <li>
            Paid from <strong className="text-white">your own balance</strong>. The prize pool is
            untouched.
          </li>
          <li>For this season only. It does not renew, and there are no refunds.</li>
          <li>Can only be changed before the league&apos;s first week is generated.</li>
        </ul>

        {seasonUnderway && (
          <p className="text-[11px] text-muted border-t border-line-subtle pt-3">
            The season is under way, so the format is locked until it rolls over.
          </p>
        )}
      </div>
    </div>
  );
};

export default ScoringFormatCard;
