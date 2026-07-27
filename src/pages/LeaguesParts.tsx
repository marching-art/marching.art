// Standalone pieces of the Leagues page: the invite-code modal and the two
// empty states. Split out to keep the page under the ~700-line guidance in
// ARCHITECTURE.md — pure render, no data access.

import React from 'react';
import { Plus, Trophy, Users, X } from 'lucide-react';

import { useEscapeKey } from '../hooks/useEscapeKey';

// =============================================================================
// QUICK JOIN MODAL
// =============================================================================

export const QuickJoinModal = ({
  inviteCode,
  setInviteCode,
  onJoin,
  onClose,
  isJoining,
}: {
  inviteCode: string;
  setInviteCode: (code: string) => void;
  onJoin: () => void;
  onClose: () => void;
  isJoining?: boolean;
}) => {
  useEscapeKey(onClose);
  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Join league by invite code"
    >
      <div
        className="w-full sm:max-w-sm bg-surface-card border-t sm:border border-line rounded-none sm:rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle - mobile */}
        <div className="sm:hidden flex justify-center py-2">
          <div className="w-8 h-1 bg-charcoal-600 rounded-full" />
        </div>

        <div className="px-4 py-3 border-b border-line bg-surface-raised flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">
            Join by Code
          </span>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-muted hover:text-white min-w-touch min-h-touch flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onJoin();
          }}
          className="p-4 space-y-3"
        >
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="XXXXXXXX"
            className="w-full px-4 py-3 bg-background border border-line-strong text-center text-xl font-bold font-data text-white tracking-[0.3em] focus:outline-none focus:border-interactive placeholder:text-muted"
            maxLength={8}
            autoFocus
          />
          <button
            type="submit"
            disabled={isJoining || !inviteCode.trim()}
            className="w-full py-3 min-h-[44px] bg-interactive text-white font-bold text-sm hover:bg-interactive-hover disabled:opacity-50 transition-colors"
          >
            {isJoining ? 'Joining...' : 'Join League'}
          </button>
        </form>
      </div>
    </div>
  );
};

// =============================================================================
// EMPTY STATE COMPONENTS
// =============================================================================

export const EmptyMyLeagues = ({ onCreate }: { onCreate: () => void }) => (
  <div className="p-6 bg-surface-card border-2 border-dashed border-line text-center">
    <div className="w-12 h-12 bg-surface-raised border border-line rounded-none mx-auto mb-3 flex items-center justify-center">
      <Trophy className="w-6 h-6 text-muted" />
    </div>
    <h3 className="text-sm font-bold text-white mb-1">No Leagues Yet</h3>
    <p className="text-xs text-muted mb-4 max-w-[200px] mx-auto">
      Join a league to compete with other directors
    </p>
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={onCreate}
        className="px-4 py-2 text-xs font-bold text-white bg-interactive hover:bg-interactive-hover flex items-center gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" />
        Create League
      </button>
    </div>
  </div>
);

// Discovery only lists leagues with at least one director competing this
// season, so an empty grid usually means nobody has set their corps up yet
// rather than that no leagues exist — say so, or it reads as a bug.
export const EmptyDiscover = ({
  searchTerm,
  hasFilter,
}: {
  searchTerm?: string;
  hasFilter?: boolean;
}) => (
  <div className="col-span-2 p-6 bg-surface-card border-2 border-dashed border-line text-center">
    <Users className="w-8 h-8 text-muted mx-auto mb-2" />
    <p className="text-sm text-muted">
      {searchTerm || hasFilter
        ? 'No leagues match your search'
        : 'No leagues are competing yet this season'}
    </p>
    <p className="text-xs text-muted mt-1">
      {searchTerm || hasFilter
        ? 'Try a different search term or clear the filters'
        : 'Leagues appear here once a member registers a corps. Create one to get started!'}
    </p>
  </div>
);
