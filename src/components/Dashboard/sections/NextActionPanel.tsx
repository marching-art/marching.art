// =============================================================================
// NEXT ACTION PANEL — the mobile dashboard's opening line
// =============================================================================
// Mobile-only by design. On desktop the dashboard's 2/3 + 1/3 grid shows the
// scorecard, the Director's Report, the lineup, and the season panels at once,
// so a director reads their situation in a glance. Collapsed to one column
// that same content becomes a ten-panel scroll with no map, and the game turns
// into a hunt for the thing you were supposed to do.
//
// This card states that one thing, at the top, before anything else. What it
// says is decided by utils/nextAction, which ranks by what actually costs a
// director the game (an unfilled caption slot scores nothing at all, an
// unregistered week scores nothing at all) — this file only renders it.
//
// Design: data-core surface (docs/DESIGN_SYSTEM.md) — flat fills, square
// corners, 1px borders. Azure carries anything the director can act on; gold
// appears only for `reward`, which is the one tone that is a payoff.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Flag,
  Gift,
  Lock,
  Moon,
  Music,
  Palette,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { Heading } from '../../ui';
import { triggerHaptic } from '../../../hooks/useHaptic';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import type { NextAction, NextActionId, NextActionTone } from '../../../utils/nextAction';

const ICONS: Record<NextActionId, LucideIcon> = {
  register_corps: Trophy,
  season_complete: Flag,
  complete_lineup: Music,
  lineup_locked: Lock,
  register_shows: Calendar,
  claim_reward: Gift,
  set_concept: Palette,
  daily_report: ClipboardList,
  all_clear: CheckCircle2,
  // Podium (director sim)
  podium_rehearse: Activity,
  podium_rest: Moon,
  podium_plan: ClipboardList,
};

/**
 * Tone -> chrome. `blocked` and `reward` earn an accent frame because the
 * director is losing something by ignoring them; everything else sits in the
 * neutral chrome so the accent keeps its meaning.
 */
const TONES: Record<
  NextActionTone,
  { frame: string; header: string; icon: string; bar: string; button: string }
> = {
  blocked: {
    frame: 'border-interactive',
    header: 'bg-interactive/15 border-interactive/40',
    icon: 'text-interactive',
    bar: 'bg-interactive',
    button: 'bg-interactive hover:bg-interactive-hover active:bg-interactive-subtle text-white',
  },
  // Gold frames the card because a waiting reward is a payoff, but the button
  // stays azure: it navigates to the panel that owns the claim, and azure is
  // the color of things you can touch.
  reward: {
    frame: 'border-brand',
    header: 'bg-brand/15 border-brand/40',
    icon: 'text-brand',
    bar: 'bg-brand',
    button: 'bg-interactive hover:bg-interactive-hover active:bg-interactive-subtle text-white',
  },
  action: {
    frame: 'border-line-strong',
    header: 'bg-surface-raised border-line',
    icon: 'text-interactive',
    bar: 'bg-interactive',
    button: 'bg-interactive hover:bg-interactive-hover active:bg-interactive-subtle text-white',
  },
  routine: {
    frame: 'border-line-strong',
    header: 'bg-surface-raised border-line',
    icon: 'text-interactive',
    bar: 'bg-interactive',
    button: 'bg-interactive hover:bg-interactive-hover active:bg-interactive-subtle text-white',
  },
  waiting: {
    frame: 'border-line',
    header: 'bg-surface-raised border-line',
    icon: 'text-muted',
    bar: 'bg-line-strong',
    button:
      'bg-surface-raised hover:bg-line border border-line text-white active:bg-surface-elevated',
  },
};

export interface NextActionPanelProps {
  /** Resolved action, or null when there is nothing to say (e.g. Podium). */
  action: NextAction | null;
  onOpenLineup: () => void;
  onOpenConcept: () => void;
  onRegisterCorps: () => void;
  /**
   * How to bring a panel elsewhere on the page into view. The dashboard
   * supplies this because a target can live in a mobile zone that is currently
   * hidden, which has to be revealed before it can be scrolled to. Without it
   * the panel falls back to a plain scroll.
   */
  onRevealPanel?: (panelId: string) => void;
}

const NextActionPanel: React.FC<NextActionPanelProps> = ({
  action,
  onOpenLineup,
  onOpenConcept,
  onRegisterCorps,
  onRevealPanel,
}) => {
  const navigate = useNavigate();
  const { prefersReducedMotion } = useReducedMotion();

  if (!action) return null;

  const Icon = ICONS[action.id];
  const tone = TONES[action.tone];

  const handleAction = () => {
    const target = action.target;
    if (!target) return;
    triggerHaptic('light');

    switch (target.type) {
      case 'lineup':
        onOpenLineup();
        break;
      case 'concept':
        onOpenConcept();
        break;
      case 'register':
        onRegisterCorps();
        break;
      case 'route':
        navigate(target.to);
        break;
      case 'scroll': {
        // The claim lives on a panel further down this page — the panel owns
        // the server call, so the hero moves the director to it rather than
        // duplicating the mutation.
        if (onRevealPanel) {
          onRevealPanel(target.to);
          break;
        }
        const el = document.getElementById(target.to);
        el?.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'start',
        });
        break;
      }
    }
  };

  const pct = action.progress
    ? Math.min(100, Math.round((action.progress.done / action.progress.total) * 100))
    : null;

  return (
    <section
      // lg:hidden — desktop already answers this question spatially.
      className={`lg:hidden bg-surface-card border overflow-hidden ${tone.frame}`}
      aria-labelledby="next-action-title"
    >
      <div className={`px-4 py-2 border-b flex items-center justify-between ${tone.header}`}>
        <Heading level="eyebrow" as="p" className="flex items-center gap-2 text-secondary">
          <Icon className={`w-3.5 h-3.5 ${tone.icon}`} aria-hidden="true" />
          Next Up
        </Heading>
        {action.progress && (
          <span className="text-[10px] font-bold text-muted font-data tabular-nums">
            {action.progress.done} of {action.progress.total}
          </span>
        )}
      </div>

      {action.progress && (
        <div className="h-1 bg-surface-raised">
          <div
            className={`h-full transition-all duration-500 ${tone.bar}`}
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={action.progress.done}
            aria-valuemin={0}
            aria-valuemax={action.progress.total}
            aria-label={`${action.title} progress`}
          />
        </div>
      )}

      <div className="p-4">
        <Heading level="title" as="h2" id="next-action-title" className="text-white">
          {action.title}
        </Heading>
        <p className="mt-1 text-sm text-secondary leading-snug">{action.detail}</p>

        {action.cta && (
          <button
            type="button"
            onClick={handleAction}
            className={`mt-3 w-full min-h-touch px-4 text-sm font-bold uppercase tracking-wider transition-colors duration-150 press-feedback-strong ${tone.button}`}
          >
            {action.cta}
          </button>
        )}
      </div>
    </section>
  );
};

export default NextActionPanel;
