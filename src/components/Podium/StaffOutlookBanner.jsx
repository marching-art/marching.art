// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// StaffOutlookBanner — the in-season heads-up that next season's staff payroll
// has outgrown what a director can fund (design §5.6). Staff salaries rise with
// tenure, and contracts only lapse at the season boundary; when the aged
// payroll can no longer fit the division commitment cap, the director WILL lose
// someone at re-registration unless they act first (release a staffer now, or
// retrain a pricey one down). Surfacing it mid-season — while there's still
// time — turns a silent lapse into a decision.
//
// It requires acknowledgement: dismissing records the exact payroll figure, so
// it stays gone until the number changes (a hire, a release, or next season's
// aging), then re-warns.

import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

export default function StaffOutlookBanner({ podium }) {
  const [dismissing, setDismissing] = useState(false);
  const outlook = podium.data?.staffOutlook;

  if (!outlook || !outlook.atRisk || outlook.acknowledged) return null;

  const acknowledge = async () => {
    setDismissing(true);
    try {
      await podium.acknowledgeStaffOutlook();
    } catch {
      setDismissing(false); // leave the banner up so they can retry
    }
  };

  return (
    <div className="bg-warning/10 border border-warning/40 rounded-none p-4 space-y-2">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-warning" />
        <div className="flex-1 space-y-1">
          <div className="text-xs font-bold text-warning uppercase tracking-wider">
            Payroll warning — you&apos;ll lose staff next season
          </div>
          <p className="text-[11px] text-secondary leading-relaxed">
            As your staff gain tenure their salaries rise. Next season your roster will cost{' '}
            <span className="font-bold text-white tabular-nums">{outlook.payroll} CC</span>, but{' '}
            {outlook.commitmentCap === 0 ? 'your division' : 'your division cap'} lets you commit at
            most{' '}
            <span className="font-bold text-white tabular-nums">{outlook.commitmentCap} CC</span> —
            a <span className="font-bold text-warning tabular-nums">{outlook.shortfall} CC</span>{' '}
            shortfall. When you re-register you&apos;ll have to release or retrain someone; saving
            CorpsCoin alone won&apos;t close the gap. Retrain a pricey staffer down or release a
            seat now to choose who stays on your terms.
          </p>
        </div>
      </div>
      <div className="flex justify-end">
        <button
          onClick={acknowledge}
          disabled={dismissing}
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-none border border-warning/40 text-warning hover:bg-warning/10 disabled:opacity-60 press-feedback"
        >
          {dismissing && <Loader2 className="w-3 h-3 animate-spin" />} I understand
        </button>
      </div>
    </div>
  );
}
