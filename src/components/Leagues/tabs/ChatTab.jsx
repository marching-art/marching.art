// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// ChatTab - Dark-mode messenger styling
// Design System: #111 received bubbles, #0057B8 sent bubbles, Commissioner badge

import React, { useRef, useEffect, useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { MessageSquare, Clock, Crown, Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { deleteChatMessage } from '../../../api/leagues';

const ChatTab = ({
  league,
  messages,
  userProfile,
  memberProfiles,
  isCommissioner = false,
  hasMore = false,
  isLoadingMore = false,
  onLoadOlder,
  onMarkRead,
}) => {
  const messagesEndRef = useRef(null);
  const [deletingId, setDeletingId] = useState(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Looking at the conversation is what marks it read. The league card's
  // unread dot used to read `league.hasUnreadMessages` — a field nothing wrote.
  useEffect(() => {
    onMarkRead?.();
  }, [messages, onMarkRead]);

  // League chat had no moderation surface at all: no delete, no report, no
  // mute, while rendering verbatim messages to every member with no recourse.
  const handleDelete = async (message) => {
    if (!window.confirm('Delete this message?')) return;
    setDeletingId(message.id);
    try {
      await deleteChatMessage(league.id, message.id);
      toast.success('Message deleted.');
    } catch (error) {
      toast.error(error.message || 'Failed to delete message');
    } finally {
      setDeletingId(null);
    }
  };

  // Get display name
  const getDisplayName = (uid) => {
    if (uid === userProfile?.uid) return 'You';
    const profile = memberProfiles?.[uid];
    const name = profile?.displayName;
    if (name && name !== 'Director') return name;
    return profile?.username || name || `Director ${uid?.slice(0, 6)}`;
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return '';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Group messages by date
  const groupMessagesByDate = (msgs) => {
    const groups = [];
    let currentDate = null;

    msgs.forEach((msg) => {
      const msgDate = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt);
      const dateStr = msgDate.toDateString();

      if (dateStr !== currentDate) {
        currentDate = dateStr;
        groups.push({ type: 'date', date: msgDate });
      }
      groups.push({ type: 'message', ...msg });
    });

    return groups;
  };

  const formatDateSeparator = (date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full"
    >
      {/* Section Header */}
      <div className="px-4 py-3 border-b border-line bg-surface-raised">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-purple-500" />
            League Chat
          </h3>
          <span className="text-[10px] text-muted flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-none bg-green-500 animate-pulse" />
            {messages.length} messages
          </span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {/* Older history. The stream is the newest 50 and there was no way to
            reach anything behind it — a league that talks for a season lost
            its own history off the top of the window. */}
        {hasMore && messages.length > 0 && (
          <div className="flex justify-center pb-2">
            <button
              onClick={onLoadOlder}
              disabled={isLoadingMore}
              className="px-4 py-2 min-h-touch text-[10px] font-bold uppercase tracking-wider text-muted border border-line hover:border-line-strong hover:text-white disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isLoadingMore && <Loader2 className="w-3 h-3 animate-spin" />}
              {isLoadingMore ? 'Loading…' : 'Load earlier messages'}
            </button>
          </div>
        )}
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12">
            <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mb-3">
              <MessageSquare className="w-6 h-6 text-purple-500/50" />
            </div>
            <p className="text-sm text-muted">No messages yet</p>
            <p className="text-xs text-muted mt-1">Start the conversation!</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {groupedMessages.map((item, idx) => {
              if (item.type === 'date') {
                return (
                  <div key={`date-${idx}`} className="flex items-center justify-center my-3">
                    <div className="px-2.5 py-1 bg-surface-raised text-[10px] text-muted uppercase tracking-wider font-bold">
                      {formatDateSeparator(item.date)}
                    </div>
                  </div>
                );
              }

              const isOwn = item.userId === userProfile?.uid;
              const isCreator = item.userId === league?.creatorId;

              return (
                <m.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[280px] md:max-w-[320px] ${isOwn ? 'order-2' : ''}`}>
                    {/* Message Bubble */}
                    <div
                      className={`px-3 py-2 ${
                        isOwn
                          ? 'bg-interactive text-white'
                          : 'bg-surface-sunken border border-line text-white'
                      }`}
                    >
                      {/* Sender name (for received messages) */}
                      {!isOwn && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <p
                            className={`text-[11px] font-bold ${
                              isCreator ? 'text-secondary' : 'text-muted'
                            }`}
                          >
                            @{getDisplayName(item.userId)}
                          </p>
                          {isCreator && (
                            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-surface-raised border border-line text-secondary text-[9px] font-bold">
                              <Crown className="w-2 h-2" />
                              Commish
                            </span>
                          )}
                        </div>
                      )}

                      {/* Message text */}
                      <p className="text-sm break-words leading-relaxed">{item.message}</p>

                      {/* Timestamp */}
                      <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                        <Clock
                          className={`w-2.5 h-2.5 ${isOwn ? 'text-white/50' : 'text-muted'}`}
                        />
                        <span className={`text-[10px] ${isOwn ? 'text-white/50' : 'text-muted'}`}>
                          {formatTime(item.createdAt)}
                        </span>
                        {(isOwn || isCommissioner) && (
                          <button
                            onClick={() => handleDelete(item)}
                            disabled={deletingId === item.id}
                            aria-label="Delete message"
                            className={`ml-1 p-1 -m-1 transition-colors disabled:opacity-40 ${
                              isOwn
                                ? 'text-white/50 hover:text-white'
                                : 'text-muted hover:text-red-400'
                            }`}
                          >
                            {deletingId === item.id ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-2.5 h-2.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </m.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>
    </m.div>
  );
};

export default ChatTab;
