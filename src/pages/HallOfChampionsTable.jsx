// The Hall of Champions' season sidebar row and the finalists table, split out
// of HallOfChampions.jsx (max-lines guardrail). Both render one Hall class key
// (either division — see hallOfChampionsMeta.CLASS_CONFIG) and swap the
// champion framing for SoundSport's blue-ribbon / rating presentation.

import React from 'react';
import { Calendar, ChevronRight, Crown, Hash, Medal, Music, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TeamAvatar } from '../components/ui/TeamAvatar';
import { getSoundSportRating, RATING_CONFIG } from '../utils/scoresUtils';
import { BlueRibbonIcon } from './HallOfChampionsParts';
import {
  RANK_META,
  isSoundSportClass,
  crownedAt,
  parseSeasonName,
  formatScore,
} from './hallOfChampionsMeta';

/** @typedef {import('../api/season').SeasonChampions} SeasonChampions */
/** @typedef {import('../api/season').SeasonChampionEntry} SeasonChampionEntry */

/**
 * One archived season in the sidebar list: its champion (or Best in Show) in
 * the active class.
 * @param {{
 *   season: SeasonChampions,
 *   isSelected: boolean,
 *   classKey: string,
 *   onSelect: (season: SeasonChampions) => void,
 * }} props
 */
export const SeasonRow = ({ season, isSelected, classKey, onSelect }) => {
  const champ = season.classes?.[classKey]?.[0];
  if (!champ) return null;
  const { type, year } = parseSeasonName(season.seasonName);
  const soundSport = isSoundSportClass(classKey);
  const crowning = crownedAt(classKey);
  // SoundSport is a ratings-only format — never surface the numeric score here.
  const rating =
    soundSport && typeof champ.score === 'number' ? getSoundSportRating(champ.score) : null;

  return (
    <button
      onClick={() => onSelect(season)}
      className={`
        w-full text-left px-4 py-3 border-b border-line transition-colors
        ${isSelected ? 'bg-interactive/15 border-l-2 border-l-interactive' : 'border-l-2 border-l-transparent hover:bg-surface-sunken'}
      `}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span
          className={`text-[11px] font-bold uppercase tracking-wider ${isSelected ? 'text-white' : 'text-secondary'}`}
        >
          {type}
        </span>
        <span className="text-[10px] text-muted font-data tabular-nums">{year}</span>
      </div>
      <div className="flex items-center gap-2 min-w-0">
        {soundSport ? (
          <BlueRibbonIcon className="w-3 h-3 flex-shrink-0" />
        ) : (
          <Crown className="w-3 h-3 text-brand flex-shrink-0" />
        )}
        <span className="text-xs text-white truncate min-w-0 flex-1">
          {champ.corpsName || champ.username || '—'}
        </span>
        {soundSport ? (
          <span className="text-[10px] font-bold uppercase tracking-wider text-secondary flex-shrink-0">
            {rating || '—'}
          </span>
        ) : (
          <span className="text-[10px] text-muted font-data tabular-nums flex-shrink-0">
            {formatScore(champ.score)}
          </span>
        )}
      </div>
      {/* The night the title was decided — Open/A at the Day 46 Class Finals,
          never the season's archive date. */}
      <div className="flex items-center gap-1.5 mt-1.5">
        <Calendar className="w-2.5 h-2.5 text-muted" />
        <span className="text-[10px] text-muted truncate">
          <span className="font-data tabular-nums">Day {crowning.day}</span> · {crowning.short}
        </span>
        {isSelected && <ChevronRight className="w-3 h-3 text-interactive ml-auto flex-shrink-0" />}
      </div>
    </button>
  );
};

/**
 * The season's podium / recognized ensembles for one class.
 * @param {{ champions: SeasonChampionEntry[], classKey: string }} props
 */
