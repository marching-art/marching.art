// The weekly matchup strip: one pairing, home vs. away, with scores, records,
// class badge, and the caption strip once the week is decided.

import React, { memo } from 'react';
import { Swords, Flame } from 'lucide-react';
import { getSoundSportRating } from '../../../utils/scoresUtils';
import { formatTally } from '../../../utils/captionWars';
import CaptionStrip from '../CaptionStrip';
import { CORPS_CLASS_CONFIG, type TabMatchup, type TabStanding } from './matchupsTabConfig';

const VersusStrip = memo(
  ({
    matchup,
    getDisplayName,
    getStanding,
    userProfile,
    isRivalry = false,
    onClick,
    featured = false,
    showClass = false,
  }: {
    matchup: TabMatchup;
    getDisplayName: (uid?: string | null) => string;
    getStanding: (uid?: string | null) => TabStanding | null | undefined;
    userProfile?: { uid?: string } | null;
    isRivalry?: boolean;
    onClick?: () => void;
    featured?: boolean;
    showClass?: boolean;
  }) => {
    const [p1_uid, p2_uid] = matchup.pair || [null, null];
    const isBye = !p2_uid;

    const home = {
      name: getDisplayName(p1_uid),
      standing: getStanding(p1_uid),
      isUser: p1_uid === userProfile?.uid,
      score: (p1_uid && matchup.scores?.[p1_uid]) || 0,
    };

    const away = {
      name: getDisplayName(p2_uid),
      standing: p2_uid ? getStanding(p2_uid) : null,
      isUser: p2_uid === userProfile?.uid,
      score: (p2_uid && matchup.scores?.[p2_uid]) || 0,
    };

    const homeWon = matchup.completed && matchup.winner === p1_uid;
    const awayWon = matchup.completed && matchup.winner === p2_uid;
    // 'tie' is the stored convention; legacy docs used null for ties.
    const isTie = matchup.completed && (matchup.winner === 'tie' || !matchup.winner);

    const classConfig = matchup.corpsClass ? CORPS_CLASS_CONFIG[matchup.corpsClass] : undefined;
    // SoundSport is a ratings-only format — a SoundSport matchup must show the
    // earned rating tiers, never the numeric scores.
    const isSoundSport = matchup.corpsClass === 'soundSport';
    // Cross-class matchups (each side in its own class) are decided on the
    // class percentile, so the percentile is the result and the raw totals are
    // the supporting detail — same hierarchy Caption Wars uses for its tally.
    const isCrossClass = Boolean(matchup.crossClass);
    const homePct = p1_uid != null ? matchup.normalized?.[p1_uid] : undefined;
    const awayPct = p2_uid != null ? matchup.normalized?.[p2_uid] : undefined;
    const sideClassName = (uid: string | null) => {
      const cls = uid ? matchup.classes?.[uid] : undefined;
      return cls ? CORPS_CLASS_CONFIG[cls]?.name || cls : undefined;
    };
    // The default format decides on each side's PER-SHOW AVERAGE across the
    // week (the weekly total rewarded attendance), so a settled default-format
    // matchup leads with the average and shows the totals underneath. Weeks
    // resolved before averages were recorded fall back to the totals.
    const homeAvg = p1_uid != null ? matchup.averages?.[p1_uid] : undefined;
    const awayAvg = p2_uid != null ? matchup.averages?.[p2_uid] : undefined;
    const hasAverages = typeof homeAvg === 'number' && typeof awayAvg === 'number';
    const sideLabel = (value: number) =>
      isSoundSport ? (value > 0 ? getSoundSportRating(value) : '—') : value.toFixed(1);
    // One side's best single show (One-Night Slate). SoundSport is ratings-
    // only, so its best night renders as the earned tier, never a number.
    const bestLabel = (uid: string | null) => {
      const score = (uid && matchup.best?.[uid]?.score) || 0;
      if (score <= 0) return '—';
      return isSoundSport ? getSoundSportRating(score) : score.toFixed(1);
    };

    return (
      <button
        onClick={onClick}
        disabled={isBye}
        className={`w-full text-left transition-colors ${
          isBye
            ? 'opacity-50 cursor-default'
            : isRivalry
              ? 'bg-red-500/5 hover:bg-red-500/10'
              : featured
                ? 'bg-purple-500/5 hover:bg-purple-500/10'
                : 'hover:bg-surface-raised'
        }`}
      >
        <div className={`px-4 py-3 ${featured ? 'py-4' : ''}`}>
          {/* Class + Rivalry indicators */}
          <div className="flex items-center gap-2 mb-2">
            {isCrossClass ? (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase bg-teal-500/15 text-teal-400 border border-teal-500/40"
                title="Each corps is scored against its own class; the better class finish wins the week."
              >
                Cross-Class
              </span>
            ) : (
              showClass &&
              classConfig && (
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase ${classConfig.bgColor} ${classConfig.color} border ${classConfig.borderColor}`}
                >
                  {classConfig.name}
                </span>
              )
            )}
            {isRivalry && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-red-500">
                <Flame className="w-3 h-3" />
                Rivalry
              </span>
            )}
            {isBye && <span className="text-[10px] font-bold uppercase text-muted">BYE WEEK</span>}
          </div>

          <div className="flex items-center gap-3">
            {/* Home */}
            <div className="flex-1 flex items-center gap-2">
              <div
                className={`w-8 h-8 flex-shrink-0 flex items-center justify-center ${
                  home.isUser ? 'bg-purple-500/20 border border-purple-500/50' : 'bg-line'
                }`}
              >
                <span
                  className={`text-xs font-bold ${home.isUser ? 'text-purple-400' : 'text-muted'}`}
                >
                  {home.name.charAt(0)}
                </span>
              </div>
              <div className="min-w-0">
                <p
                  className={`text-sm font-bold truncate ${
                    homeWon ? 'text-green-400' : home.isUser ? 'text-purple-400' : 'text-white'
                  }`}
                >
                  {home.name}
                </p>
                {isCrossClass && sideClassName(p1_uid) ? (
                  <p className="text-[10px] text-muted truncate">{sideClassName(p1_uid)}</p>
                ) : (
                  home.standing && (
                    <p className="text-[10px] text-muted">
                      {home.standing.wins}-{home.standing.losses}
                    </p>
                  )
                )}
              </div>
            </div>

            {/* Score / VS */}
            <div className="flex-shrink-0 text-center min-w-[70px]">
              {isBye ? (
                <div className="px-2 py-1 bg-surface-raised text-muted text-xs">WIN</div>
              ) : matchup.completed && matchup.captions ? (
                /* Caption Wars: the tally is the result, the totals are the
                   supporting detail rather than the other way round. */
                <div>
                  <div className="text-sm font-bold font-data tabular-nums text-white">
                    {formatTally(matchup.captions, homeWon ? p1_uid : p2_uid)}
                  </div>
                  {!isSoundSport && (
                    <div className="text-[10px] text-muted font-data tabular-nums">
                      {home.score.toFixed(0)}-{away.score.toFixed(0)}
                    </div>
                  )}
                </div>
              ) : matchup.completed && matchup.best ? (
                /* One-Night Slate: the best single show is the result, the
                   weekly totals are the supporting detail. */
                <div>
                  <div
                    className={`flex items-center justify-center gap-1 font-bold ${
                      isSoundSport ? 'text-[10px] uppercase' : 'text-sm font-data tabular-nums'
                    }`}
                  >
                    <span
                      className={
                        homeWon ? 'text-green-400' : isTie ? 'text-secondary' : 'text-muted'
                      }
                    >
                      {bestLabel(p1_uid)}
                    </span>
                    <span className="text-muted">-</span>
                    <span
                      className={
                        awayWon ? 'text-green-400' : isTie ? 'text-secondary' : 'text-muted'
                      }
                    >
                      {bestLabel(p2_uid)}
                    </span>
                  </div>
                  <div className="text-[9px] text-muted uppercase">best show</div>
                </div>
              ) : isCrossClass && matchup.completed ? (
                /* Decided on each side's finish against its own class — the
                   percentile is the result, the raw totals are not comparable
                   across classes and are omitted here. */
                <div>
                  <div className="flex items-center justify-center gap-1 text-sm font-bold font-data tabular-nums">
                    <span
                      className={
                        homeWon ? 'text-green-400' : isTie ? 'text-secondary' : 'text-muted'
                      }
                    >
                      {typeof homePct === 'number' ? `${Math.round(homePct)}%` : '—'}
                    </span>
                    <span className="text-muted">-</span>
                    <span
                      className={
                        awayWon ? 'text-green-400' : isTie ? 'text-secondary' : 'text-muted'
                      }
                    >
                      {typeof awayPct === 'number' ? `${Math.round(awayPct)}%` : '—'}
                    </span>
                  </div>
                  <div className="text-[9px] text-muted uppercase">of own class</div>
                </div>
              ) : matchup.completed && hasAverages ? (
                /* Default format: the per-show average is the result, the
                   weekly totals are the supporting detail. */
                <div>
                  <div
                    className={`flex items-center justify-center gap-1 font-bold ${
                      isSoundSport ? 'text-[10px] uppercase' : 'text-sm font-data tabular-nums'
                    }`}
                  >
                    <span
                      className={
                        homeWon ? 'text-green-400' : isTie ? 'text-secondary' : 'text-muted'
                      }
                    >
                      {sideLabel(homeAvg as number)}
                    </span>
                    <span className="text-muted">-</span>
                    <span
                      className={
                        awayWon ? 'text-green-400' : isTie ? 'text-secondary' : 'text-muted'
                      }
                    >
                      {sideLabel(awayAvg as number)}
                    </span>
                  </div>
                  <div className="text-[9px] text-muted uppercase">avg per show</div>
                  {!isSoundSport && (
                    <div className="text-[10px] text-muted font-data tabular-nums">
                      {home.score.toFixed(0)}-{away.score.toFixed(0)} total
                    </div>
                  )}
                </div>
              ) : matchup.completed || matchup.status === 'live' ? (
                <div className="flex items-center justify-center gap-1">
                  <span
                    className={`font-bold ${
                      isSoundSport ? 'text-[10px] uppercase' : 'text-sm font-data tabular-nums'
                    } ${homeWon ? 'text-green-400' : isTie ? 'text-secondary' : 'text-muted'}`}
                  >
                    {isSoundSport
                      ? home.score > 0
                        ? getSoundSportRating(home.score)
                        : '—'
                      : home.score.toFixed(0)}
                  </span>
                  <span className="text-muted">-</span>
                  <span
                    className={`font-bold ${
                      isSoundSport ? 'text-[10px] uppercase' : 'text-sm font-data tabular-nums'
                    } ${awayWon ? 'text-green-400' : isTie ? 'text-secondary' : 'text-muted'}`}
                  >
                    {isSoundSport
                      ? away.score > 0
                        ? getSoundSportRating(away.score)
                        : '—'
                      : away.score.toFixed(0)}
                  </span>
                </div>
              ) : (
                <div className="px-2 py-1 bg-surface-raised">
                  <Swords className="w-3.5 h-3.5 text-muted mx-auto" />
                </div>
              )}
              {matchup.status === 'live' && !featured && (
                <span className="text-[9px] text-red-500 font-bold">LIVE</span>
              )}
            </div>

            {/* Away */}
            {!isBye && (
              <div className="flex-1 flex items-center gap-2 justify-end">
                <div className="min-w-0 text-right">
                  <p
                    className={`text-sm font-bold truncate ${
                      awayWon ? 'text-green-400' : away.isUser ? 'text-purple-400' : 'text-white'
                    }`}
                  >
                    {away.name}
                  </p>
                  {isCrossClass && sideClassName(p2_uid) ? (
                    <p className="text-[10px] text-muted truncate">{sideClassName(p2_uid)}</p>
                  ) : (
                    away.standing && (
                      <p className="text-[10px] text-muted">
                        {away.standing.wins}-{away.standing.losses}
                      </p>
                    )
                  )}
                </div>
                <div
                  className={`w-8 h-8 flex-shrink-0 flex items-center justify-center ${
                    away.isUser ? 'bg-purple-500/20 border border-purple-500/50' : 'bg-line'
                  }`}
                >
                  <span
                    className={`text-xs font-bold ${away.isUser ? 'text-purple-400' : 'text-muted'}`}
                  >
                    {away.name.charAt(0)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {!isBye && matchup.completed && matchup.captions && (
            <CaptionStrip captions={matchup.captions} p1Uid={p1_uid} p2Uid={p2_uid} />
          )}
        </div>
      </button>
    );
  }
);

export default VersusStrip;
