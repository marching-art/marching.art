// =============================================================================
// ENCORE BANKING BANNER
// =============================================================================
// Encore banking (docs/EVENT_SCHEDULES_AND_SLOTS.md §5): if the director's own
// corps is the (projected) encore here, they can bank their once-per-season
// encore for a later show. Optimistic local state; the nightly encore pass
// reassigns to the next-closest corps once banked.
// Extracted from ShowRegistrationModal.jsx for file-size hygiene.

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { setEncoreDecline } from '../../api/functions';
import { useHaptic } from '../../hooks/useHaptic';

interface EncoreBankingBannerProps {
  show: {
    week: number;
    eventName: string;
    date?: string | null;
    encore?: { uid?: string; corps?: string; corpsClass: string } | null;
  };
  uid?: string | null;
}

const EncoreBankingBanner = ({ show, uid }: EncoreBankingBannerProps) => {
  const { trigger: haptic } = useHaptic();
  const [banked, setBanked] = useState(false);
  const [saving, setSaving] = useState(false);

  const myEncore = show.encore && uid && show.encore.uid === uid ? show.encore : null;
  if (!myEncore) return null;

  const toggle = async (declined: boolean) => {
    setSaving(true);
    try {
      await setEncoreDecline({
        week: show.week,
        eventName: show.eventName,
        date: show.date ?? null,
        corpsClass: myEncore.corpsClass,
        declined,
      });
      setBanked(declined);
      haptic('success');
      toast.success(
        declined ? 'Encore banked for a later show.' : 'Encore restored — this show is yours.'
      );
    } catch (err) {
      toast.error((err as Error)?.message || 'Could not update the encore.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-4 mt-3 p-3 bg-brand/10 border border-brand/30 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm text-white font-semibold truncate">
          {banked ? 'Encore banked' : `${myEncore.corps} is your encore`}
        </div>
        <div className="text-xs text-muted">
          {banked
            ? "You'll get your one encore at a later show."
            : 'One encore per season — bank it for a show that matters more.'}
        </div>
      </div>
      <button
        type="button"
        onClick={() => toggle(!banked)}
        disabled={saving}
        className="flex-shrink-0 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border border-brand/40 text-brand hover:bg-brand/10 disabled:opacity-50"
      >
        {banked ? 'Take it here' : 'Bank for later'}
      </button>
    </div>
  );
};

export default EncoreBankingBanner;
