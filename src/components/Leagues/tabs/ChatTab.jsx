// ChatTab - Enhanced league chat with timestamps, reactions, and Commissioner badge
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, Heart, ThumbsUp, Flame, Trophy, Clock, Crown } from 'lucide-react';
import { postLeagueMessage } from '../../../firebase/functions';
import toast from 'react-hot-toast';

// Available reactions
const REACTIONS = [
  { id: 'like', emoji: '👍', icon: ThumbsUp },
  { id: 'heart', emoji: '❤️', icon: Heart },
  { id: 'fire', emoji: '🔥', icon: Flame },
  { id: 'trophy', emoji: '🏆', icon: Trophy }
];

const ChatTab = ({ league, messages, userProfile, memberProfiles, isCommissioner = false }) => {
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await postLeagueMessage({ leagueId: league.id, message: newMessage.trim() });
      setNewMessage('');
      inputRef.current?.focus();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleReaction = async (messageId, reactionId) => {
    // Reaction feature not implemented yet - UI ready for future
    toast.success(`${REACTIONS.find(r => r.id === reactionId)?.emoji} Coming soon!`);
    setShowReactionPicker(null);
  };

  // Helper to get display name
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

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  // Group messages by date for better readability
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
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  };

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="glass rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-cream-500/10">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-cream-100 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-400" />
            League Chat
          </h3>
          <span className="text-xs text-cream-500/40 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {messages.length} messages
          </span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="h-80 md:h-96 overflow-y-auto p-4 space-y-1">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-3">
              <MessageSquare className="w-8 h-8 text-purple-400/50" />
            </div>
            <p className="text-cream-500/60 font-display">No messages yet</p>
            <p className="text-xs text-cream-500/40 mt-1">Start the conversation!</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {groupedMessages.map((item, idx) => {
              if (item.type === 'date') {
                return (
                  <motion.div
                    key={`date-${idx}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-center my-4"
                  >
                    <div className="px-3 py-1 rounded-full bg-charcoal-900/50 text-xs text-cream-500/40">
                      {formatDateSeparator(item.date)}
                    </div>
                  </motion.div>
                );
              }

              const isOwn = item.userId === userProfile?.uid;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`group flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`relative max-w-xs md:max-w-sm ${isOwn ? 'order-2' : ''}`}>
                    {/* Message Bubble */}
                    <div
                      className={`px-4 py-2 rounded-2xl ${
                        isOwn
                          ? 'bg-purple-500/20 border border-purple-500/30 rounded-br-sm'
                          : item.userId === league?.creatorId
                            ? 'bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/30 rounded-bl-sm'
                            : 'bg-charcoal-800/50 border border-cream-500/10 rounded-bl-sm'
                      }`}
                    >
                      {/* Sender name (for other users) - with Commissioner badge */}
                      {!isOwn && (
                        <div className="flex items-center gap-2 mb-1">
                          <p className={`text-xs font-display font-semibold ${
                            item.userId === league?.creatorId ? 'text-yellow-400' : 'text-purple-400'
                          }`}>
                            @{getDisplayName(item.userId)}
                          </p>
                          {item.userId === league?.creatorId && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-yellow-500/30 to-amber-500/30 border border-yellow-500/50 text-yellow-400 text-[10px] font-display font-bold">
                              <Crown className="w-2.5 h-2.5" />
                              Commish
                            </span>
                          )}
                        </div>
                      )}

                      {/* Message text */}
                      <p className="text-cream-100 text-sm break-words">
                        {item.message}
                      </p>

                      {/* Timestamp */}
                      <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                        <Clock className="w-3 h-3 text-cream-500/30" />
                        <span className="text-xs text-cream-500/30">
                          {formatTime(item.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Reactions display */}
                    {item.reactions && Object.keys(item.reactions).length > 0 && (
                      <div className={`flex gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                        {Object.entries(item.reactions).map(([reaction, users]) => (
                          <span
                            key={reaction}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-charcoal-800/50 text-xs"
                          >
                            {REACTIONS.find(r => r.id === reaction)?.emoji || reaction}
                            <span className="text-cream-500/60">{users.length}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Reaction picker button */}
                    <button
                      onClick={() => setShowReactionPicker(showReactionPicker === item.id ? null : item.id)}
                      className={`absolute top-0 ${isOwn ? 'left-0 -translate-x-8' : 'right-0 translate-x-8'} opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full bg-charcoal-800/80 hover:bg-charcoal-700 text-cream-500/60 hover:text-cream-100`}
                    >
                      <span className="text-sm">😀</span>
                    </button>

                    {/* Reaction picker */}
                    {showReactionPicker === item.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className={`absolute ${isOwn ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'} top-0 z-10 flex gap-1 p-2 rounded-sm bg-[#1a1a1a] border border-[#333]`}
                      >
                        {REACTIONS.map(reaction => (
                          <button
                            key={reaction.id}
                            onClick={() => handleReaction(item.id, reaction.id)}
                            className="w-8 h-8 rounded-lg hover:bg-cream-500/10 flex items-center justify-center transition-colors text-lg"
                          >
                            {reaction.emoji}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-cream-500/10 bg-charcoal-900/30">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-3 bg-charcoal-800/50 border border-cream-500/10 rounded-xl text-cream-100 placeholder:text-cream-500/30 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all"
            disabled={sending}
            maxLength={500}
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-display font-semibold flex items-center gap-2 transition-colors"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>

        {/* Character count */}
        {newMessage.length > 400 && (
          <p className={`text-xs mt-1 text-right ${
            newMessage.length > 480 ? 'text-red-400' : 'text-cream-500/40'
          }`}>
            {newMessage.length}/500
          </p>
        )}
      </form>
    </motion.div>
  );
};

export default ChatTab;
