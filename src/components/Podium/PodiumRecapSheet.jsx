// PodiumRecapSheet — the DCI-style box score for Podium Class shows
// (Phase 2, design §5.4): full caption columns, bolded box-toppers, event
// masthead, wordmark footer. Reads the public podium-recaps collection.
//
// Podium is scored PER SHOW (a recap day carries `shows: [{eventName, location,
// results}]`), so each day renders one box score per show. Each show's field is
// SPLIT BY DIVISION — World / Open / A, each ranked and box-topped on its own,
// the same way the fantasy recaps split a show by class (pages/ScoresParts →
// RecapDataGrid). Every division crowns its own winner (§5.7), so a division's
// block is the sheet that matters to the corps in it. Rows can be sorted by any
// caption; the split and the placements hold under the sort.
//
// The one exception is the World Championship (days 47-49, utils/
// worldChampionship): Prelims, Semifinals and Finals are ONE field, every
// division ranked together 1 to N under one heading — World Prelims
// Performers, World Semifinalists, World Finalists — and the top of the Finals
// sheet is the World Champion. The processor ranks those nights the same way.
//
// Full captions are shown because Podium is a virtual engine — nothing to
// harvest, unlike the drafted fantasy classes (which stay GE/Vis/Mus-only).

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { Loader2, Medal } from 'lucide-react';
import { db } from '../../api';
import { formatEventName } from '../../utils/season';
import { isViewerCorps } from '../../utils/corps';
import { MEDAL_TEXT_CLASS, podiumMedalForPlace } from '../../utils/podiumMedals';
import { TeamAvatar } from '../ui/TeamAvatar';
import { AdvancesTag, CutBanner, ShareButton, TitleTag } from '../scores/SheetPrimitives';
import { SHEET_CARD, sectionsForNight } from '../scores/sheetTokens';
import { useHorizontalTabSlide } from '../scores/useHorizontalTabSlide';
import { PODIUM_CAPTIONS } from './podiumConstants';

/**
 * One corps' row as the Podium processor writes it (helpers/podium/processor →
 * showRanking.rankShowResults), plus the director credit and avatar it attaches.
 * @typedef {Object} PodiumRecapRow
 * @property {string} uid
 * @property {string} [corpsName]
 * @property {string} [division]
 * @property {number} [place]
 * @property {number} [totalScore]
 * @property {number} [geScore]
 * @property {number} [visualScore]
 * @property {number} [musicScore]
 * @property {Record<string, number>} [captions]
 * @property {string|null} [displayName]
 * @property {string|null} [avatarUrl]
 */

/**
 * One show on a recap day.
 * @typedef {Object} PodiumRecapShow
 * @property {string|null} [eventName]
 * @property {string|null} [location]
 * @property {PodiumRecapRow[]} [results]
 */

/**
 * The cut tonight's results decided, as store.championshipCutFor publishes it.
 * @typedef {Object} ChampionshipCut
 * @property {number} toDay
 * @property {string} rule
 * @property {string[]} uids
 * @property {number} advancingCount
 * @property {number} missedCount
 * @property {number|null} cutLine
 */

/**
 * podium-recaps/{seasonUid}/days/{day}. New recaps carry `shows`; legacy per-day
 * recaps carried a flat `results`.
 * @typedef {Object} PodiumRecapDay
 * @property {PodiumRecapShow[]} [shows]
 * @property {PodiumRecapRow[]} [results]
 * @property {ChampionshipCut|null} [championshipCut]
 * @property {Array<{ corpsA: string|null, corpsB: string|null, city?: string|null }>} [jointRehearsals]
 */

/** A ranked row on the sheet: the recap row and its place in its section. */
/** @typedef {{ row: PodiumRecapRow, place: number }} RankedRow */

