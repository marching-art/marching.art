// @ts-nocheck -- presentational sheet; the switch list is typed in utils/podiumLineupSwitch
// =============================================================================
// PODIUM LINEUP SHEET
// =============================================================================
// What the "Lineup" tab (and any ?panel=lineup deep link) opens when the Podium
// tab is selected. Podium is a director simulation with no drafted lineup
// (classRegistry hasLineup:false), so the caption editor can't open onto it —
// it used to be a dead click. This chooser stands in:
//
//   - Rehearsal Planner — Podium's daily verb, the true lineup-equivalent.
//   - a fantasy lineup — for a director who also runs fantasy corps, a jump
//     straight into one of those caption editors (switching the active class).
//
// Ordering follows what the director still has to do: while today's rehearsal
// is unfinished, Rehearse leads and the fantasy lineups sit below; once the
// blocks are spent (or it's a rest day) the fantasy lineups lead and Rehearse
// drops to a secondary row. With no fantasy corps at all there is nothing to
// switch to, so it's just the planner.

import React from 'react';
import { Medal, Music, ArrowRight, AlertCircle } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { triggerHaptic } from '../../hooks/useHaptic';

// The Podium daily-verb CTA. `prominent` renders it as the lead action (brand
// fill); otherwise it's a quiet secondary row under the fantasy lineups.
function RehearseAction({ prominent, onClick }) {
  if (prominent) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center gap-3 px-4 py-3 min-h-touch bg-brand text-white text-left press-feedback-strong"
      >
        <Medal className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold uppercase tracking-wider">Rehearse today</span>
          <span className="block text-[11px] text-white/80 leading-snug">
            Podium runs on rehearsal, not a draft — spend today&apos;s blocks in the planner.
          </span>
        </span>
        <ArrowRight className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 min-h-touch border border-line text-secondary hover:text-white hover:border-line-strong text-left press-feedback"
    >
      <Medal className="w-4 h-4 flex-shrink-0 text-brand" aria-hidden="true" />
      <span className="flex-1 text-sm font-bold uppercase tracking-wider">
        Back to Rehearsal Planner
      </span>
      <ArrowRight className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
    </button>
  );
}

// One fantasy class the director can jump into. `lead` gives the first row the
// interactive (azure) fill when the fantasy lineups head the sheet.
function FantasyClassRow({ entry, lead, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 min-h-touch text-left press-feedback ${
        lead
          ? 'bg-interactive text-white'
          : 'border border-line text-secondary hover:text-white hover:border-line-strong'
      }`}
    >
      <Music
        className={`w-4 h-4 flex-shrink-0 ${lead ? '' : 'text-interactive'}`}
        aria-hidden="true"
      />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold truncate">{entry.corpsName}</span>
        <span className={`block text-[11px] ${lead ? 'text-white/80' : 'text-muted'}`}>
          {entry.label}
        </span>
      </span>
      {entry.incomplete && (
        <span
          className={`flex items-center gap-1 text-[10px] font-bold uppercase ${
            lead ? 'text-white' : 'text-warning'
          }`}
          title="Fewer than 8 captions — this lineup scores nothing until it's full"
        >
          <AlertCircle className="w-3 h-3" aria-hidden="true" /> Needs picks
        </span>
      )}
      <ArrowRight className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
    </button>
  );
}

export default function PodiumLineupSheet({
  isOpen,
  onClose,
  rehearsalIncomplete,
  fantasyClasses = [],
  onRehearse,
  onSwitchToClass,
}) {
  const hasFantasy = fantasyClasses.length > 0;
  // Rehearse leads whenever today's rehearsal is unfinished, or when there is
  // no fantasy lineup to offer instead.
  const rehearseLeads = rehearsalIncomplete || !hasFantasy;

  const handleRehearse = () => {
    triggerHaptic('medium');
    onRehearse?.();
  };
  const handleSwitch = (classId) => {
    triggerHaptic('medium');
    onSwitchToClass?.(classId);
  };

  const fantasySection = hasFantasy && (
    <div className="space-y-2">
      {!rehearseLeads ? (
        <p className="text-[11px] text-muted leading-snug px-1">
          Today&apos;s rehearsal is done. Manage a Fantasy Division lineup instead:
        </p>
      ) : (
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted px-1 pt-1">
          Or manage a Fantasy lineup
        </p>
      )}
      {fantasyClasses.map((entry, index) => (
        <FantasyClassRow
          key={entry.classId}
          entry={entry}
          lead={!rehearseLeads && index === 0}
          onClick={() => handleSwitch(entry.classId)}
        />
      ))}
    </div>
  );

  const rehearseSection = (
    <RehearseAction prominent={rehearseLeads} onClick={handleRehearse} />
  );

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Lineup" snapPoints={[70]}>
      <div className="px-4 py-4 space-y-4 overflow-y-auto">
        <p className="text-xs text-secondary leading-snug">
          You&apos;re in <span className="font-bold text-brand">Podium</span> — a director
          simulation with no drafted lineup.
        </p>
        {/* Lead action first, secondary below — order set by rehearseLeads. */}
        {rehearseLeads ? (
          <>
            {rehearseSection}
            {fantasySection}
          </>
        ) : (
          <>
            {fantasySection}
            {rehearseSection}
          </>
        )}
      </div>
    </BottomSheet>
  );
}
