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

import React, { useMemo, memo, useState } from 'react';
import { Trophy, MapPin, Calendar, Scissors } from 'lucide-react';
import { formatEventName } from '../utils/season';
import {
  CLASS_LABELS,
  getCaptionBreakdown,
  mergeTwoNightShows,
  formatStandingsAsText,
  computeRankDeltas,
  computeAdvancement,
  advancementKey,
  TWO_NIGHT_DAYS,
} from '../utils/scoresUtils';
import { useHorizontalTabSlide } from '../components/scores/useHorizontalTabSlide';
import { PillTabControl } from '../components/scores/PillTabControl';
import { SoundSportMedalList } from '../components/scores/SoundSportMedalList';
import { useDayRecapShows } from '../hooks/useScoresData';
import { scoresShareUrl } from '../utils/shareSheet';
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
// PILL TAB CONTROL (Design System) — moved to components/scores/PillTabControl
// (imported above, re-exported below so Scores.jsx's import surface is
// unchanged).
// =============================================================================

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

// =============================================================================
// CHAMPIONSHIP-WEEK CUT MARKERS — days 45/47/48 end with a cut, and the recap
// sheet is where players learn whether they survived it. The advancing set is
// computed from the night's whole field (utils/scoresUtils.computeAdvancement,
// which mirrors the scorer's buildChampionshipConfig) and threaded down here.
// =============================================================================

// Chip beside the corps name on a row that marches tomorrow.
const AdvancesTag = ({ advancesToDay }) => (
  <span
    title={`Advances to Day ${advancesToDay}`}
    className="flex-shrink-0 text-[8px] font-bold uppercase tracking-wider px-1 py-[1px] bg-green-500/15 text-green-400"
  >
    Adv
  </span>
);

// Banner under the masthead stating the night's cut rule and its outcome.
const CutBanner = ({ advancement }) => (
  <div className="flex items-center gap-2 px-2 py-1.5 bg-green-500/5 border-l-2 border-green-500/60">
    <Scissors className="w-3 h-3 text-green-400 flex-shrink-0" aria-hidden="true" />
    <div className="min-w-0 text-[10px] leading-tight">
      <span className="font-bold uppercase tracking-wider text-green-400">{advancement.rule}</span>
      <span className="text-muted">
        {' · '}
        {advancement.advancingCount} advance to Day {advancement.advancesToDay}
        {advancement.missedCount > 0 && advancement.cutLine != null && (
          <>
            {' · '}
            {advancement.missedCount} miss the cut at{' '}
            <span className="tabular-nums">{advancement.cutLine.toFixed(3)}</span>
          </>
        )}
      </span>
    </div>
  </div>
);