/**
 * A section of a show's box score: one division, or on a World Championship
 * night the whole field.
 * @typedef {Object} SheetSection
 * @property {string|null|undefined} cls
 * @property {string} label
 * @property {import('../../utils/worldChampionship').WorldChampionshipRound|null} world
 * @property {Record<string, number>} tops
 * @property {RankedRow[]} rows
 */

/** @type {Record<number, { name: string, site: string }>} */
const MAJOR_MASTHEADS = {
  28: { name: 'marching.art Southwestern Championship', site: 'San Antonio, TX' },
  35: { name: 'marching.art Southeastern Championship', site: 'Atlanta, GA' },
  41: { name: 'marching.art Eastern Classic — Night 1', site: 'Allentown, PA' },
  42: { name: 'marching.art Eastern Classic — Night 2', site: 'Allentown, PA' },
  47: { name: 'marching.art World Championship Prelims', site: 'Podium Division' },
  48: { name: 'marching.art World Championship Semifinals', site: 'Podium Division' },
  49: { name: 'marching.art World Championship Finals', site: 'Podium Division' },
};

/** @param {number} day */
function fallbackMasthead(day) {
  return MAJOR_MASTHEADS[day] || { name: 'Podium Division Tour Stop', site: `Day ${day}` };
}

/**
 * A recap day's shows, normalized. New recaps carry `shows: [...]`; legacy
 * per-day recaps carried a flat `results` — wrap those as one synthetic show.
 * @param {PodiumRecapDay|null|undefined} recap
 * @returns {PodiumRecapShow[]}
 */
function showsOf(recap) {
  if (Array.isArray(recap?.shows)) return recap.shows;
  if (Array.isArray(recap?.results)) {
    return [{ eventName: null, location: null, results: recap.results }];
  }
  return [];
}

/**
 * Bold the top value in each caption column — real recaps mark box-toppers.
 * @param {PodiumRecapRow[]} results
 * @returns {Record<string, number>}
 */
function boxToppersOf(results) {
  /** @type {Record<string, number>} */
  const tops = {};
  for (const caption of PODIUM_CAPTIONS) {
    tops[caption] = Math.max(0, ...results.map((r) => r.captions?.[caption] ?? 0));
  }
  return tops;
}

/** @param {number|undefined} v */
const fmt = (v) => (typeof v === 'number' ? v.toFixed(2) : '—');

/**
 * Index of the last element matching `test`, or -1 (Array.prototype.findLastIndex
 * without the es2023 lib).
 * @template T
 * @param {T[]} list
 * @param {(item: T) => boolean} test
 */
function lastIndexWhere(list, test) {
  for (let i = list.length - 1; i >= 0; i--) if (test(list[i])) return i;
  return -1;
}

/**
 * A show's field, split into division sections (World → Open → A). Each section
 * is ranked on its OWN scores — a division's winner is the corps that won that
 * division, not whoever happened to place first in a mixed field — and carries
 * its own box-toppers. A caption sort reorders the rows inside a section while
 * the placements stay put, exactly like the fantasy recaps.
 *
 * On a World Championship night (days 47-49) the whole field is ONE section,
 * ranked together — no division wins anything on its own that night.
 * @param {PodiumRecapRow[]|undefined} results
 * @param {string} sortBy 'total' or a caption id.
 * @param {number} day
 * @param {string|null|undefined} eventName
 * @returns {SheetSection[]}
 */
function buildSections(results, sortBy, day, eventName) {
  return sectionsForNight(results || [], { day, eventName }, (row) => row.division || 'aClass').map(
    ({ cls, label, world, rows }) => {
      const ranked = [...rows]
        .sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0))
        .map((row, index) => ({ row, place: index + 1 }));
      return {
        cls,
        label,
        world,
        tops: boxToppersOf(rows),
        rows:
          sortBy === 'total'
            ? ranked
            : [...ranked].sort(
                (a, b) => (b.row.captions?.[sortBy] ?? 0) - (a.row.captions?.[sortBy] ?? 0)
              ),
      };
    }
  );
}

