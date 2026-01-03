// ChatTab - Dark-mode messenger styling
// Design System: #111 received bubbles, #0057B8 sent bubbles, Commissioner badge

import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Clock, Crown } from 'lucide-react';

const ChatTab = ({ league, messages, userProfile, memberProfiles, isCommissioner = false }) => {
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Get display name
  const getDisplayName = (uid) => {
    if (uid === userProfile?.uid) return 'You';
    const profile = memberProfiles?.[uid];
    return profile?.displayName || profile?.username || `Director ${uid?.slice(0, 6)}`;
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

    msgs.forEach(msg => {
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
      day: 'numeric'
    });
  };

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full"
    >
      {/* Section Header */}
      <div className="px-4 py-3 border-b border-[#333] bg-[#222]">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-purple-500" />
            League Chat
          </h3>
          <span className="text-[10px] text-gray-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            {messages.length} messages
          </span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12">
            <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mb-3">
              <MessageSquare className="w-6 h-6 text-purple-500/50" />
            </div>
            <p className="text-sm text-gray-400">No messages yet</p>
            <p className="text-xs text-gray-600 mt-1">Start the conversation!</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {groupedMessages.map((item, idx) => {
              if (item.type === 'date') {
                return (
                  <div
                    key={`date-${idx}`}
                    className="flex items-center justify-center my-3"
                  >
                    <div className="px-2.5 py-1 bg-[#222] text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                      {formatDateSeparator(item.date)}
                    </div>
                  </div>
                );
              }

              const isOwn = item.userId === userProfile?.uid;
              const isCreator = item.userId === league?.creatorId;

              return (
                <motion.div
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
                          ? 'bg-[#0057B8] text-white'
                          : 'bg-[#111] border border-[#333] text-white'
                      }`}
                    >
                      {/* Sender name (for received messages) */}
                      {!isOwn && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <p className={`text-[11px] font-bold ${
                            isCreator ? 'text-yellow-500' : 'text-gray-400'
                          }`}>
                            @{getDisplayName(item.userId)}
                          </p>
                          {isCreator && (
                            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-yellow-500/20 border border-yellow-500/30 text-yellow-500 text-[9px] font-bold">
                              <Crown className="w-2 h-2" />
                              Commish
                            </span>
                          )}
                        </div>
                      )}

                      {/* Message text */}
                      <p className="text-sm break-words leading-relaxed">
                        {item.message}
                      </p>

                      {/* Timestamp */}
                      <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                        <Clock className={`w-2.5 h-2.5 ${isOwn ? 'text-white/50' : 'text-gray-600'}`} />
                        <span className={`text-[10px] ${isOwn ? 'text-white/50' : 'text-gray-600'}`}>
                          {formatTime(item.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>
    </motion.div>
  );
};

export default ChatTab;
