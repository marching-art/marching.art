// ChatTab - League chat/messaging functionality (Stadium HUD)
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Send } from 'lucide-react';
import { postLeagueMessage } from '../../../firebase/functions';
import toast from 'react-hot-toast';
import EmptyState from '../../EmptyState';

const ChatTab = ({ league, messages, userProfile }) => {
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await postLeagueMessage({ leagueId: league.id, message: newMessage });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6"
    >
      <h2 className="text-xl md:text-2xl font-display font-bold text-yellow-50 mb-4 md:mb-6 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 md:w-6 md:h-6 text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]" />
        League Chat
      </h2>

      <div className="space-y-4">
        {/* Messages */}
        <div className="h-64 md:h-96 overflow-y-auto space-y-3 p-4 bg-black/30 border border-white/5 rounded-xl">
          {messages.length === 0 ? (
            <EmptyState
              title="NO MESSAGES"
              subtitle="Start the conversation..."
            />
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                className={`p-3 rounded-xl ${
                  msg.userId === userProfile?.uid
                    ? 'bg-yellow-500/10 border border-yellow-500/20 ml-auto max-w-md'
                    : 'bg-white/5 border border-white/5 max-w-md'
                }`}
              >
                <p className="text-xs text-yellow-50/50 mb-1 font-display">
                  Director {msg.userId.slice(0, 6)}
                </p>
                <p className="text-yellow-50">{msg.message}</p>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-yellow-50 placeholder:text-yellow-50/30 focus:outline-none focus:border-yellow-500/30 focus:shadow-[0_0_15px_rgba(234,179,8,0.15)] transition-all"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="gold-ingot-btn px-6 flex items-center gap-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </form>
      </div>
    </motion.div>
  );
};

export default ChatTab;
