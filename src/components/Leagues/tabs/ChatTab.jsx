// ChatTab - League chat/messaging functionality
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
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
      className="card p-6"
    >
      <h2 className="text-xl md:text-2xl font-bold text-cream-100 mb-4 md:mb-6 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 md:w-6 md:h-6 text-purple-500" />
        League Chat
      </h2>

      <div className="space-y-4">
        {/* Messages */}
        <div className="h-64 md:h-96 overflow-y-auto space-y-3 p-4 bg-charcoal-900/50 rounded-lg">
          {messages.length === 0 ? (
            <EmptyState
              title="NO MESSAGES"
              subtitle="Start the conversation..."
            />
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                className={`p-3 rounded-lg ${
                  msg.userId === userProfile?.uid
                    ? 'bg-gold-500/20 ml-auto max-w-md'
                    : 'bg-cream-500/10 max-w-md'
                }`}
              >
                <p className="text-xs text-cream-500/60 mb-1">
                  Director {msg.userId.slice(0, 6)}
                </p>
                <p className="text-cream-100">{msg.message}</p>
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
            className="flex-1 px-4 py-3 bg-charcoal-900/50 border border-cream-500/20 rounded-lg text-cream-100 focus:outline-none focus:border-gold-500"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="btn-primary px-6"
          >
            Send
          </button>
        </form>
      </div>
    </motion.div>
  );
};

export default ChatTab;
