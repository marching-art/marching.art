// Tests for useUrgencyTriggers — specifically the live-vs-off-season split that
// drives the signed-out home page's urgency copy.
//
// The regression these pin: the hook used to branch on `seasonData.seasonType`,
// a field nothing ever writes to `game-settings/season` (both season creators in
// functions/src/helpers/season.js write `status`). That made every consumer see
// 'off' year-round — the season-progress trigger and SeasonCountdown were dead
// code — while the live-show copy unconditionally claimed "Live from the DCI
// tour", which is false off-season, where shows are generated and scored from
// historical results.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

interface SeasonState {
  seasonData: { status: string; totalWeeks: number };
  weeksRemaining: number;
  loading: boolean;
  currentDay: number;
  currentWeek: number;
}

interface ScheduleState {
  competitions: { id: string; date: Date }[];
  loading: boolean;
}

const state = vi.hoisted(() => ({
  season: {} as SeasonState,
  schedule: {} as ScheduleState,
}));

// Selector-style zustand mocks: useSeasonStore(sel) => sel(state).
vi.mock('../store/seasonStore', () => ({
  useSeasonStore: (selector: (s: SeasonState) => unknown) => selector(state.season),
}));

vi.mock('../store/scheduleStore', () => ({
  useScheduleStore: (selector: (s: ScheduleState) => unknown) => selector(state.schedule),
}));

// Show timing is stubbed so "is a show live right now" never depends on the
// wall clock the suite happens to run at.
vi.mock('../utils/scheduleUtils', () => ({
  isShowLive: vi.fn(),
  showStartsAtDate: vi.fn(),
}));

import { isShowLive, showStartsAtDate } from '../utils/scheduleUtils';
import { useUrgencyTriggers } from './useUrgencyTriggers';

// The hook compares a show date's UTC calendar parts against the local calendar
// date (matchesCalendarDay), so "today" must be built in UTC from local parts.
function todayAsShowDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/** The trigger fields these tests read. */
interface UrgencyTrigger {
  id: string;
  message: string;
  subMessage?: string;
}

// The hook is untyped JS whose `all` starts life as an empty array literal, so
// TS infers `never[]` for it. Read the list through these two helpers rather
// than re-asserting the element type at every call site.
function findTrigger(all: unknown, id: string): UrgencyTrigger | undefined {
  return (all as UrgencyTrigger[]).find((t) => t.id === id);
}

/** Same, for the cases that are only meaningful if the trigger fired. */
function requireTrigger(all: unknown, id: string): UrgencyTrigger {
  const found = findTrigger(all, id);
  if (!found) throw new Error(`expected an urgency trigger with id "${id}"`);
  return found;
}

function setUp(status: 'live-season' | 'off-season', { currentWeek = 0 } = {}) {
  state.season = {
    seasonData: { status, totalWeeks: 7 },
    // 5 weeks out keeps the finals/countdown triggers quiet so the show-based
    // trigger stays first in `all`.
    weeksRemaining: 5,
    loading: false,
    currentDay: currentWeek * 7,
    currentWeek,
  };
  state.schedule = {
    competitions: [{ id: 'show-1', date: todayAsShowDate() }],
    loading: false,
  };
}

beforeEach(() => {
  vi.mocked(isShowLive).mockReset();
  vi.mocked(showStartsAtDate).mockReset();
  // Enriched timing present, so the hook trusts it instead of falling back to
  // the "it's evening, assume live" heuristic.
  vi.mocked(showStartsAtDate).mockReturnValue(new Date(Date.now() - 60_000));
});

describe('useUrgencyTriggers season type', () => {
  it("derives 'live' from the season doc's status field", () => {
    setUp('live-season');
    vi.mocked(isShowLive).mockReturnValue(false);

    const { result } = renderHook(() => useUrgencyTriggers());

    expect(result.current.seasonType).toBe('live');
  });

  it("derives 'off' for an off-season doc", () => {
    setUp('off-season');
    vi.mocked(isShowLive).mockReturnValue(false);

    const { result } = renderHook(() => useUrgencyTriggers());

    expect(result.current.seasonType).toBe('off');
  });

  it('emits the season-progress trigger during a live season', () => {
    setUp('live-season', { currentWeek: 3 });
    vi.mocked(isShowLive).mockReturnValue(false);

    const { result } = renderHook(() => useUrgencyTriggers());

    const progress = requireTrigger(result.current.all, 'season_progress');
    expect(progress.message).toBe('Week 3 of 7');
    expect(progress.subMessage).toBe('Live Season');
  });

  it('omits the season-progress trigger off-season', () => {
    setUp('off-season', { currentWeek: 3 });
    vi.mocked(isShowLive).mockReturnValue(false);

    const { result } = renderHook(() => useUrgencyTriggers());

    expect(findTrigger(result.current.all, 'season_progress')).toBeUndefined();
  });
});

describe('useUrgencyTriggers show copy', () => {
  it('credits the DCI tour only when a live season is actually running', () => {
    setUp('live-season');
    vi.mocked(isShowLive).mockReturnValue(true);

    const { result } = renderHook(() => useUrgencyTriggers());

    const live = requireTrigger(result.current.all, 'live_now');
    expect(live.message).toBe('1 show performing now');
    expect(live.subMessage).toBe('Live from the DCI tour');
  });

  it('does not claim a live DCI tour off-season', () => {
    setUp('off-season');
    vi.mocked(isShowLive).mockReturnValue(true);

    const { result } = renderHook(() => useUrgencyTriggers());

    const live = requireTrigger(result.current.all, 'live_now');
    expect(live.message).toBe('1 show scoring tonight');
    expect(live.subMessage).toBe('Off-season — scored from DCI history');
    expect(live.subMessage).not.toMatch(/tour/i);
  });

  it('promises live scores tonight only in a live season', () => {
    // Show is today but hasn't started yet -> the "shows today" branch.
    vi.mocked(showStartsAtDate).mockReturnValue(new Date(Date.now() + 60 * 60_000));
    vi.mocked(isShowLive).mockReturnValue(false);

    setUp('live-season');
    const liveRun = renderHook(() => useUrgencyTriggers());
    expect(requireTrigger(liveRun.result.current.all, 'shows_today').message).toBe(
      'Live scores tonight'
    );

    setUp('off-season');
    const offRun = renderHook(() => useUrgencyTriggers());
    expect(requireTrigger(offRun.result.current.all, 'shows_today').message).toBe(
      'Scores drop tonight'
    );
  });
});
