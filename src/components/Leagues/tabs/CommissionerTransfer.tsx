// CommissionerTransfer - hand the league to another member.
//
// Every commissioner gate in the backend is `creatorId === uid`, so before this
// existed the only ways out of the job were to run it forever or to leave the
// league — and leaving removed the creator from `members` while leaving
// creatorId pointing at them, which permanently cost the league the ability to
// generate matchups, invite, remove members, or open its own settings.
//
// leaveLeague now auto-promotes a successor, but a deliberate handover should
// not require quitting your own league.

import React, { useState } from 'react';
import { Crown, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { transferCommissioner } from '../../../api/functions';
import { useEscapeKey } from '../../../hooks/useEscapeKey';

/** A roster row as SettingsTab builds it. */
export interface RosterMember {
  uid: string;
  name: string;
  corpsName: string | null;
  isActive: boolean;
  /** The single league owner. */
  isOwner: boolean;
  /** Owner or co-commissioner — anyone who can run the league day to day. */
  isCommissioner: boolean;
}

interface ConfirmProps {
  member: RosterMember;
  leagueName: string;
  onCancel: () => void;
  onConfirm: () => void;
  isTransferring: boolean;
}

interface CommissionerTransferProps {
  league?: { id?: string; name?: string } | null;
  roster?: RosterMember[];
  onTransferred?: () => void;
}

const ConfirmTransferModal = ({
  member,
  leagueName,
  onCancel,
  onConfirm,
  isTransferring,
}: ConfirmProps) => {
  useEscapeKey(onCancel);
  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm commissioner transfer"
    >
      <div
        className="w-full sm:max-w-sm bg-surface-card border-t sm:border border-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-line bg-surface-raised flex items-center gap-2">
          <Crown className="w-4 h-4 text-brand" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted">
            Transfer Commissioner
          </span>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-white">
            Make <span className="font-bold">{member.name}</span> commissioner of {leagueName}?
          </p>
          <ul className="text-xs text-muted space-y-1 list-disc pl-4">
            <li>They gain settings, matchup generation, invites, and roster control.</li>
            <li>You keep your place in the league, but lose those controls.</li>
            <li>Only they can hand it back.</li>
          </ul>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 py-3 min-h-touch text-sm font-bold text-muted border border-line-strong hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isTransferring}
              className="flex-1 py-3 min-h-touch text-sm font-bold text-white bg-interactive hover:bg-interactive-hover disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {isTransferring && <Loader2 className="w-4 h-4 animate-spin" />}
              Transfer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const CommissionerTransfer = ({
  league,
  roster = [],
  onTransferred,
}: CommissionerTransferProps) => {
  const [pending, setPending] = useState<RosterMember | null>(null);
  const [transferring, setTransferring] = useState(false);

  const candidates = roster.filter((m) => !m.isOwner);
  if (candidates.length === 0) return null;

  const handleTransfer = async () => {
    if (!pending || !league?.id) return;
    setTransferring(true);
    try {
      const result = await transferCommissioner({
        leagueId: league.id,
        newCommissionerUid: pending.uid,
      });
      toast.success(result.data?.message || `${pending.name} is now the commissioner.`);
      setPending(null);
      onTransferred?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to transfer the league');
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="bg-surface-card border border-line">
      <div className="px-4 py-3 border-b border-line bg-surface-raised">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-brand" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Hand Over The League
          </span>
        </div>
      </div>

      <div className="px-4 py-2 bg-surface-sunken border-b border-line-subtle">
        <p className="text-[10px] text-muted">
          Stepping back? Pick a successor rather than leaving — a league with no commissioner
          can&apos;t generate matchups, invite directors, or change its own settings.
        </p>
      </div>

      <div className="divide-y divide-line-subtle">
        {candidates.map((member) => (
          <div key={member.uid} className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="block text-sm text-white truncate">{member.name}</span>
              <span className={`text-[10px] ${member.isActive ? 'text-green-500' : 'text-muted'}`}>
                {member.isActive
                  ? `Competing${member.corpsName ? ` — ${member.corpsName}` : ''}`
                  : 'No corps registered this season'}
              </span>
            </div>
            <button
              onClick={() => setPending(member)}
              className="px-3 py-2 min-h-touch text-[10px] font-bold uppercase text-brand border border-line-strong hover:border-brand hover:bg-brand/10 transition-colors flex-shrink-0"
            >
              Make Commish
            </button>
          </div>
        ))}
      </div>

      {pending && (
        <ConfirmTransferModal
          member={pending}
          leagueName={league?.name || 'this league'}
          onCancel={() => setPending(null)}
          onConfirm={handleTransfer}
          isTransferring={transferring}
        />
      )}
    </div>
  );
};

export default CommissionerTransfer;
