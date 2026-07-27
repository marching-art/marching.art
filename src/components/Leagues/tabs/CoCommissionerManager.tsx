// CoCommissionerManager - share the job of running the league.
//
// Every commissioner gate used to be a bare `creatorId === uid`, which made a
// league a single point of failure: one director, who cannot be away, cannot
// share the work, and whose departure used to orphan the league outright. A
// league that runs for several seasons needs more than one pair of hands.
//
// Owner-only, deliberately (functions/src/helpers/leaguePermissions.js): a
// co-commissioner who could appoint or remove other co-commissioners could take
// the league over from the inside, which is the failure mode sharing the job is
// meant to avoid.

import React, { useState } from 'react';
import { Shield, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { setCoCommissioner } from '../../../api/functions';
import type { RosterMember } from './CommissionerTransfer';

interface CoCommissionerManagerProps {
  league?: { id?: string; commissioners?: string[] } | null;
  roster?: RosterMember[];
  onChanged?: () => void;
}

/** Matches MAX_CO_COMMISSIONERS in functions/src/helpers/leaguePermissions.js. */
const MAX_CO_COMMISSIONERS = 4;

const CoCommissionerManager = ({ league, roster = [], onChanged }: CoCommissionerManagerProps) => {
  const [pendingUid, setPendingUid] = useState<string | null>(null);

  const current = league?.commissioners || [];
  const candidates = roster.filter((m) => !m.isOwner);
  if (candidates.length === 0) return null;

  const atCap = current.length >= MAX_CO_COMMISSIONERS;

  const handleToggle = async (member: RosterMember, grant: boolean) => {
    if (!league?.id) return;
    setPendingUid(member.uid);
    try {
      const result = await setCoCommissioner({
        leagueId: league.id,
        memberId: member.uid,
        grant,
      });
      toast.success(result.data?.message || 'Commissioners updated.');
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update commissioners');
    } finally {
      setPendingUid(null);
    }
  };

  return (
    <div className="bg-surface-card border border-line">
      <div className="px-4 py-3 border-b border-line bg-surface-raised">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-secondary" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Co-Commissioners
            </span>
          </div>
          <span className="text-[10px] font-data tabular-nums text-muted">
            {current.length}/{MAX_CO_COMMISSIONERS}
          </span>
        </div>
      </div>

      <div className="px-4 py-2 bg-surface-sunken border-b border-line-subtle">
        <p className="text-[10px] text-muted">
          Co-commissioners can change settings, generate matchups, invite directors, manage the
          roster, and moderate chat. Only you can hand the league over or change this list.
        </p>
      </div>

      <div className="divide-y divide-line-subtle">
        {candidates.map((member) => {
          const isCo = current.includes(member.uid);
          const busy = pendingUid === member.uid;
          return (
            <div key={member.uid} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="block text-sm text-white truncate">{member.name}</span>
                <span className={`text-[10px] ${isCo ? 'text-secondary' : 'text-muted'}`}>
                  {isCo ? 'Co-commissioner' : 'Member'}
                </span>
              </div>
              <button
                onClick={() => handleToggle(member, !isCo)}
                disabled={busy || (!isCo && atCap)}
                title={!isCo && atCap ? `Limit is ${MAX_CO_COMMISSIONERS}` : undefined}
                className={`px-3 py-2 min-h-touch text-[10px] font-bold uppercase border transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 ${
                  isCo
                    ? 'text-red-400 border-red-500/30 hover:bg-red-500/10'
                    : 'text-secondary border-line-strong hover:border-secondary'
                }`}
              >
                {busy && <Loader2 className="w-3 h-3 animate-spin" />}
                {isCo ? 'Remove' : 'Promote'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CoCommissionerManager;
