// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// Presentational sections for the Scores page: pill tabs, recap box scores,
// SoundSport medal list, and class standings. Styled to match the Podium Class
// recap sheet (PodiumRecapSheet) — sheet cards, gold box-toppers, per-show
// mastheads, Podium-style sort pills, and a wordmark footer — so every scoring
// surface reads as one system.
//
// Rows use fit-to-width flex columns (not a horizontally-scrolling table): the
// fantasy classes only surface GE/VIS/MUS + Total, which fits a phone without
// horizontal scroll. Per the anti-lineup-harvesting rule (§5.4) the fantasy
// sheets stay condensed to GE/VIS/MUS; full per-caption columns are Podium-only.

import React, { useMemo, memo, useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Music, ChevronRight, MapPin, Medal, Users, Calendar } from 'lucide-react';
import { TeamAvatar } from '../components/ui/TeamAvatar';
import { formatEventName } from '../utils/season';
import {
  RATING_CONFIG,
  CLASS_LABELS,
  getSoundSportRating,
  seededShuffle,
  getCaptionBreakdown,
  mergeTwoNightShows,
  formatStandingsAsText,
  computeRankDeltas,
  TWO_NIGHT_DAYS,
} from '../utils/scoresUtils';
import { useHorizontalTabSlide } from '../components/scores/useHorizontalTabSlide';
// Shared box-score primitives — the single source of truth for the sheet look,
// used by both these Fantasy sheets and the Podium Class sheets.
import {
  BlueRibbonIcon,
  SheetMasthead,
  BoxScoreHead,
  CorpsIdentity,
  CaptionValue,
  SheetFooter,
  SortPills,
  ShareButton,
  TrendIndicator,
} from '../components/scores/SheetPrimitives';
import {
  SHEET_CARD,
  TOTAL_W,
  TREND_W,
  STANDINGS_SORTS,
  captionTops,
} from '../components/scores/sheetTokens';

// =============================================================================
// PILL TAB CONTROL (Design System) — unchanged shell chrome
// =============================================================================

