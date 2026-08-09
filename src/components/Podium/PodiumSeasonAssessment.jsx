// PodiumSeasonAssessment — the between-seasons reward moment (design §5.7 + §5.13).
//
// Before a returning director sets up the new season, they see the complete
// evaluation of last season: how they stacked up against the field, the CLASS
// (A/Open/World division) and STATUS (Community Corps → Champion Status tier)
// they earned, and their SEPARATE activity rating. Only THEN do they choose the
// corps' fate — continue it, start a new one, retire it, or un-retire a banked
// lineage. Every status change is confirmed, and un-retire shows where the
// restored corps will land before the director agrees.

import React, { useState } from 'react';
import { ArrowUp, ArrowDown, Minus, Trophy, Flame, Loader2, AlertTriangle } from 'lucide-react';

/**
 * @typedef {import('../../api/podium').PodiumAssessment} PodiumAssessment
 * @typedef {import('../../api/podium').PodiumCarryover} PodiumCarryover
 * @typedef {import('../../api/podium').PodiumRetiredLineage} PodiumRetiredLineage
 */

/** @param {unknown} e */
const errMsg = (e) => (e && typeof e === 'object' && 'message' in e ? String(e.message) : '');

/** @type {Record<string, { icon: any, cls: string, word: string }>} */
const CHANGE_META = {
  promoted: { icon: ArrowUp, cls: 'text-green-400', word: 'Promoted' },
  relegated: { icon: ArrowDown, cls: 'text-warning', word: 'Relegated' },
  held: { icon: Minus, cls: 'text-muted', word: 'Held' },
};