/**
 * Format a single show as a monospace text sheet — pastes cleanly into Discord
 * (wrap in a code block) and group chats, the way FMA recaps circulated. One
 * block per show and one stanza per division, matching what is on screen.
 * @param {PodiumRecapShow} show
 * @param {number} day
 * @param {string|null|undefined} seasonName
 * @param {ChampionshipCut|null} cut
 * @param {SheetSection[]} sections
 */
function formatShowAsText(show, day, seasonName, cut, sections) {
  const head = fallbackMasthead(day);
  const advancing = new Set(cut?.uids || []);
  const lines = [
    `${formatEventName(show.eventName) || head.name}${show.location ? ` — ${show.location}` : ''} · Day ${day} of 49`,
    // A pasted championship sheet has to carry the cut too — it is the whole
    // story of the night, and a plain list of scores hides it.
    ...(cut ? [`${cut.rule} (marked ">")`] : []),
  ];
  for (const section of sections) {
    lines.push('');
    if (section.label) lines.push(section.label);
    for (const { row, place } of [...section.rows].sort((a, b) => a.place - b.place)) {
      const name = `${advancing.has(row.uid) ? '> ' : ''}${row.corpsName || 'Unknown'}`;
      lines.push(
        `${String(place).padStart(2)}. ${name.padEnd(24).slice(0, 24)} ${fmt(row.totalScore).padStart(7)}  (GE ${fmt(row.geScore)} · VIS ${fmt(row.visualScore)} · MUS ${fmt(row.musicScore)})`
      );
    }
  }
  lines.push('');
  lines.push(`marching.art${seasonName ? ` · ${seasonName}` : ''} — Podium Division`);
  return '```\n' + lines.join('\n') + '\n```';
}

// Sorting by class is gone: the sheet is always split by division now, so the
// only question left is which column orders the rows inside a division.
const SORT_OPTIONS = [
  { id: 'total', label: 'Total' },
  ...PODIUM_CAPTIONS.map((c) => ({ id: c, label: c })),
];