export const FinalistsTable = ({ champions, classKey }) => {
  if (!champions || champions.length === 0) return null;
  const soundSport = isSoundSportClass(classKey);
  const crowning = crownedAt(classKey);

  return (
    <div className="bg-surface-card border border-line">
      <div className="bg-surface-raised px-4 py-2.5 flex items-center justify-between border-b border-line">
        <div className="flex items-center gap-2">
          {soundSport ? (
            <Music className="w-3.5 h-3.5 text-interactive" />
          ) : (
            <Trophy className="w-3.5 h-3.5 text-brand" />
          )}
          <span className="text-[11px] font-bold uppercase tracking-wider text-secondary truncate">
            {soundSport ? 'Recognized Ensembles' : `${crowning.eventName} · Day ${crowning.day}`}
          </span>
        </div>
        <span className="text-[10px] text-muted font-data tabular-nums">
          {champions.length}{' '}
          {soundSport
            ? `Ensemble${champions.length !== 1 ? 's' : ''}`
            : `Finalist${champions.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* table-fixed keeps a long corps name from stretching the table past the
          viewport on mobile — the Corps column absorbs the remaining width and
          the name truncates instead of pushing the Score column off-screen. */}
      <table className="w-full table-fixed">
        <thead>
          <tr className="bg-surface-sunken border-b border-line">
            <th className="text-left py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-muted w-10">
              {soundSport ? '' : '#'}
            </th>
            <th className="text-left py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-muted">
              {soundSport ? 'Ensemble' : 'Corps'}
            </th>
            <th className="text-left py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-muted hidden sm:table-cell">
              Director
            </th>
            <th className="text-right py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-muted w-20">
              {soundSport ? 'Rating' : 'Score'}
            </th>
          </tr>
        </thead>
        <tbody>
          {champions.map((c, idx) => {
            const meta = (c.rank != null && RANK_META[c.rank]) || null;
            const rowBg = idx % 2 === 0 ? 'bg-surface-card' : 'bg-surface-sunken';
            const corpsName = c.corpsName || c.username || '—';
            const isBestInShow = soundSport && c.rank === 1;
            const rating =
              soundSport && typeof c.score === 'number' ? getSoundSportRating(c.score) : null;
            const ratingStyle = rating ? RATING_CONFIG[rating] : null;
            const highlight = soundSport ? isBestInShow : c.rank === 1;

            return (
              <tr
                key={`${c.uid}-${c.rank}-${idx}`}
                className={`${rowBg} border-b border-line last:border-b-0`}
              >
                <td className="py-2.5 px-3">
                  {soundSport ? (
                    <div className="flex items-center justify-center">
                      {isBestInShow ? (
                        <BlueRibbonIcon className="w-4 h-4" />
                      ) : (
                        <Music className="w-3 h-3 text-muted" />
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {meta ? (
                        <Medal className={`w-3.5 h-3.5 ${meta.medalColor}`} />
                      ) : (
                        <Hash className="w-3 h-3 text-muted" />
                      )}
                      <span className="text-xs font-bold text-secondary font-data tabular-nums">
                        {c.rank}
                      </span>
                    </div>
                  )}
                </td>
                <td className="py-2.5 px-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <TeamAvatar name={corpsName} logoUrl={c.avatarUrl} size="xs" />
                    <div className="min-w-0">
                      <span
                        className={`text-sm font-bold block truncate ${
                          highlight
                            ? soundSport
                              ? 'text-interactive'
                              : 'text-brand'
                            : 'text-white'
                        }`}
                      >
                        {corpsName}
                      </span>
                      {isBestInShow ? (
                        <span className="text-[10px] uppercase tracking-wider text-interactive">
                          Best in Show
                        </span>
                      ) : (
                        meta &&
                        !soundSport && (
                          <span className={`text-[10px] uppercase tracking-wider ${meta.accent}`}>
                            {meta.label}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-2.5 px-2 hidden sm:table-cell">
                  {c.uid ? (
                    <Link
                      to={`/profile/${c.uid}`}
                      className="text-xs text-muted hover:text-interactive transition-colors truncate block"
                    >
                      {c.username || '—'}
                    </Link>
                  ) : (
                    <span className="text-xs text-muted truncate block">{c.username || '—'}</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-right">
                  {soundSport ? (
                    ratingStyle ? (
                      <span
                        className={`inline-block text-[10px] font-bold uppercase px-2 py-1 ${ratingStyle.badge}`}
                      >
                        {rating}
                      </span>
                    ) : (
                      <span className="text-sm text-muted">—</span>
                    )
                  ) : (
                    <span
                      className={`text-sm font-bold font-data tabular-nums ${c.rank === 1 ? 'text-brand' : 'text-white'}`}
                    >
                      {formatScore(c.score)}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
