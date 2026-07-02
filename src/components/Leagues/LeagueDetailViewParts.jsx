// Small helper components for LeagueDetailView: the inline smack-talk input
// and the leave-league confirmation modal. Extracted verbatim from
// LeagueDetailView.jsx.

import React, { useState, useEffect } from 'react';
import { m } from 'framer-motion';
import { Send, LogOut, AlertTriangle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { postLeagueMessage } from '../../firebase/functions';

// Quick Smack Talk Input - Compact inline form
export const SmackTalkInput = ({ leagueId, userProfile, disabled = false }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      await postLeagueMessage({ leagueId, message: message.trim() });
      setMessage('');
      toast.success('Sent!');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSend} className="flex gap-2">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Talk trash..."
        className="flex-1 h-9 px-3 bg-[#111] border border-[#333] text-white placeholder:text-gray-600 focus:outline-none focus:border-[#444] text-sm"
        disabled={sending || disabled}
        maxLength={200}
      />
      <button
        type="submit"
        disabled={sending || !message.trim() || disabled}
        className="h-9 px-3 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold flex items-center gap-1.5 transition-colors text-sm"
      >
        <Send className="w-3.5 h-3.5" />
      </button>
    </form>
  );
};

// Leave League Confirmation Modal
export const LeaveLeagueModal = ({ leagueName, onClose, onConfirm, isLoading }) => {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <m.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm bg-[#1a1a1a] border border-[#333]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#222]">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            Leave League
          </h2>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <div className="w-10 h-10 mx-auto mb-3 bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <LogOut className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-center mb-3">
            <p className="text-sm text-gray-400 mb-1">Are you sure?</p>
            <p className="text-base font-bold text-white">{leagueName}</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 p-2.5">
            <p className="text-[11px] text-red-400 text-center">
              You'll lose access to standings, matchups, and chat history.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#333] bg-[#222] flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="h-8 px-3 border border-[#333] text-gray-400 text-xs font-bold uppercase tracking-wider hover:border-[#444] hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="h-8 px-3 bg-red-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-red-500 disabled:opacity-50 flex items-center gap-1.5"
          >
            {isLoading ? 'Leaving...' : <><LogOut className="w-3.5 h-3.5" />Leave</>}
          </button>
        </div>
      </m.div>
    </div>
  );
};
