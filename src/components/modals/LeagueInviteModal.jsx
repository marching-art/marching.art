// =============================================================================
// LEAGUE INVITE MODAL
// =============================================================================
// Lets a commissioner invite another director to one of their leagues.

import React, { useEffect, useMemo, useState } from 'react';
import { X, Users, Check, AlertCircle } from 'lucide-react';
import Portal from '../Portal';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { inviteDirectorToLeague } from '../../firebase/functions';
import toast from 'react-hot-toast';

const LeagueInviteModal = ({ inviterUid, inviteeUid, inviteeName, onClose }) => {
  useEscapeKey(onClose);

  const [leagues, setLeagues] = useState([]);
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [selectedLeagueId, setSelectedLeagueId] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingLeagues(true);
      setError(null);
      try {
        const leaguesRef = collection(db, 'artifacts/marching-art/leagues');
        const q = query(leaguesRef, where('creatorId', '==', inviterUid));
        const snapshot = await getDocs(q);
        if (cancelled) return;
        const rows = snapshot.docs
          .map((d) => ({
            id: d.id,
            name: d.data().name || 'Unnamed League',
            members: d.data().members || [],
            maxMembers: d.data().maxMembers || 20,
          }))
          .map((l) => ({
            ...l,
            alreadyMember: l.members.includes(inviteeUid),
            isFull: l.members.length >= l.maxMembers,
          }));
        setLeagues(rows);
        const firstAvailable = rows.find((l) => !l.alreadyMember && !l.isFull);
        setSelectedLeagueId(firstAvailable?.id || '');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load your leagues');
      } finally {
        if (!cancelled) setLoadingLeagues(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [inviterUid, inviteeUid]);

  const availableLeagues = useMemo(
    () => leagues.filter((l) => !l.alreadyMember && !l.isFull),
    [leagues]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLeagueId) return;
    setSending(true);
    try {
      await inviteDirectorToLeague({
        leagueId: selectedLeagueId,
        inviteeUid,
        message: message.trim() || undefined,
      });
      toast.success(`Invitation sent to ${inviteeName || 'director'}`);
      onClose();
    } catch (err) {
      const msg = err?.message || 'Failed to send invitation';
      toast.error(msg);
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title-league-invite"
      >
        <div
          className="w-full sm:max-w-md bg-[#1a1a1a] border-t sm:border border-[#333] rounded-t-xl sm:rounded-sm max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sm:hidden flex justify-center py-2">
            <div className="w-8 h-1 bg-gray-600 rounded-full" />
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#222]">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#0057B8]" />
              <h2
                id="modal-title-league-invite"
                className="text-xs font-bold uppercase tracking-wider text-gray-300"
              >
                Invite {inviteeName || 'Director'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-gray-500 hover:text-white"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto scroll-momentum p-4 space-y-3">
              {loadingLeagues ? (
                <div className="text-center py-8">
                  <div className="w-6 h-6 border-2 border-[#0057B8] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-[11px] text-gray-500">Loading your leagues...</p>
                </div>
              ) : leagues.length === 0 ? (
                <div className="text-center py-6">
                  <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-400 mb-1">You don&apos;t commission any leagues yet</p>
                  <p className="text-[11px] text-gray-600">
                    Create a league to send invites.
                  </p>
                </div>
              ) : availableLeagues.length === 0 ? (
                <div className="text-center py-6">
                  <AlertCircle className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-400 mb-1">No leagues available</p>
                  <p className="text-[11px] text-gray-600">
                    {leagues.every((l) => l.alreadyMember)
                      ? 'This director is already a member of all your leagues.'
                      : 'All your leagues are full.'}
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      League
                    </label>
                    <div className="space-y-1">
                      {leagues.map((l) => {
                        const disabled = l.alreadyMember || l.isFull;
                        const selected = selectedLeagueId === l.id;
                        return (
                          <button
                            type="button"
                            key={l.id}
                            disabled={disabled}
                            onClick={() => setSelectedLeagueId(l.id)}
                            className={`w-full flex items-center justify-between px-3 py-2 border text-left transition-colors ${
                              selected
                                ? 'bg-[#0057B8]/15 border-[#0057B8]/40 text-white'
                                : disabled
                                  ? 'bg-[#0a0a0a] border-[#222] text-gray-600 cursor-not-allowed'
                                  : 'bg-[#0a0a0a] border-[#333] text-gray-300 hover:border-[#555] hover:text-white'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-bold truncate">{l.name}</div>
                              <div className="text-[10px] text-gray-500">
                                {l.members.length}/{l.maxMembers} members
                              </div>
                            </div>
                            {selected && <Check className="w-4 h-4 text-[#0057B8]" />}
                            {l.alreadyMember && !selected && (
                              <span className="text-[9px] text-gray-500 uppercase tracking-wider">
                                Already in
                              </span>
                            )}
                            {l.isFull && !l.alreadyMember && !selected && (
                              <span className="text-[9px] text-gray-500 uppercase tracking-wider">
                                Full
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Message (optional)
                      <span className="float-right text-gray-600 font-normal normal-case">
                        {message.length}/280
                      </span>
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value.slice(0, 280))}
                      rows={3}
                      placeholder="Why do you want them in your league?"
                      className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8] resize-none"
                    />
                  </div>
                </>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 p-2 text-[11px] text-red-400">
                  {error}
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-[#333] bg-[#111] flex justify-end gap-2 shrink-0 safe-area-bottom">
              <button
                type="button"
                onClick={onClose}
                disabled={sending}
                className="h-9 px-4 border border-[#333] text-gray-400 text-sm font-bold uppercase tracking-wider hover:border-[#444] hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending || !selectedLeagueId || availableLeagues.length === 0}
                className="h-9 px-4 bg-[#0057B8] text-white text-sm font-bold uppercase tracking-wider hover:bg-[#0066d6] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
};

export default LeagueInviteModal;
