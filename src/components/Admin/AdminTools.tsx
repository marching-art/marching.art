// Admin tools that take input (a day, an email, a date) — as opposed to the
// one-click registry jobs in JobList. Each is a self-contained Panel that runs
// through the shared admin runner, so toasts, confirms and season reloads
// behave identically everywhere.

import { useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  BookOpen,
  CalendarX,
  Mail,
  Newspaper,
  Play,
  RefreshCw,
  Search,
  Send,
  Trophy,
} from 'lucide-react';
import { triggerDailyNews, triggerSeasonSummary } from '../../api/functions';
import { Panel, ProcessRow, actionButtonClass, inputClass } from './AdminUI';
import { useAdmin } from './adminContextCore';

const errorText = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

// =============================================================================
// DAY ACTION — "pick a competition day, press a button"
// =============================================================================

interface DayActionPanelProps {
  id?: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  description: ReactNode;
  min: number;
  max: number;
  buttonLabel: string;
  busyLabel: string;
  disabled?: boolean;
  tone?: 'default' | 'danger';
  onRun: (day: number) => Promise<boolean | void>;
}

function DayActionPanel({
  id,
  title,
  icon: Icon,
  description,
  min,
  max,
  buttonLabel,
  busyLabel,
  disabled,
  tone,
  onRun,
}: DayActionPanelProps) {
  const [day, setDay] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const value = parseInt(day, 10);
    if (!value || value < min || value > max) {
      toast.error(`Enter a valid day (${min}-${max})`);
      return;
    }
    setBusy(true);
    try {
      const ok = await onRun(value);
      if (ok !== false) setDay('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel id={id} title={title} icon={Icon} description={description} tone={tone}>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          type="number"
          min={min}
          max={max}
          placeholder="Day #"
          aria-label={`${title} day`}
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className={`${inputClass} w-24 font-data tabular-nums`}
        />
        <button type="submit" disabled={busy || !day || disabled} className={actionButtonClass}>
          {busy ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
          {busy ? busyLabel : buttonLabel}
        </button>
      </form>
    </Panel>
  );
}

// =============================================================================
// SEASON & SCORING
// =============================================================================

/** Start a new off-season / live season — the most destructive admin act. */
export function SeasonLifecyclePanel({ id }: { id?: string }) {
  const { runAdminFunction, refreshInbox } = useAdmin();
  const [running, setRunning] = useState<string | null>(null);

  const start = async (functionName: string, label: string) => {
    if (
      !window.confirm(
        `${label}?\n\nThis archives every director's current corps data and resets the game state.`
      )
    ) {
      return;
    }
    setRunning(functionName);
    try {
      await runAdminFunction(functionName);
    } catch (error) {
      // The server refuses to re-mint the season that is already active (it
      // would keep every Podium roster keyed to the same season while
      // resetting the fantasy side). Regenerating in place is a deliberate,
      // separately confirmed act.
      if (
        error instanceof Error &&
        error.message.includes('already the active season') &&
        window.confirm(
          `${label}: this season is already the active one. Regenerate it IN PLACE anyway ` +
            '(schedule and pool rebuilt, no Podium re-registration)? This cannot be undone.'
        )
      ) {
        await runAdminFunction(functionName, { force: true }).catch(() => undefined);
      }
    } finally {
      setRunning(null);
      void refreshInbox();
    }
  };

  return (
    <Panel
      id={id}
      title="Season Lifecycle"
      icon={AlertTriangle}
      tone="danger"
      flush
      description="Starting a season archives all current corps data and resets the game state. The 3 AM scheduler does this automatically — use these only to recover a missed or broken rollover."
    >
      <ProcessRow
        name="Start New Off-Season"
        description="Archive current data and begin a new off-season."
        icon={Play}
        caution
        actionLabel="Start"
        loading={running === 'startNewOffSeason'}
        onExecute={() => void start('startNewOffSeason', 'Start a new off-season')}
      />
      <ProcessRow
        name="Start New Live Season"
        description="Archive current data and begin a new live DCI season."
        icon={Play}
        caution
        actionLabel="Start"
        loading={running === 'startNewLiveSeason'}
        onExecute={() => void start('startNewLiveSeason', 'Start a new live season')}
      />
    </Panel>
  );
}

/**
 * Re-score one competition day of the active season — the repair path for a
 * night that scored against bad data. force=true is required (the first run
 * holds the day's lease) and it RE-APPLIES the day's coin/XP awards.
 */
export function RescoreDayPanel({ id }: { id?: string }) {
  const { seasonData, runAdminFunction, refreshInbox } = useAdmin();
  const isOffSeason = seasonData?.status === 'off-season';
  const jobName = isOffSeason ? 'processAndArchiveOffSeasonScores' : 'processLiveSeasonScores';
  const label = isOffSeason ? 'off-season' : 'live season';

  return (
    <DayActionPanel
      id={id}
      title={`Re-score a ${isOffSeason ? 'Off-Season' : 'Live Season'} Day`}
      icon={RefreshCw}
      tone="danger"
      description={
        <>
          Re-run scoring for one day (1-49) of the {label} after fixing the data it scored against —
          e.g. a show missing from the schedule. Re-applies that day&apos;s coin and XP awards
          {isOffSeason ? ' and posts the Discord score drop' : ''}.
        </>
      }
      min={1}
      max={49}
      buttonLabel="Re-score"
      busyLabel="Scoring…"
      disabled={!seasonData}
      onRun={async (day) => {
        if (
          !window.confirm(
            `Re-score ${label} day ${day}?\n\nThis re-runs scoring for that day and RE-APPLIES its ` +
              'coin and XP awards to every corps that scores. Only do this after fixing the data.'
          )
        ) {
          return false;
        }
        try {
          await runAdminFunction('manualTrigger', { jobName, scoredDay: day, force: true });
          void refreshInbox();
          return true;
        } catch {
          return false;
        }
      }}
    />
  );
}

/**
 * Finals-date override: the safety valve for the rare year DCI holds Finals
 * off the 2nd Saturday of August. Reshapes FUTURE season windows only.
 */
export function FinalsDateOverridePanel({ id }: { id?: string }) {
  const { runAdminFunction } = useAdmin();
  const [year, setYear] = useState(String(new Date().getFullYear() + 1));
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (clear: boolean) => {
    const y = Number(year);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) {
      toast.error('Enter a 4-digit year');
      return;
    }
    if (!clear && !date) {
      toast.error('Pick the Finals date');
      return;
    }
    const prompt = clear
      ? `Clear the ${y} Finals override and use the computed 2nd Saturday of August?`
      : `Set ${y} Finals to ${date}? Takes effect at the next season rollover.`;
    if (!window.confirm(prompt)) return;
    setBusy(true);
    try {
      await runAdminFunction('manualTrigger', {
        jobName: 'setFinalsDateOverride',
        year: y,
        date: clear ? null : date,
      });
      if (clear) setDate('');
    } catch {
      // toasted by the runner
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      id={id}
      title="Finals Date Override"
      icon={CalendarX}
      description="For the rare year DCI schedules Finals off the 2nd Saturday of August. Reshapes future season windows only — it applies at the next rollover."
    >
      <div className="flex flex-wrap gap-2">
        <input
          type="number"
          min={2000}
          max={2100}
          aria-label="Finals year"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className={`${inputClass} w-24 font-data tabular-nums`}
        />
        <input
          type="date"
          aria-label="Finals date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={`${inputClass} w-40`}
        />
        <button
          type="button"
          disabled={busy || !date}
          onClick={() => void submit(false)}
          className={actionButtonClass}
        >
          <Trophy className="w-3 h-3" /> Set override
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit(true)}
          className="h-9 px-3 text-[10px] font-bold uppercase text-muted border border-line hover:text-white disabled:opacity-50"
        >
          Clear
        </button>
      </div>
    </Panel>
  );
}

// =============================================================================
// NEWSROOM
// =============================================================================

export function NewsGenerationPanel({ id }: { id?: string }) {
  const { seasonData } = useAdmin();
  return (
    <DayActionPanel
      id={id}
      title="Generate Daily News"
      icon={Newspaper}
      description="Generate the day's AI news articles (1-49) from current season data — to backfill a missed day or re-run after a data fix."
      min={1}
      max={49}
      buttonLabel="Generate"
      busyLabel="Generating…"
      disabled={!seasonData}
      onRun={async (day) => {
        if (!seasonData?.dataDocId || !seasonData?.seasonUid) {
          toast.error('Season data not available');
          return false;
        }
        try {
          await triggerDailyNews({
            currentDay: day,
            dataDocId: seasonData.dataDocId,
            seasonId: seasonData.seasonUid,
          });
          toast.success(`News generated for Day ${day}`);
          return true;
        } catch (error) {
          toast.error(errorText(error, 'Failed to generate news'));
          return false;
        }
      }}
    />
  );
}

export function SeasonSummaryPanel({ id }: { id?: string }) {
  const { seasonData } = useAdmin();
  return (
    <DayActionPanel
      id={id}
      title="Season Summary Article"
      icon={BookOpen}
      description="Generate the season-to-date summary for a day (15-49). It auto-publishes on dark days; use this to backfill a day already scored."
      min={15}
      max={49}
      buttonLabel="Generate"
      busyLabel="Generating…"
      disabled={!seasonData}
      onRun={async (day) => {
        if (!seasonData?.seasonUid) {
          toast.error('Season data not available');
          return false;
        }
        try {
          const result = await triggerSeasonSummary({
            seasonId: seasonData.seasonUid,
            dataDocId: seasonData.dataDocId,
            throughDay: day,
          });
          if (result?.data?.success) {
            toast.success(`Season summary generated for Day ${day}`);
            return true;
          }
          toast.error(result?.data?.error || 'Not enough season data for that day');
          return false;
        } catch (error) {
          toast.error(errorText(error, 'Failed to generate season summary'));
          return false;
        }
      }}
    />
  );
}

// =============================================================================
// PLAYERS
// =============================================================================

interface SweepLoser {
  uid: string;
  corpsName: string;
  corpsClass: string;
  winner: { corpsName: string; corpsClass: string };
}

interface SweepResult {
  scanned?: number;
  flagged?: number;
  cleared?: number;
  directorsAffected?: number;
  losers?: SweepLoser[];
}

export function DuplicateSweepPanel({ id }: { id?: string }) {
  const { runAdminFunction } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SweepResult | null>(null);

  const run = async () => {
    if (
      !window.confirm(
        'Run the duplicate corps sweep?\n\nEvery corps sharing a name with a higher-priority corps is flagged, and its director is forced into a rename on their next dashboard load.'
      )
    ) {
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      setResult(((await runAdminFunction('sweepDuplicateCorps', {})) ?? null) as SweepResult);
    } catch {
      // toasted by the runner
    } finally {
      setBusy(false);
    }
  };

  const tiles: [string, number | undefined, string][] = result
    ? [
        ['Scanned', result.scanned, 'text-white'],
        ['Flagged', result.flagged, 'text-red-400'],
        ['Cleared', result.cleared, 'text-green-400'],
        ['Directors', result.directorsAffected, 'text-white'],
      ]
    : [];

  return (
    <Panel
      id={id}
      title="Duplicate Corps Names"
      icon={Search}
      description="Scan every active corps for name collisions. The higher tier keeps the name (World > Open > A > SoundSport, then oldest). Each loser is flagged for a forced rename. Idempotent — safe to re-run."
    >
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        className={actionButtonClass}
      >
        {busy ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
        {busy ? 'Scanning…' : 'Run sweep'}
      </button>
      {result && (
        <div className="mt-3 bg-surface-sunken border border-line p-3 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] uppercase tracking-wider">
            {tiles.map(([label, value, color]) => (
              <div key={label}>
                <div className="text-muted">{label}</div>
                <div className={`text-sm font-data tabular-nums ${color}`}>{value ?? 0}</div>
              </div>
            ))}
          </div>
          {result.losers && result.losers.length > 0 && (
            <div className="border-t border-line pt-2 max-h-64 overflow-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-muted text-left">
                    <th className="font-normal pb-1">Corps</th>
                    <th className="font-normal pb-1">Class</th>
                    <th className="font-normal pb-1">Loses to</th>
                  </tr>
                </thead>
                <tbody className="text-secondary">
                  {result.losers.map((l, idx) => (
                    <tr
                      key={`${l.uid}-${l.corpsClass}-${idx}`}
                      className="border-t border-line-subtle"
                    >
                      <td className="py-1 pr-2">{l.corpsName}</td>
                      <td className="py-1 pr-2 text-muted">{l.corpsClass}</td>
                      <td className="py-1 text-muted">
                        {l.winner.corpsName} ({l.winner.corpsClass})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

// =============================================================================
// SYSTEM
// =============================================================================

export function TestEmailPanel({ id }: { id?: string }) {
  const { runAdminFunction } = useAdmin();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!email.trim()) {
      toast.error('Enter an email');
      return;
    }
    setBusy(true);
    try {
      await runAdminFunction('sendTestEmail', { email: email.trim() });
      setEmail('');
    } catch {
      // toasted by the runner
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      id={id}
      title="Test Email"
      icon={Mail}
      description="Send a test message through the transactional email provider to confirm delivery."
    >
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          type="email"
          placeholder="you@example.com"
          aria-label="Test email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`${inputClass} flex-1`}
        />
        <button
          type="submit"
          aria-label="Send test email"
          disabled={busy || !email.trim()}
          className={actionButtonClass}
        >
          {busy ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          Send
        </button>
      </form>
    </Panel>
  );
}