const PillTabControl = ({ tabs, activeTab, onTabChange, haptic }) => {
  const scrollRef = useRef(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Right-edge fade hint when tabs overflow off-screen (matches DataTable's
  // scroll-hint pattern) — without it, off-screen tabs are undiscoverable.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const checkScroll = () => {
      const hasMore = el.scrollWidth > el.clientWidth;
      const notAtEnd = el.scrollLeft < el.scrollWidth - el.clientWidth - 1;
      setCanScrollRight(hasMore && notAtEnd);
    };
    checkScroll();
    window.addEventListener('resize', checkScroll);
    el.addEventListener('scroll', checkScroll);
    return () => {
      window.removeEventListener('resize', checkScroll);
      el.removeEventListener('scroll', checkScroll);
    };
  }, [tabs]);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex items-center overflow-x-auto scrollbar-hide bg-transparent border-b border-line"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              haptic?.('medium');
              onTabChange(tab.id);
            }}
            className={`px-3 sm:px-4 py-2.5 min-h-touch text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap flex-shrink-0 border-b-2 -mb-px ${
              activeTab === tab.id
                ? tab.accent === 'green'
                  ? 'text-green-400 border-green-500'
                  : tab.accent === 'yellow'
                    ? 'text-interactive border-interactive'
                    : 'text-white border-interactive'
                : 'text-muted hover:text-secondary border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {canScrollRight && (
        <div
          className="absolute top-0 right-0 bottom-0 w-6 pointer-events-none bg-gradient-to-l from-[#0a0a0a] to-transparent"
          aria-hidden="true"
        />
      )}
    </div>
  );
};

// =============================================================================
// RECAP BOX SCORE - one card per show, SPLIT BY CLASS (memoized: sibling recaps
// don't re-render). Each show's field is separated into World / Open / A Class
// sections, each independently ranked and box-topped — the fantasy recaps read
// like the per-class standings instead of one mixed list.
// =============================================================================

// Class display order within a show (SoundSport is filtered upstream).
const RECAP_CLASS_ORDER = ['worldClass', 'openClass', 'aClass'];

// Rank a class's scores (already total-desc, so index+1 is the finishing place)
// and apply the active caption sort — the place stays fixed under a sort, the
// same as the Podium recap sheet.
const buildClassRows = (classScores, sortBy) => {
  const withPlace = classScores.map((score, i) => ({
    score,
    captions: getCaptionBreakdown(score),
    place: i + 1,
  }));
  if (sortBy === 'total') return withPlace;
  const key = { GE: 'ge', VIS: 'vis', MUS: 'mus' }[sortBy];
  if (!key) return withPlace;
  return [...withPlace].sort((a, b) => (b.captions[key] ?? -1) - (a.captions[key] ?? -1));
};

const RecapDataGrid = memo(
  ({ scores, eventName, location, date, userCorpsName, sortBy = 'total' }) => {
    // Group the show's corps by class, then rank/sort within each class.
    const sections = useMemo(() => {
      if (!scores || scores.length === 0) return [];
      const byClass = new Map();
      for (const score of scores) {
        const cls = score.corpsClass || 'aClass';
        if (!byClass.has(cls)) byClass.set(cls, []);
        byClass.get(cls).push(score);
      }
      // Known classes first (World → Open → A), then any stragglers, so an
      // unexpected class is still shown rather than dropped.
      const order = [
        ...RECAP_CLASS_ORDER.filter((cls) => byClass.has(cls)),
        ...[...byClass.keys()].filter((cls) => !RECAP_CLASS_ORDER.includes(cls)),
      ];
      return order.map((cls) => {
        const rows = buildClassRows(byClass.get(cls), sortBy);
        return {
          cls,
          label: CLASS_LABELS[cls] || cls,
          rows,
          tops: captionTops(rows.map((r) => r.captions)),
        };
      });
    }, [scores, sortBy]);

    const activeCap = sortBy === 'total' ? null : sortBy;

    // One share block per class, mirroring the on-screen split.
    const shareText = () =>
      sections
        .map((section) =>
          formatStandingsAsText(
            {
              title: `${formatEventName(eventName)} — ${section.label}`,
              subtitle: [location, date].filter(Boolean).join(' · ') || null,
            },
            section.rows.map(({ score, captions, place }) => ({
              place,
              corpsName: score.corpsName || score.corps,
              total: score.score ?? score.totalScore ?? 0,
              captions,
            }))
          )
        )
        .join('\n\n');

    if (sections.length === 0) return null;

    return (
      <div className={`${SHEET_CARD} space-y-3`}>
        <SheetMasthead title={formatEventName(eventName)} location={location} date={date} />

        {sections.map((section) => (
          <div key={section.cls} className="space-y-1.5">
            {/* Per-class subheader — same shape as the Eastern combined sheet */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted">
                {section.label}
              </span>
              <span className="text-[9px] text-muted tabular-nums">
                {section.rows.length} corps
              </span>
            </div>
            <BoxScoreHead active={activeCap} />
            <div>
              {section.rows.map(({ score, captions, place }) => {
                const isUserCorps =
                  userCorpsName &&
                  (score.corps?.toLowerCase() === userCorpsName.toLowerCase() ||
                    score.corpsName?.toLowerCase() === userCorpsName.toLowerCase());

                return (
                  <div
                    key={score.uid || score.corpsName || place}
                    className={`flex items-center gap-2 px-1 py-1.5 border-b border-line-subtle last:border-b-0 ${
                      isUserCorps ? 'bg-interactive/10' : ''
                    }`}
                  >
                    <CorpsIdentity
                      place={place}
                      name={score.corpsName || score.corps}
                      isMine={isUserCorps}
                      displayName={score.displayName}
                      uid={score.uid}
                      avatarUrl={score.avatarUrl}
                    />
                    <div className="flex items-center gap-1.5 flex-shrink-0 text-[11px]">
                      <CaptionValue
                        value={captions?.ge}
                        isTop={captions?.ge === section.tops.ge}
                        active={activeCap === 'GE'}
                      />
                      <CaptionValue
                        value={captions?.vis}
                        isTop={captions?.vis === section.tops.vis}
                        active={activeCap === 'VIS'}
                      />
                      <CaptionValue
                        value={captions?.mus}
                        isTop={captions?.mus === section.tops.mus}
                        active={activeCap === 'MUS'}
                      />
                      <span className={`${TOTAL_W} text-right font-bold text-white tabular-nums`}>
                        {(score.score || score.totalScore || 0).toFixed(3)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <SheetFooter
          note="Split by class · GE/VIS/MUS shown · box-toppers in gold"
          action={<ShareButton getText={shareText} />}
        />
      </div>
    );
  }
);

// =============================================================================
// TWO-NIGHT COMBINED STANDINGS — the Eastern Classic (days 41-42, §5.11).
// One event, two nightly drops: once Saturday processes, this sheet merges
// both nights into per-class combined standings with Night 1/2 badges. The
// small uniform night-two growth bump is published, not hidden — that's the
// real DCI recap-thread experience.
// =============================================================================

const NIGHT_BADGE = {
  1: 'bg-interactive/15 text-interactive',
  2: 'bg-purple-500/15 text-purple-300',
};

const EasternCombinedSheet = memo(({ shows, userCorpsName }) => {
  const combined = useMemo(() => mergeTwoNightShows(shows || []), [shows]);
  if (!combined) return null;

  const shareText = () =>
    combined.sections
      .map((section) =>
        formatStandingsAsText(
          {
            title: `${formatEventName(combined.eventName)} — ${section.label}`,
            subtitle: 'Combined Standings · Both Nights',
          },
          section.rows.map((row, idx) => ({
            place: idx + 1,
            corpsName: `${row.corpsName || row.corps} (N${row.night})`,
            total: row.score ?? row.totalScore ?? 0,
            captions: getCaptionBreakdown(row),
          }))
        )
      )
      .join('\n\n');

  return (
    <div className={`${SHEET_CARD} space-y-3`}>
      {/* Masthead — gold-tinted to flag the marquee event */}
      <div className="flex items-baseline justify-between gap-2 border-b border-brand/40 pb-2">
        <div className="min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand">
            Combined Standings · Both Nights
          </div>
          <div className="font-bold text-white text-[13px] truncate">
            {formatEventName(combined.eventName)}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 pl-2 text-[10px] uppercase tracking-wider text-muted">
          {combined.location && (
            <span className="hidden sm:flex items-center gap-1 truncate max-w-[140px]">
              <MapPin className="w-3 h-3" />
              {combined.location}
            </span>
          )}
          {combined.dateRange && (
            <span className="tabular-nums normal-case">{combined.dateRange}</span>
          )}
        </div>
      </div>

      {/* Per-class sections */}
      {combined.sections.map((section) => {
        const sectionTops = captionTops(section.rows.map((row) => getCaptionBreakdown(row)));
        return (
          <div key={section.corpsClass} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted">
                {section.label}
              </span>
              <span className="text-[9px] text-muted tabular-nums">
                {section.rows.length} corps
              </span>
            </div>
            <BoxScoreHead trailing={<span className="w-7 text-right text-muted">Night</span>} />
            <div>
              {section.rows.map((row, idx) => {
                const isUserCorps =
                  userCorpsName && row.corpsName?.toLowerCase() === userCorpsName.toLowerCase();
                const captions = getCaptionBreakdown(row);
                return (
                  <div
                    key={`${row.corpsName}-${idx}`}
                    className={`flex items-center gap-2 px-1 py-1.5 border-b border-line-subtle last:border-b-0 ${
                      isUserCorps ? 'bg-interactive/10' : ''
                    }`}
                  >
                    <CorpsIdentity
                      place={idx + 1}
                      name={row.corpsName || row.corps}
                      isMine={isUserCorps}
                      displayName={row.displayName}
                      uid={row.uid}
                      avatarUrl={row.avatarUrl}
                    />
                    <div className="flex items-center gap-1.5 flex-shrink-0 text-[11px]">
                      <CaptionValue value={captions?.ge} isTop={captions?.ge === sectionTops.ge} />
                      <CaptionValue
                        value={captions?.vis}
                        isTop={captions?.vis === sectionTops.vis}
                      />
                      <CaptionValue
                        value={captions?.mus}
                        isTop={captions?.mus === sectionTops.mus}
                      />
                      <span className={`${TOTAL_W} text-right font-bold text-white tabular-nums`}>
                        {(row.score || row.totalScore || 0).toFixed(3)}
                      </span>
                      <span
                        className={`w-7 flex-shrink-0 text-center text-[9px] font-bold uppercase rounded-none py-0.5 ${NIGHT_BADGE[row.night]}`}
                      >
                        N{row.night}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <SheetFooter
        note="Night 2 carries one extra day of growth · box-toppers in gold"
        action={<ShareButton getText={shareText} />}
      />
    </div>
  );
});

// =============================================================================
// FANTASY RECAPS VIEW — day tabs + one sort control, mirroring the Podium Class
// recap sheet. Shows are grouped by competition day; a day selector (auto-
// sliding to the latest, like Podium) picks the day, and a single sort bar
// (Score/GE/VIS/MUS) reorders every box score on that day at once.
// =============================================================================

const FantasyRecapsView = ({ shows, userCorpsName }) => {
  const [sortBy, setSortBy] = useState('total');
  const [selectedDay, setSelectedDay] = useState(null);

  // Distinct competition days present in the data, oldest → newest (the tab
  // order). Shows carry `offSeasonDay`; guard against any that don't.
  const days = useMemo(() => {
    const set = new Set();
    (shows || []).forEach((s) => {
      if (typeof s.offSeasonDay === 'number') set.add(s.offSeasonDay);
    });
    return [...set].sort((a, b) => a - b);
  }, [shows]);

  // Default to the latest day; fall back if the selected day drops out of the
  // data (e.g. switching seasons). Derived (not stored) so there's no empty
  // first frame — mirrors PodiumRecapSheet's `selected` handling.
  const activeDay =
    selectedDay != null && days.includes(selectedDay)
      ? selectedDay
      : (days[days.length - 1] ?? null);

  const { containerRef: dayStripRef, selectedRef: selectedDayRef } = useHorizontalTabSlide(
    `${activeDay}:${days.length}`
  );

  const dayShows = useMemo(
    () => (shows || []).filter((s) => s.offSeasonDay === activeDay),
    [shows, activeDay]
  );

  if (!shows || days.length === 0) {
    return (
      <div className="p-8 text-center">
        <Calendar className="w-8 h-8 text-muted mx-auto mb-2" />
        <p className="text-muted text-sm">No recent shows</p>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 space-y-3">
      {/* Day selector — auto-slides so the highlighted day stays visible */}
      {days.length > 1 && (
        <div ref={dayStripRef} className="flex gap-1 overflow-x-auto scrollbar-hide">
          {days.map((day) => (
            <button
              key={day}
              ref={day === activeDay ? selectedDayRef : null}
              onClick={() => setSelectedDay(day)}
              className={`flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-none tabular-nums transition-colors press-feedback ${
                day === activeDay
                  ? 'bg-interactive text-white'
                  : 'text-muted hover:text-white hover:bg-white/5 border border-line'
              }`}
            >
              D{day}
            </button>
          ))}
        </div>
      )}

      {/* One sort control for the day's box scores (parity with the Podium sheet) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          <span className="text-[9px] uppercase tracking-wider text-muted pr-1 flex-shrink-0">
            Sort
          </span>
          <SortPills options={STANDINGS_SORTS} value={sortBy} onChange={setSortBy} />
        </div>
        <div className="text-[9px] uppercase tracking-wider text-secondary font-bold flex-shrink-0">
          Recaps
        </div>
      </div>

      {/* Eastern Classic combined standings — only on the two-night days */}
      {TWO_NIGHT_DAYS.includes(activeDay) && (
        <EasternCombinedSheet shows={shows} userCorpsName={userCorpsName} />
      )}

      {dayShows.length > 0 ? (
        dayShows.map((show, idx) => (
          <RecapDataGrid
            key={show.eventName || idx}
            scores={show.scores}
            eventName={show.eventName}
            location={show.location}
            date={show.date}
            userCorpsName={userCorpsName}
            sortBy={sortBy}
          />
        ))
      ) : (
        <div className="p-8 text-center">
          <Calendar className="w-8 h-8 text-muted mx-auto mb-2" />
          <p className="text-muted text-sm">No shows on this day</p>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// SOUNDSPORT MEDAL LIST - GROUPED BY EVENT (rating-based, no numeric scores)
// Keeps its green medal identity but adopts the Podium sheet card + masthead.
// =============================================================================

// Mock event names for shows that may not have proper names
const MOCK_EVENT_NAMES = [
  'SoundSport International Music & Food Festival',
  'DCI Indianapolis SoundSport',
  'Atlanta SoundSport Showcase',
  'Midwest SoundSport Classic',
  'SoundSport Championship Series',
  'Summer Music Games SoundSport',
];

const SoundSportMedalList = ({ shows }) => {
  // Group results by event, preserving show context
  const groupedResults = useMemo(() => {
    const groups = [];
    let mockNameIndex = 0;

    shows
      .filter((show) => show.scores?.some((s) => s.corpsClass === 'soundSport'))
      .forEach((show) => {
        const soundSportScores = show.scores
          .filter((s) => s.corpsClass === 'soundSport')
          .map((score) => ({
            ...score,
            rating: getSoundSportRating(score.score),
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
        to="/guide"
        className="flex items-center gap-2 text-[10px] text-green-400 hover:text-green-300 font-bold uppercase tracking-wider transition-colors px-1 pt-1"
      >
        About SoundSport scoring
        <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  );
};

// =============================================================================
// STANDINGS SHEET FOR CLASS TABS
// =============================================================================

const ClassStandingsGrid = ({ standings, className, userCorpsName }) => {
  const [sortBy, setSortBy] = useState('total');

  // Pre-compute breakdowns per entry (real data only, no synthetic values),
  // then order by the selected caption — corps without caption data sort last.
  const sorted = useMemo(() => {
    if (!standings || standings.length === 0) return [];
    const withCaptions = standings.map((entry) => ({
      entry,
      captions: getCaptionBreakdown(entry.scores?.[0] || entry),
    }));
    if (sortBy === 'total') return withCaptions;
    const key = { GE: 'ge', VIS: 'vis', MUS: 'mus' }[sortBy];
    return [...withCaptions].sort((a, b) => (b.captions[key] ?? -1) - (a.captions[key] ?? -1));
  }, [standings, sortBy]);

  const tops = useMemo(() => captionTops(sorted.map((s) => s.captions)), [sorted]);
  // Placements moved since each corps's previous show — drives the trend
  // triangle. Computed from the overall standings so it's stable regardless of
  // the active caption sort.
  const rankDeltas = useMemo(() => computeRankDeltas(standings), [standings]);

  if (!standings || standings.length === 0) {
    return (
      <div className="p-8 text-center">
        <Trophy className="w-8 h-8 text-muted mx-auto mb-2" />
        <p className="text-muted text-sm">No {className} standings yet</p>
      </div>
    );
  }

  const activeCap = sortBy === 'total' ? null : sortBy;

  const shareText = () =>
    formatStandingsAsText(
      {
        title:
          sortBy === 'total'
            ? `${className} · Season Standings`
            : `${className} · ${sortBy} Leaders`,
      },
      sorted.map(({ entry, captions }, idx) => ({
        place: sortBy === 'total' ? entry.rank : idx + 1,
        corpsName: entry.corpsName,
        total: typeof entry.score === 'number' ? entry.score : null,
        captions,
      }))
    );

  return (
    <div className={`${SHEET_CARD} space-y-2.5`}>
      {/* Section header + Podium-style sort pills */}
      <div className="flex items-center justify-between gap-2 border-b border-line-muted pb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-white truncate">
          {sortBy === 'total'
            ? `${className} · Season Standings`
            : `${className} · ${sortBy} Leaders`}
        </span>
        <SortPills options={STANDINGS_SORTS} value={sortBy} onChange={setSortBy} />
      </div>

      <BoxScoreHead
        active={activeCap}
        totalLabel="Score"
        trailing={<span className={TREND_W} aria-hidden="true" />}
      />

      <div>
        {sorted.map(({ entry, captions }, idx) => {
          const isUserCorps =
            userCorpsName && entry.corpsName?.toLowerCase() === userCorpsName.toLowerCase();
          const rankDelta = rankDeltas.get(entry.uid || entry.corpsName || '');

          return (
            <div
              key={entry.corpsName || idx}
              className={`flex items-center gap-2 px-1 py-1.5 border-b border-line-subtle last:border-b-0 ${
                isUserCorps ? 'bg-interactive/10' : ''
              }`}
            >
              {/* Rank — position under the active sort (caption rank when caption-sorted) */}
              <CorpsIdentity
                place={sortBy === 'total' ? entry.rank : idx + 1}
                name={entry.corpsName}
                isMine={isUserCorps}
                displayName={entry.displayName}
                uid={entry.uid}
                avatarUrl={entry.avatarUrl}
              />
              <div className="flex items-center gap-1.5 flex-shrink-0 text-[11px]">
                <CaptionValue
                  value={captions?.ge}
                  isTop={captions?.ge === tops.ge}
                  active={activeCap === 'GE'}
                />
                <CaptionValue
                  value={captions?.vis}
                  isTop={captions?.vis === tops.vis}
                  active={activeCap === 'VIS'}
                />
                <CaptionValue
                  value={captions?.mus}
                  isTop={captions?.mus === tops.mus}
                  active={activeCap === 'MUS'}
                />
                <span className={`${TOTAL_W} text-right font-bold text-white tabular-nums`}>
                  {typeof entry.score === 'number' ? entry.score.toFixed(3) : '-'}
                </span>
                <span className={`${TREND_W} flex items-center justify-center flex-shrink-0`}>
                  <TrendIndicator delta={rankDelta} />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <SheetFooter
        note="GE/VIS/MUS shown · full captions are Podium Class only"
        action={<ShareButton getText={shareText} />}
      />
    </div>
  );
};

export {
  BlueRibbonIcon,
  PillTabControl,
  RecapDataGrid,
  EasternCombinedSheet,
  FantasyRecapsView,
  SoundSportMedalList,
  ClassStandingsGrid,
};
