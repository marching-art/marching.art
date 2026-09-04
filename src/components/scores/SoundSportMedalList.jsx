// SoundSport medal list — the one scoring surface with no numbers on it.
// SoundSport is rating-based: ensembles earn Gold/Silver/Bronze/Participation
// and their numeric scores are never shown anywhere in the product, so this
// list is deliberately shuffled to avoid implying a ranking.
//
// Lifted out of pages/ScoresParts.jsx (which had grown past the 700-line
// guardrail) and re-exported from there, so the Scores page's import surface
// is unchanged — the same move PillTabControl made.

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Music, ChevronRight, Medal, Users } from 'lucide-react';
import { TeamAvatar } from '../ui/TeamAvatar';
import { formatEventName } from '../../utils/season';
import { RATING_CONFIG, getSoundSportRating, seededShuffle } from '../../utils/scoresUtils';
import { BlueRibbonIcon, SheetMasthead } from './SheetPrimitives';
import { SHEET_CARD } from './sheetTokens';

// Mock event names for shows that may not have proper names
const MOCK_EVENT_NAMES = [
  'SoundSport International Music & Food Festival',
  'DCI Indianapolis SoundSport',
  'Atlanta SoundSport Showcase',
  'Midwest SoundSport Classic',
  'SoundSport Championship Series',
  'Summer Music Games SoundSport',
];

/**
 * One ensemble's result within a show, as the Scores page normalizes it.
 *
 * @typedef {Object} SoundSportScore
 * @property {string} [corps]
 * @property {string} [corpsName]
 * @property {string} [uid]
 * @property {string} [displayName]
 * @property {string|null} [avatarUrl]
 * @property {number} [score]
 * @property {string} [corpsClass]
 */

/**
 * A score with its medal tier resolved, plus the best-in-show flag.
 *
 * @typedef {SoundSportScore & {
 *   rating: import('../../utils/scoresUtils').SoundSportRating,
 *   isBestInShow?: boolean,
 * }} RatedScore
 */

/**
 * @typedef {Object} MedalGroup
 * @property {string} eventName
 * @property {string} date
 * @property {string} location
 * @property {RatedScore[]} scores
 */

/**
 * @param {Object} props
 * @param {Array<{eventName?: string, date?: string, location?: string,
 *   scores?: SoundSportScore[]}>} props.shows
 */
const SoundSportMedalList = ({ shows }) => {
  // Group results by event, preserving show context
  const groupedResults = useMemo(() => {
    /** @type {MedalGroup[]} */
    const groups = [];
    let mockNameIndex = 0;

    shows
      .filter((show) => show.scores?.some((s) => s.corpsClass === 'soundSport'))
      .forEach((show) => {
        /** @type {RatedScore[]} */
        const soundSportScores = (show.scores || [])
          .filter((s) => s.corpsClass === 'soundSport')
          .map((score) => ({
            ...score,
            rating: getSoundSportRating(score.score ?? 0),
          }));

        if (soundSportScores.length > 0) {
          // Find best in show (highest score at this event)
          const maxScore = Math.max(...soundSportScores.map((s) => s.score || 0));
          const bestInShowCorps =
            soundSportScores.find((s) => s.score === maxScore)?.corps ||
            soundSportScores.find((s) => s.score === maxScore)?.corpsName;

          // Mark best in show
          soundSportScores.forEach((score) => {
            const corpsName = score.corps || score.corpsName;
            score.isBestInShow = corpsName === bestInShowCorps;
          });

          // Use show eventName or mock one for display
          const eventName =
            show.eventName || MOCK_EVENT_NAMES[mockNameIndex % MOCK_EVENT_NAMES.length];

          // Shuffle to avoid implied rankings (SoundSport is rating-based, not placement-based)
          // Use deterministic shuffle so order is consistent on re-renders
          const shuffledScores = seededShuffle(soundSportScores, eventName);
          mockNameIndex++;

          groups.push({
            eventName,
            date: show.date || 'TBD',
            location: show.location || 'Various Locations',
            scores: shuffledScores,
          });
        }
      });

    return groups;
  }, [shows]);

  // Aggregate stats across all groups
  const stats = useMemo(() => {
    const counts = { Gold: 0, Silver: 0, Bronze: 0, Participation: 0, total: 0 };
    groupedResults.forEach((group) => {
      group.scores.forEach((r) => {
        counts[r.rating]++;
        counts.total++;
      });
    });
    return counts;
  }, [groupedResults]);

  if (groupedResults.length === 0) {
    return (
      <div className="p-8 text-center">
        <Music className="w-8 h-8 text-muted mx-auto mb-2" />
        <p className="text-muted text-sm">No SoundSport results yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stats summary card */}
      <div className={`${SHEET_CARD} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-green-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            SoundSport Results
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1 text-brand">
            <Medal className="w-3 h-3" />
            {stats.Gold}
          </span>
          <span className="flex items-center gap-1 text-secondary">
            <Medal className="w-3 h-3" />
            {stats.Silver}
          </span>
          <span className="flex items-center gap-1 text-orange-400">
            <Medal className="w-3 h-3" />
            {stats.Bronze}
          </span>
          <span className="text-muted">
            <Users className="w-3 h-3 inline mr-1" />
            {stats.total}
          </span>
        </div>
      </div>

      {/* Grouped Results by Event — one sheet card per event */}
      {groupedResults.map((group, groupIdx) => (
        <div key={groupIdx} className={`${SHEET_CARD} space-y-2.5`}>
          <SheetMasthead
            title={formatEventName(group.eventName)}
            location={group.location}
            date={group.date}
          />
          <div>
            {group.scores.map((result, idx) => {
              const config = RATING_CONFIG[result.rating];
              return (
                <div
                  key={idx}
                  className="px-1 py-1.5 flex items-center justify-between gap-2 border-b border-line-subtle last:border-b-0"
                >
                  {/* Left: Medal Icon + Avatar + Ensemble Name + Director */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-6 h-6 ${config.bg} flex items-center justify-center flex-shrink-0`}
                    >
                      <Medal className={`w-4 h-4 ${config.text}`} />
                    </div>
                    <TeamAvatar
                      name={result.corps || result.corpsName}
                      logoUrl={result.avatarUrl}
                      size="xs"
                    />
                    <div className="min-w-0">
                      <span className="font-bold text-white text-[11px] block truncate">
                        {result.corps || result.corpsName}
                      </span>
                      {result.displayName &&
                        (result.uid ? (
                          <Link
                            to={`/profile/${result.uid}`}
                            className="text-[10px] text-muted hover:text-interactive block truncate"
                          >
                            {result.displayName}
                          </Link>
                        ) : (
                          <span className="text-[10px] text-muted block truncate">
                            {result.displayName}
                          </span>
                        ))}
                    </div>
                  </div>

                  {/* Right: Best in Show + Rating Badge */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {result.isBestInShow && <BlueRibbonIcon className="w-5 h-5" />}
                    <span className={`text-[10px] font-bold uppercase px-2 py-1 ${config.badge}`}>
                      {result.rating}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* One scoring-explainer link for the whole page, not per show */}
      <Link
        to="/how-to-play"
        className="flex items-center gap-2 text-[10px] text-green-400 hover:text-green-300 font-bold uppercase tracking-wider transition-colors px-1 pt-1"
      >
        About SoundSport scoring
        <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  );
};

export { SoundSportMedalList };
