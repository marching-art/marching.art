// PodiumJourneyPanel — the Podium Rookie Journey (Phase 7.2). A one-time
// quest line through the daily loop: found, rehearse, delegate, route,
// perform, shake hands, survive. The server verifies each step against real
// state and pays XP + CorpsCoin once; this panel just claims. Hides itself
// once the line is complete.

import React, { useState } from 'react';
import { Map, Check, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { completeJourneyStep } from '../../api/functions';
import { useProfileStore } from '../../store/profileStore';
import { PODIUM_JOURNEY } from './podiumConstants';

export default function PodiumJourneyPanel() {
  const profile = useProfileStore((state) => state.profile);
  const [busy, setBusy] = useState(null);

  const journey = profile?.journey || {};
  const remaining = PODIUM_JOURNEY.filter((step) => !journey[step.id]);
  if (!profile || remaining.length === 0) return null;

  const claim = async (step) => {
    setBusy(step.id);
    try {
      const result = await completeJourneyStep({ stepId: step.id });
      if (result.data.alreadyCompleted) {
        toast(`${step.title} was already claimed.`);
      } else {
        toast.success(
          `${step.title}: +${result.data.xpAwarded} XP, +${result.data.coinAwarded} CC`
        );
      }
    } catch (err) {
      toast.error(err?.message || 'Not there yet.');
    } finally {
      setBusy(null);
    }
  };

  const doneCount = PODIUM_JOURNEY.length - remaining.length;

  return (
    <div className="bg-surface-card border border-line rounded-none p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
          <Map className="w-3 h-3" /> Rookie Journey
        </span>
        <span className="text-[10px] text-muted tabular-nums">
          {doneCount}/{PODIUM_JOURNEY.length}
        </span>
      </div>

      <div className="space-y-1">
        {PODIUM_JOURNEY.map((step) => {
          const done = Boolean(journey[step.id]);
          return (
            <div
              key={step.id}
              className={`flex items-center gap-2.5 px-2 py-1.5 rounded-none ${
                done ? 'opacity-50' : ''
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                  done ? 'bg-green-600 border-green-600' : 'border-line-strong'
                }`}
              >
                {done && <Check className="w-2.5 h-2.5 text-white" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className={`text-[11px] font-bold ${done ? 'text-muted' : 'text-white'}`}>
                  {step.title}
                </span>
                <span className="text-[10px] text-muted"> · {step.detail}</span>
              </span>
              {!done && (
                <button
                  disabled={busy !== null}
                  onClick={() => claim(step)}
                  className="flex-shrink-0 px-2 py-1 text-[9px] font-bold uppercase tracking-wider bg-surface-raised border border-line text-secondary rounded-none hover:border-interactive hover:text-white press-feedback disabled:opacity-50 tabular-nums"
                >
                  {busy === step.id ? (
                    <Loader2 className="w-3 h-3 animate-spin inline" />
                  ) : (
                    `+${step.xp} XP · ${step.coin} CC`
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