/** @param {{ sortBy: string, onChange: (id: string) => void }} props */
function SortBar({ sortBy, onChange }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
      <span className="text-[9px] uppercase tracking-wider text-muted pr-1 flex-shrink-0">
        Sort
      </span>
      {SORT_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          aria-pressed={sortBy === opt.id}
          className={`flex-shrink-0 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-none transition-colors press-feedback ${
            sortBy === opt.id
              ? 'bg-interactive text-white'
              : 'bg-surface-raised text-muted hover:text-secondary'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// One show = one card (matching the fantasy recap cards): its own frame,
// masthead, box score, and footer/share. The day's sort control lives above
// the cards, so a card is a pure box score.
/**
 * @param {{
 *   show: PodiumRecapShow,
 *   day: number,
 *   sortBy: string,
 *   seasonName?: string|null,
 *   viewer?: import('../../utils/corps').ViewerCorpsMatcher|null,
 *   cut?: ChampionshipCut|null,
 * }} props
 */
function ShowCard({ show, day, sortBy, seasonName, viewer, cut = null }) {
  const sections = useMemo(
    () => buildSections(show.results, sortBy, day, show.eventName),
    [show.results, sortBy, day, show.eventName]
  );
  const world = sections[0]?.world || null;
  // Who marches the next round, as the processor published it with this recap
  // (helpers/podium/store.championshipCutFor). Empty on all 46 other nights.
  const advancing = useMemo(() => new Set(cut?.uids || []), [cut]);
  const head = fallbackMasthead(day);

  return (
    <div className={`${SHEET_CARD} space-y-2.5`}>
      {/* Per-show masthead */}
      <div className="flex items-baseline justify-between border-b border-line-muted pb-1.5">
        <div className="text-[13px] font-bold text-white truncate">
          {formatEventName(show.eventName) || head.name}
        </div>
        {(show.location || head.site) && (
          <div className="text-[10px] uppercase tracking-wider text-muted flex-shrink-0 pl-2">
            {show.location || head.site}
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        {/* Fixed layout + shared colgroup so every show's caption columns line
            up vertically regardless of corps-name length (names truncate). */}
        <table className="w-full table-fixed text-[11px] tabular-nums whitespace-nowrap">
          <colgroup>
            <col style={{ width: '200px' }} />
            {PODIUM_CAPTIONS.map((caption) => (
              <col key={caption} style={{ width: '54px' }} />
            ))}
            <col style={{ width: '54px' }} />
            <col style={{ width: '54px' }} />
            <col style={{ width: '54px' }} />
            <col style={{ width: '62px' }} />
          </colgroup>
          <thead>
            <tr className="text-[9px] uppercase tracking-wider text-muted border-b border-line">
              <th className="text-left py-1.5 pr-2 sticky left-0 bg-surface-card">Pl · Corps</th>
              {PODIUM_CAPTIONS.map((caption) => (
                <th
                  key={caption}
                  className={`px-1.5 text-right ${sortBy === caption ? 'text-interactive' : ''}`}
                >
                  {caption}
                </th>
              ))}
              <th className="px-1.5 text-right text-muted">GE</th>
              <th className="px-1.5 text-right text-muted">VIS</th>
              <th className="px-1.5 text-right text-muted">MUS</th>
              <th className="pl-2 text-right text-white">Total</th>
            </tr>
          </thead>
          {/* One tbody per division — its own header row, its own ranking, its
              own box-toppers, all sharing the table's columns so the numbers
              still line up down the whole sheet. */}
          {sections.map((section) => {
            const advancingCount = cut
              ? section.rows.filter(({ row }) => advancing.has(row.uid)).length
              : 0;
            // The cut line only reads as a line while the section is in score
            // order; under a caption sort the rows no longer run from survivor
            // to eliminated, so there the chips carry it alone. Splitting by
            // division makes the line work on the per-division nights too
            // (Day 45 cuts Open and A on their own standings).
            const cutLineAfter =
              cut && sortBy === 'total'
                ? lastIndexWhere(section.rows, ({ row }) => advancing.has(row.uid))
                : -1;

            return (
              <tbody key={section.cls || 'other'}>
                <tr className="border-b border-line">
                  <th
                    scope="rowgroup"
                    className="text-left pt-3 pb-1 pr-2 sticky left-0 bg-surface-card text-[9px] font-bold uppercase tracking-wider text-muted"
                  >
                    {section.label}
                  </th>
                  <td
                    colSpan={PODIUM_CAPTIONS.length + 4}
                    className="pt-3 pb-1 text-right text-[9px] uppercase tracking-wider text-muted"
                  >
                    {advancingCount > 0 && (
                      <span className="text-green-400 font-bold">{advancingCount} advance · </span>
                    )}
                    {section.rows.length} corps
                  </td>
                </tr>
                {section.rows.map(({ row, place }, rowIndex) => {
                  const isMine = isViewerCorps(row, viewer);
                  const advances = advancing.has(row.uid);
                  // The medal this place earns on its division's podium, at a
                  // show with a real field — the same rule the season ledger
                  // and the nightly run apply.
                  const medal = podiumMedalForPlace(place, show.results?.length);
                  return (
                    <tr
                      key={row.uid}
                      className={`border-b ${
                        rowIndex === cutLineAfter && rowIndex < section.rows.length - 1
                          ? 'border-green-500/60'
                          : 'border-line-subtle'
                      } ${isMine ? 'bg-interactive/10' : ''} ${
                        cut && !advances ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="py-1.5 pr-2 sticky left-0 bg-surface-card">
                        {/* Place · avatar · corps name — the corps avatar is
                            shown the same way as the other classes (see
                            CorpsIdentity in ScoresParts). */}
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-muted flex-shrink-0">{place}.</span>
                          {medal && (
                            <Medal
                              className={`w-3 h-3 flex-shrink-0 ${MEDAL_TEXT_CLASS[medal]}`}
                              aria-label={`${medal} medal`}
                            />
                          )}
                          <TeamAvatar name={row.corpsName} logoUrl={row.avatarUrl} size="xs" />
                          <div className="min-w-0">
                            <div className="flex items-baseline gap-1.5 min-w-0">
                              <span
                                className={`font-bold truncate ${isMine ? 'text-interactive' : 'text-white'}`}
                              >
                                {row.corpsName}
                              </span>
                              {advances && cut && <AdvancesTag toDay={cut.toDay} />}
                              {!advances && world?.winner && place === 1 && (
                                <TitleTag title={world.winner} />
                              )}
                            </div>
                            {/* Director credit + profile link under the corps
                                name — displayed the same way as the other
                                classes. */}
                            {row.displayName &&
                              (row.uid ? (
                                <Link
                                  to={`/profile/${row.uid}`}
                                  className="block text-[10px] text-muted hover:text-interactive truncate"
                                >
                                  {row.displayName}
                                </Link>
                              ) : (
                                <span className="block text-[10px] text-muted truncate">
                                  {row.displayName}
                                </span>
                              ))}
                          </div>
                        </div>
                      </td>
                      {PODIUM_CAPTIONS.map((caption) => {
                        const value = row.captions?.[caption];
                        const isTop = value != null && value === section.tops[caption];
                        return (
                          <td
                            key={caption}
                            className={`px-1.5 text-right ${
                              isTop
                                ? 'font-bold text-brand'
                                : sortBy === caption
                                  ? 'text-white'
                                  : 'text-secondary'
                            }`}
                          >
                            {fmt(value)}
                          </td>
                        );
                      })}
                      <td className="px-1.5 text-right text-muted">{fmt(row.geScore)}</td>
                      <td className="px-1.5 text-right text-muted">{fmt(row.visualScore)}</td>
                      <td className="px-1.5 text-right text-muted">{fmt(row.musicScore)}</td>
                      <td className="pl-2 text-right font-bold text-white">
                        {fmt(row.totalScore)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
        </table>
      </div>

      {/* Wordmark footer + per-show share — same spot as the fantasy cards */}
      <div className="flex justify-between items-center gap-2 pt-1 text-[9px] uppercase tracking-wider text-muted">
        <span className="truncate">
          {cut ? (
            <>
              <span className="text-green-400 font-bold">ADV</span> = marches Day {cut.toDay} ·{' '}
              {cut.rule}
              {world ? ' · one field, every division' : ''}
            </>
          ) : world ? (
            <>
              {world.title} · one field, every division
              {world.winner ? ` · 1st = ${world.winner}` : ''} · box-toppers in{' '}
              <span className="text-brand font-bold">gold</span>
            </>
          ) : (
            <>
              Split by class · box-toppers in <span className="text-brand font-bold">gold</span> ·
              full captions — Podium Division only
            </>
          )}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <ShareButton getText={() => formatShowAsText(show, day, seasonName, cut, sections)} />
          <span className="font-bold text-muted">
            marching.art{seasonName ? ` · ${seasonName}` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

// The Podium Report (the weekly power-rankings column) now lives on its own
// Scores tab — see components/Podium/PodiumReportSheet. This sheet renders only
// the per-show recap box scores.

/**
 * @param {{
 *   seasonUid?: string|null,
 *   seasonName?: string|null,
 *   viewer?: import('../../utils/corps').ViewerCorpsMatcher|null,
 * }} props
 */
export default function PodiumRecapSheet({ seasonUid, seasonName, viewer = null }) {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(
    /** @type {Array<{ day: number, recap: PodiumRecapDay }>} */ ([])
  );
  const [selectedDay, setSelectedDay] = useState(/** @type {number|null} */ (null));
  const [sortBy, setSortBy] = useState('total');
  // Keep the highlighted day visible on mobile (the strip runs D1→D49 and the
  // latest day defaults selected, so without this it sits off the right edge).
  const { containerRef: dayStripRef, selectedRef: selectedDayRef } = useHorizontalTabSlide(
    `${selectedDay}:${days.length}`
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!seasonUid) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const snapshot = await getDocs(collection(db, 'podium-recaps', seasonUid, 'days'));
        if (cancelled) return;
        const loaded = snapshot.docs
          .map((doc) => ({
            day: Number(doc.id),
            recap: /** @type {PodiumRecapDay} */ (doc.data()),
          }))
          .sort((a, b) => a.day - b.day);
        setDays(loaded);
        setSelectedDay(loaded.length > 0 ? loaded[loaded.length - 1].day : null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seasonUid]);

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted" />
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-muted">
        No Podium Division results yet this season — the first recap sheet posts after the next
        scored show.
      </div>
    );
  }

  const selected = days.find((d) => d.day === selectedDay) || days[days.length - 1];
  const shows = showsOf(selected.recap);
  // The cut this night decided, published with the recap by the processor
  // (§5.7). Podium runs the fantasy bracket in parallel on its own board, so
  // Prelims and Semifinals nights carry the same "who marches tomorrow" answer.
  const cut = selected.recap.championshipCut || null;

  return (
    <div className="p-3 md:p-4 space-y-3">
      {/* Day selector — auto-slides so the highlighted day stays visible */}
      <div ref={dayStripRef} className="flex gap-1 overflow-x-auto scrollbar-hide">
        {days.map(({ day }) => (
          <button
            key={day}
            ref={day === selected.day ? selectedDayRef : null}
            onClick={() => setSelectedDay(day)}
            className={`flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-none tabular-nums transition-colors press-feedback ${
              day === selected.day
                ? 'bg-interactive text-white'
                : 'text-muted hover:text-white hover:bg-white/5 border border-line'
            }`}
          >
            D{day}
          </button>
        ))}
      </div>

      {/* Sort control — outside the frames, like the fantasy tab */}
      <div className="flex items-center justify-between gap-2">
        <SortBar sortBy={sortBy} onChange={setSortBy} />
        <div className="text-[9px] uppercase tracking-wider text-secondary font-bold flex-shrink-0">
          Official Recap
        </div>
      </div>

      {/* Championship-week cut — what tonight's scores decided */}
      {cut && (
        <CutBanner
          rule={cut.rule}
          toDay={cut.toDay}
          advancingCount={cut.advancingCount}
          missedCount={cut.missedCount}
          cutLine={cut.cutLine}
        />
      )}

      {/* One framed card per show (matching the fantasy recap cards) */}
      {shows.length === 0 ? (
        <div className="p-8 text-center text-[11px] text-muted">
          No shows scored on Day {selected.day}.
        </div>
      ) : (
        shows.map((show, idx) => (
          <ShowCard
            key={show.eventName || idx}
            show={show}
            day={selected.day}
            sortBy={sortBy}
            seasonName={seasonName}
            viewer={viewer}
            cut={cut}
          />
        ))
      )}

      {/* Joint-rehearsal feed (§5.12): public smoke, private fire — who shared a
          floor, never the scrimmage numbers. Its own frame, below the shows. */}
      {(selected.recap.jointRehearsals || []).length > 0 && (
        <div className={`${SHEET_CARD} space-y-1`}>
          <div className="text-[9px] font-bold uppercase tracking-wider text-muted">
            Joint Rehearsals
          </div>
          {(selected.recap.jointRehearsals || []).map((item, idx) => (
            <div key={idx} className="text-[10px] text-muted italic">
              {item.corpsA} and {item.corpsB} held a joint rehearsal
              {item.city ? ` in ${item.city}` : ''}.
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