const RecapDataGrid = memo(
  ({
    scores,
    eventName,
    location,
    date,
    seasonId,
    offSeasonDay,
    userCorpsName,
    sortBy = 'total',
    advancement = null,
  }) => {
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
        const advancingCount = advancement
          ? rows.filter(({ score }) => advancement.advancing.has(advancementKey(score))).length
          : 0;
        return {
          cls,
          label: CLASS_LABELS[cls] || cls,
          rows,
          tops: captionTops(rows.map((r) => r.captions)),
          advancingCount,
        };
      });
    }, [scores, sortBy, advancement]);

    const activeCap = sortBy === 'total' ? null : sortBy;

    // One share block per class, mirroring the on-screen split.
    const shareText = () =>
      sections
        .map((section) =>
          formatStandingsAsText(
            {
              title: `${formatEventName(eventName)} — ${section.label}`,
              subtitle:
                [location, date, advancement && `${advancement.rule} (marked ">")`]
                  .filter(Boolean)
                  .join(' · ') || null,
            },
            section.rows.map(({ score, captions, place }) => ({
              place,
              // The pasted sheet has to carry the cut too — it is the whole
              // story of the night, and a plain list of scores hides it.
              corpsName: `${advancement?.advancing.has(advancementKey(score)) ? '> ' : ''}${
                score.corpsName || score.corps
              }`,
              total: score.score ?? score.totalScore ?? 0,
              captions,
            }))
          )
        )
        .join('\n\n');

    if (sections.length === 0) return null;

    // Link the share to the day's card for the sheet's top class present
    // (World → Open → A order). The /share URL unfurls with a live standings
    // image wherever the copied text is pasted.
    const topRankedClass = sections.find((s) => RECAP_CLASS_ORDER.includes(s.cls))?.cls;
    const shareUrl = () =>
      seasonId && typeof offSeasonDay === 'number' && topRankedClass
        ? scoresShareUrl(seasonId, offSeasonDay, topRankedClass)
        : null;

    return (
      <div className={`${SHEET_CARD} space-y-3`}>
        <SheetMasthead title={formatEventName(eventName)} location={location} date={date} />

        {/* Championship-week cut — what tonight's scores decided */}
        {advancement && <CutBanner advancement={advancement} />}

        {sections.map((section) => (
          <div key={section.cls} className="space-y-1.5">
            {/* Per-class subheader — same shape as the Eastern combined sheet */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted">
                {section.label}
              </span>
              <span className="text-[9px] text-muted tabular-nums">
                {advancement && (
                  <span className="text-green-400 font-bold">
                    {section.advancingCount} advance ·{' '}
                  </span>
                )}
                {section.rows.length} corps
              </span>
            </div>
            <BoxScoreHead active={activeCap} />
            <div>
              {section.rows.map(({ score, captions, place }, rowIndex) => {
                const isUserCorps =
                  userCorpsName &&
                  (score.corps?.toLowerCase() === userCorpsName.toLowerCase() ||
                    score.corpsName?.toLowerCase() === userCorpsName.toLowerCase());
                const advances = advancement
                  ? advancement.advancing.has(advancementKey(score))
                  : false;
                // The cut line is only meaningful while the sheet is in score
                // order; under a caption sort the rows no longer run from
                // survivor to eliminated, so only the per-row tags remain.
                const nextRow = section.rows[rowIndex + 1];
                const isCutLine = Boolean(
                  advancement &&
                  sortBy === 'total' &&
                  advances &&
                  nextRow &&
                  !advancement.advancing.has(advancementKey(nextRow.score))
                );

                return (
                  <div
                    key={score.uid || score.corpsName || place}
                    className={`flex items-center gap-2 px-1 py-1.5 border-b last:border-b-0 ${
                      isCutLine ? 'border-green-500/60' : 'border-line-subtle'
                    } ${isUserCorps ? 'bg-interactive/10' : ''} ${
                      advancement && !advances ? 'opacity-60' : ''
                    }`}
                  >
                    <CorpsIdentity
                      place={place}
                      name={score.corpsName || score.corps}
                      isMine={isUserCorps}
                      displayName={score.displayName}
                      uid={score.uid}
                      avatarUrl={score.avatarUrl}
                      tag={
                        advances ? <AdvancesTag advancesToDay={advancement.advancesToDay} /> : null
                      }
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
          note={
            advancement
              ? `ADV = marches Day ${advancement.advancesToDay} · ${advancement.rule}`
              : 'Split by class · GE/VIS/MUS shown · box-toppers in gold'
          }
          action={<ShareButton getText={shareText} getUrl={shareUrl} />}
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

/**
 * Two data modes:
 *  - Eager (`shows`): the caller already holds the season's shows (archive
 *    view, or seasons without materialized standings).
 *  - Lazy (`seasonId` + `availableDays`, no `shows`): the day list comes from
 *    the materialized standings and only the selected day's recap doc is
 *    fetched (one read, cached per day) — the Scores page's default path.
 */
const FantasyRecapsView = ({
  shows = null,
  seasonId = null,
  availableDays = null,
  userCorpsName,
}) => {
  const [sortBy, setSortBy] = useState('total');
  const [selectedDay, setSelectedDay] = useState(null);
  const lazy = !shows && !!seasonId;

  // Distinct competition days, oldest → newest (the tab order). Eager mode
  // derives them from the shows themselves; lazy mode is handed the list.
  const days = useMemo(() => {
    if (lazy) {
      return [...(availableDays || [])].sort((a, b) => a - b);
    }
    const set = new Set();
    (shows || []).forEach((s) => {
      if (typeof s.offSeasonDay === 'number') set.add(s.offSeasonDay);
    });
    return [...set].sort((a, b) => a - b);
  }, [lazy, availableDays, shows]);

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

  // Lazy fetches. The Eastern Classic combined sheet needs both nights, so on
  // days 41-42 the sibling night is fetched too. Hooks run unconditionally
  // (enabled flags gate the reads).
  const isEasternDay = TWO_NIGHT_DAYS.includes(activeDay);
  const { shows: lazyDayShows, loading: lazyLoading } = useDayRecapShows(seasonId, activeDay, lazy);
  const { shows: easternN1 } = useDayRecapShows(seasonId, TWO_NIGHT_DAYS[0], lazy && isEasternDay);
  const { shows: easternN2 } = useDayRecapShows(seasonId, TWO_NIGHT_DAYS[1], lazy && isEasternDay);

  // The recap sheets exclude SoundSport (ratings are never shown as scores).
  const stripSoundSport = (list) =>
    (list || [])
      .map((show) => ({
        ...show,
        scores: (show.scores || []).filter((s) => s.corpsClass !== 'soundSport'),
      }))
      .filter((show) => show.scores.length > 0);

  const dayShows = useMemo(
    () =>
      lazy
        ? stripSoundSport(lazyDayShows)
        : (shows || []).filter((s) => s.offSeasonDay === activeDay),
    [lazy, lazyDayShows, shows, activeDay]
  );

  // Shows backing the Eastern combined sheet (it filters to days 41-42 itself).
  const easternShows = useMemo(
    () => (lazy ? stripSoundSport([...easternN1, ...easternN2]) : shows || []),
    [lazy, easternN1, easternN2, shows]
  );

  // Championship-week cut for this night, if it is one of the three that end in
  // one. Derived from the day's ENTIRE field (every show, flattened) because
  // that is the field the scorer ranks when it builds tomorrow's lineup — a
  // per-show cut would be a different, wrong answer if a night ever carried
  // more than one event. Null on all 46 other nights, so nothing changes there.
  const advancement = useMemo(
    () =>
      computeAdvancement(
        dayShows.flatMap((show) => show.scores || []),
        activeDay
      ),
    [dayShows, activeDay]
  );

  if (days.length === 0) {
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
      {isEasternDay && <EasternCombinedSheet shows={easternShows} userCorpsName={userCorpsName} />}

      {lazy && lazyLoading ? (
        <div className="p-8 text-center">
          <Calendar className="w-8 h-8 text-muted mx-auto mb-2 animate-pulse" />
          <p className="text-muted text-sm">Loading day {activeDay}…</p>
        </div>
      ) : dayShows.length > 0 ? (
        dayShows.map((show, idx) => (
          <RecapDataGrid
            key={show.eventName || idx}
            scores={show.scores}
            eventName={show.eventName}
            location={show.location}
            date={show.date}
            seasonId={show.seasonId}
            offSeasonDay={show.offSeasonDay}
            userCorpsName={userCorpsName}
            sortBy={sortBy}
            advancement={advancement}
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