/** @param {{ change: string }} props */
function ChangeBadge({ change }) {
  const meta = CHANGE_META[change] || CHANGE_META.held;
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${meta.cls}`}
    >
      <Icon className="w-3 h-3" />
      {meta.word}
    </span>
  );
}

// One of the two headline axes (CLASS / STATUS): from-label → to-label with the
// change badge. The arrow only shows when the value actually moved.
/**
 * @param {{ title: string, fromLabel: string, toLabel: string, change: string,
 *   footnote?: React.ReactNode }} props
 */
function AxisCard({ title, fromLabel, toLabel, change, footnote }) {
  return (
    <div className="flex-1 bg-surface-sunken border border-line rounded-none p-3 space-y-1">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted">{title}</div>
        <ChangeBadge change={change} />
      </div>
      <div className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
        {change !== 'held' && (
          <span className="text-muted line-through decoration-1">{fromLabel}</span>
        )}
        <span className="text-secondary">{toLabel}</span>
      </div>
      {footnote && <div className="text-[11px] text-muted">{footnote}</div>}
    </div>
  );
}

/** @param {number|null|undefined} n */
function ordinal(n) {
  if (n == null) return null;
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** @param {Record<string, number>|null|undefined} medals */
function medalSummary(medals) {
  if (!medals) return null;
  const parts = [];
  if (medals.gold) parts.push(`${medals.gold}× gold`);
  if (medals.silver) parts.push(`${medals.silver}× silver`);
  if (medals.bronze) parts.push(`${medals.bronze}× bronze`);
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * @param {{
 *   assessment: PodiumAssessment | null,
 *   carryover: PodiumCarryover | null,
 *   retiredLineages?: PodiumRetiredLineage[],
 *   podium: any,
 *   onContinue: () => void,
 *   onStartNew: () => void,
 *   onChanged?: () => Promise<void> | void,
 * }} props
 */
export default function PodiumSeasonAssessment({
  assessment,
  carryover,
  retiredLineages = [],
  podium,
  onContinue,
  onStartNew,
  onChanged,
}) {
  // Modal state: null | { kind: 'retire' | 'startNew' | 'unretire', ... }
  const [confirming, setConfirming] = useState(/** @type {any} */ (null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(/** @type {string|null} */ (null));

  const a = assessment;
  const corpsName = (a && a.corpsName) || (carryover && carryover.corpsName) || 'Your corps';
  const perf = a?.performance;
  const decisions = a?.decisions || ['continue', 'retire', 'startNew'];
  const canUnretire = decisions.includes('unretire') && retiredLineages.length > 0;

  /** @param {PodiumRetiredLineage} lineage */
  const openUnretire = async (lineage) => {
    setError(null);
    setBusy(true);
    try {
      const result = await podium.previewUnretire(lineage.index);
      setConfirming({ kind: 'unretire', lineage, preview: result.preview });
    } catch (err) {
      setError(errMsg(err) || 'Could not assess that corps.');
    } finally {
      setBusy(false);
    }
  };

  const doRetire = async () => {
    setBusy(true);
    setError(null);
    try {
      await podium.retireCorps();
      setConfirming(null);
      if (onChanged) await onChanged();
    } catch (err) {
      setError(errMsg(err) || 'Could not retire the corps.');
    } finally {
      setBusy(false);
    }
  };

  /** @param {number} lineageIndex */
  const doUnretire = async (lineageIndex) => {
    setBusy(true);
    setError(null);
    try {
      await podium.unretireCorps(lineageIndex);
      setConfirming(null);
      if (onChanged) await onChanged();
    } catch (err) {
      setError(errMsg(err) || 'Could not bring the corps back.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-surface-card border border-line rounded-none p-4 md:p-6 space-y-5 max-w-2xl">
      <div className="space-y-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-interactive">
          Season Assessment
        </div>
        <h2 className="text-base font-bold text-white">{corpsName}</h2>
        <p className="text-xs text-muted">
          Here&apos;s how you finished — and where the corps stands going into the new season. Your
          class and status are earned against last season&apos;s field. Choose what comes next.
        </p>
      </div>

      {a && a.competed && perf && (
        <div className="bg-surface-sunken border border-line rounded-none p-3 text-xs text-secondary space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Trophy className="w-3.5 h-3.5 text-interactive" />
            <span className="text-white font-bold">
              {perf.seasonRank != null && perf.seasonRankOf != null
                ? `Finished ${ordinal(perf.seasonRank)} of ${perf.seasonRankOf}`
                : 'Season complete'}
            </span>
            {perf.finalsTotal != null && (
              <span className="text-muted tabular-nums">
                · {perf.finalsTotal.toFixed(2)} finals
              </span>
            )}
            {perf.peerPercentile != null && (
              <span className="text-muted">
                · top {Math.max(1, Math.round(100 - perf.peerPercentile))}% of the field
              </span>
            )}
          </div>
          {medalSummary(perf.medals) && (
            <div className="text-[11px] text-brand">Hardware: {medalSummary(perf.medals)}</div>
          )}
          {perf.tierPerformance != null && (
            <div className="text-[11px] text-muted">
              You played to {Math.round(perf.tierPerformance)}% of your tier&apos;s ceiling — the
              measure your status climbs on.
            </div>
          )}
        </div>
      )}

      {a && (
        <div className="flex flex-col sm:flex-row gap-3">
          <AxisCard
            title="Class"
            fromLabel={a.class.previousLabel}
            toLabel={a.class.nextLabel}
            change={a.class.change}
            footnote={
              a.class.change === 'promoted'
                ? 'You earned your way up a division.'
                : a.class.change === 'relegated'
                  ? 'Relegated one division — climb back next season.'
                  : 'Holding your division.'
            }
          />
          <AxisCard
            title="Status"
            fromLabel={a.status.previousLabel}
            toLabel={a.status.nextLabel}
            change={a.status.change}
            footnote={
              a.status.reputationDelta !== 0
                ? `Reputation ${a.status.reputationDelta > 0 ? '+' : ''}${a.status.reputationDelta}${a.status.heritageApplied ? ' (heritage credit)' : ''}`
                : 'Reputation held.'
            }
          />
        </div>
      )}

      {a && a.activity && (
        <div className="flex items-center gap-2 text-xs">
          <Flame className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-white font-bold">{a.activity.label}</span>
          <span className="text-muted">
            engagement · {ordinal(Math.round(a.activity.percentile))} percentile of directors
          </span>
          {a.activity.recognition && (
            <span className="text-green-400 tabular-nums">+{a.activity.recognition.coin} CC</span>
          )}
        </div>
      )}

      {a && a.context && a.context.missedSeasons > 0 && (
        <div className="text-[11px] text-warning">
          Returning after {a.context.missedSeasons} season{a.context.missedSeasons > 1 ? 's' : ''}{' '}
          away — dormancy decay applied.
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      {/* Decisions */}
      <div className="space-y-2 pt-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
          Your decision
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onContinue}
            className="flex-1 min-w-[8rem] bg-interactive text-black font-bold text-sm py-2 px-3 rounded-none hover:opacity-90"
          >
            Continue {corpsName}
          </button>
          <button
            type="button"
            onClick={() => setConfirming({ kind: 'startNew' })}
            className="flex-1 min-w-[8rem] bg-surface-sunken border border-line text-white text-sm py-2 px-3 rounded-none hover:border-interactive"
          >
            Start a new corps
          </button>
          <button
            type="button"
            onClick={() => setConfirming({ kind: 'retire' })}
            className="flex-1 min-w-[8rem] bg-surface-sunken border border-line text-muted text-sm py-2 px-3 rounded-none hover:border-warning hover:text-warning"
          >
            Retire this corps
          </button>
        </div>
        {canUnretire && (
          <div className="pt-2 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Or bring back a retired corps
            </div>
            {retiredLineages.map((lineage) => (
              <button
                key={lineage.index}
                type="button"
                disabled={busy}
                onClick={() => openUnretire(lineage)}
                className="w-full flex items-center justify-between bg-surface-sunken border border-line rounded-none px-3 py-2 text-xs hover:border-interactive disabled:opacity-50"
              >
                <span className="text-white font-bold">{lineage.corpsName || 'Retired corps'}</span>
                <span className="text-muted">
                  {lineage.tierLabel} · {lineage.seasonsPlayed} seasons
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation modals — every status change is confirmed. */}
      {confirming && (
        <ConfirmDialog
          confirming={confirming}
          corpsName={corpsName}
          busy={busy}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            if (confirming.kind === 'retire') return doRetire();
            if (confirming.kind === 'startNew') {
              setConfirming(null);
              return onStartNew();
            }
            if (confirming.kind === 'unretire') return doUnretire(confirming.lineage.index);
            return undefined;
          }}
        />
      )}
    </div>
  );
}

/**
 * @param {{ confirming: any, corpsName: string, busy: boolean,
 *   onCancel: () => void, onConfirm: () => void }} props
 */
function ConfirmDialog({ confirming, corpsName, busy, onCancel, onConfirm }) {
  const { kind } = confirming;
  let title;
  let body;
  let confirmWord;
  if (kind === 'retire') {
    title = `Retire ${corpsName}?`;
    body =
      'The lineage — reputation, trophy case, and history — is preserved and can be brought back later. It just steps off the active roster this season.';
    confirmWord = 'Retire corps';
  } else if (kind === 'startNew') {
    title = 'Start a brand-new corps?';
    body =
      "Your current corps is banked and a NEW corps begins at square one — Community Corps, A Class. You'll build its reputation from scratch.";
    confirmWord = 'Start new corps';
  } else {
    // unretire
    const p = confirming.preview;
    title = `Bring back ${p.corpsName || 'this corps'}?`;
    body = (
      <span>
        After {p.missedSeasons} season{p.missedSeasons === 1 ? '' : 's'} away, it returns as{' '}
        <span className="text-secondary font-bold">{p.statusAfter.tierLabel}</span> in{' '}
        <span className="text-secondary font-bold">{p.statusAfter.divisionLabel}</span>
        {p.statusBefore.tierLabel !== p.statusAfter.tierLabel && (
          <span className="text-muted"> (was {p.statusBefore.tierLabel})</span>
        )}
        . Dormancy has been charged — a corps never returns stronger than it left.
      </span>
    );
    confirmWord = 'Bring it back';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface-card border border-line rounded-none p-5 max-w-sm w-full space-y-4">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <p className="text-xs text-muted">{body}</p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-xs text-muted px-3 py-2 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="text-xs font-bold text-black bg-interactive px-3 py-2 rounded-none hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1"
          >
            {busy && <Loader2 className="w-3 h-3 animate-spin" />}
            {confirmWord}
          </button>
        </div>
      </div>
    </div>
  );
}
