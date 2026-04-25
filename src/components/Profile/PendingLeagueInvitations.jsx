// =============================================================================
// PENDING LEAGUE INVITATIONS
// =============================================================================
// Shows inbound league invitations on the user's own profile with
// Accept/Decline actions.

import React, { useEffect, useState } from 'react';
import { Users, Check, X, Calendar } from 'lucide-react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { respondToLeagueInvitation } from '../../firebase/functions';
import toast from 'react-hot-toast';

const PendingLeagueInvitations = ({ userId, onChange }) => {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState(null);

  const fetchInvitations = async () => {
    setLoading(true);
    try {
      const ref = collection(db, 'artifacts/marching-art/leagueInvitations');
      // Indexed composite query may require a Firestore index; fall back to a
      // simple where() and client-side sort to avoid requiring the index.
      const q = query(
        ref,
        where('inviteeUid', '==', userId),
        where('status', '==', 'pending')
      );
      const snapshot = await getDocs(q);
      const rows = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const aTime = a.invitedAt?.toMillis?.() || 0;
          const bTime = b.invitedAt?.toMillis?.() || 0;
          return bTime - aTime;
        });
      setInvitations(rows);
    } catch (err) {
      console.error('Failed to load invitations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    fetchInvitations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleRespond = async (invitation, accept) => {
    setRespondingId(invitation.id);
    try {
      await respondToLeagueInvitation({
        leagueId: invitation.leagueId,
        accept,
      });
      toast.success(accept ? `Joined ${invitation.leagueName}` : 'Invitation declined');
      // Optimistic remove
      setInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
      onChange?.();
    } catch (err) {
      toast.error(err?.message || 'Failed to respond');
    } finally {
      setRespondingId(null);
    }
  };

  if (loading) return null;
  if (invitations.length === 0) return null;

  return (
    <div className="px-3 pt-3">
      <div className="bg-[#1a1a1a] border border-[#0057B8]/40">
        <div className="px-3 py-2 border-b border-[#333] bg-[#0057B8]/10 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-[#0057B8]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#0057B8]">
            League Invitations
          </span>
          <span className="text-[9px] text-gray-500 ml-auto font-data tabular-nums">
            {invitations.length}
          </span>
        </div>
        <div className="divide-y divide-[#333]">
          {invitations.map((inv) => (
            <div key={inv.id} className="p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-white truncate">{inv.leagueName}</span>
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-2">
                  <span>from {inv.inviterName || 'A director'}</span>
                  {inv.invitedAt?.toDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {inv.invitedAt.toDate().toLocaleDateString()}
                    </span>
                  )}
                </div>
                {inv.message && (
                  <p className="text-[11px] text-gray-300 italic mt-1 whitespace-pre-wrap">
                    &ldquo;{inv.message}&rdquo;
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleRespond(inv, true)}
                  disabled={respondingId === inv.id}
                  className="flex items-center gap-1 px-2 py-1 bg-[#0057B8] text-white text-[10px] font-bold uppercase tracking-wider hover:bg-[#0066d6] disabled:opacity-50"
                  aria-label={`Accept invitation to ${inv.leagueName}`}
                >
                  <Check className="w-3 h-3" />
                  Accept
                </button>
                <button
                  onClick={() => handleRespond(inv, false)}
                  disabled={respondingId === inv.id}
                  className="flex items-center gap-1 px-2 py-1 border border-[#333] text-gray-400 text-[10px] font-bold uppercase tracking-wider hover:border-[#555] hover:text-white disabled:opacity-50"
                  aria-label={`Decline invitation to ${inv.leagueName}`}
                >
                  <X className="w-3 h-3" />
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PendingLeagueInvitations;
