import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, limit } from 'firebase/firestore';
import { db, dataNamespace } from '../../firebase';
import { useUserStore } from '../../store/userStore';
import Icon from '../ui/Icon';

const LeagueChat = ({ leagueId, leagueName, leagueMembers }) => {
    const { loggedInProfile } = useUserStore();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [showAllMessages, setShowAllMessages] = useState(false);
    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);

    // Auto-scroll to bottom when new messages arrive
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (!leagueId) return;

        // Set up real-time listener for chat messages
        const chatRef = collection(db, `leagues/${leagueId}/chat`);
        const q = query(chatRef, orderBy('timestamp', 'asc'), limit(100));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const fetchedMessages = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                fetchedMessages.push({
                    id: doc.id,
                    ...data,
                    timestamp: data.timestamp?.toDate?.() || new Date()
                });
            });
            setMessages(fetchedMessages);
            setIsLoading(false);
            
            // Auto-scroll to bottom after messages load
            setTimeout(scrollToBottom, 100);
        }, (error) => {
            console.error("Error loading chat messages:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [leagueId]);

    // Get messages to display based on view mode
    const displayMessages = showAllMessages ? messages : messages.slice(-10);

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || isSending || !loggedInProfile) return;

        setIsSending(true);
        try {
            const chatRef = collection(db, `leagues/${leagueId}/chat`);
            await addDoc(chatRef, {
                message: newMessage.trim(),
                authorId: loggedInProfile.userId,
                authorUsername: loggedInProfile.username || 'Unknown Director',
                timestamp: serverTimestamp(),
                type: 'message' // Could expand for system messages, announcements, etc.
            });
            
            setNewMessage('');
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setIsSending(false);
        }
    };

    const formatTime = (timestamp) => {
        const now = new Date();
        const messageTime = new Date(timestamp);
        const diffInHours = (now - messageTime) / (1000 * 60 * 60);
        
        if (diffInHours < 1) {
            const diffInMinutes = Math.floor(diffInHours * 60);
            return diffInMinutes <= 1 ? 'just now' : `${diffInMinutes}m ago`;
        } else if (diffInHours < 24) {
            return `${Math.floor(diffInHours)}h ago`;
        } else {
            return messageTime.toLocaleDateString();
        }
    };

    const getMemberInfo = (authorId) => {
        return leagueMembers.find(member => member.id === authorId) || 
               { username: 'Unknown Director', totalScore: 0 };
    };

    const isConsecutiveMessage = (currentMessage, previousMessage) => {
        if (!previousMessage) return false;
        return currentMessage.authorId === previousMessage.authorId &&
               (new Date(currentMessage.timestamp) - new Date(previousMessage.timestamp)) < 300000; // 5 minutes
    };

    if (!loggedInProfile) {
        return (
            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
                <div className="text-center text-text-secondary dark:text-text-secondary-dark">
                    Please log in to access league chat
                </div>
            </div>
        );
    }

    return (
        <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark shadow-theme overflow-hidden">
            {/* Chat Header */}
            <div 
                className="p-4 border-b border-accent dark:border-accent-dark cursor-pointer hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Icon name="chat" className="h-5 w-5 text-primary dark:text-primary-dark" />
                        <div>
                            <h3 className="font-bold text-text-primary dark:text-text-primary-dark">
                                League Chat
                            </h3>
                            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                {messages.length} messages
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                            {leagueMembers.slice(0, 4).map((member, index) => (
                                <div
                                    key={member.id}
                                    className="w-6 h-6 bg-primary text-on-primary rounded-full flex items-center justify-center text-xs font-bold border-2 border-surface dark:border-surface-dark"
                                    title={member.username}
                                >
                                    {member.username.charAt(0).toUpperCase()}
                                </div>
                            ))}
                            {leagueMembers.length > 4 && (
                                <div className="w-6 h-6 bg-accent dark:bg-accent-dark text-text-primary dark:text-text-primary-dark rounded-full flex items-center justify-center text-xs font-bold border-2 border-surface dark:border-surface-dark">
                                    +{leagueMembers.length - 4}
                                </div>
                            )}
                        </div>
                        <Icon 
                            name={isExpanded ? "chevron-up" : "chevron-down"} 
                            className="h-4 w-4 text-text-secondary dark:text-text-secondary-dark" 
                        />
                    </div>
                </div>
            </div>

            {/* Chat Content */}
            {isExpanded && (
                <div className="flex flex-col h-96">
                    {/* Messages Container */}
                    <div 
                        ref={chatContainerRef}
                        className="flex-1 overflow-y-auto p-4 space-y-2 bg-background dark:bg-background-dark"
                    >
                        {isLoading ? (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary dark:border-primary-dark"></div>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="text-center py-8 text-text-secondary dark:text-text-secondary-dark">
                                <Icon name="chat" className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>No messages yet. Be the first to say something!</p>
                            </div>
                        ) : (
                            <>
                                {/* Load More Messages Button */}
                                {!showAllMessages && messages.length > 10 && (
                                    <div className="text-center py-2 border-b border-accent dark:border-accent-dark mb-4">
                                        <button
                                            onClick={() => setShowAllMessages(true)}
                                            className="text-sm text-primary dark:text-primary-dark hover:underline flex items-center gap-1 mx-auto"
                                        >
                                            <Icon name="chevron-up" className="h-3 w-3" />
                                            Load {messages.length - 10} earlier messages
                                        </button>
                                    </div>
                                )}

                                {/* Context Banner for New Users */}
                                {!showAllMessages && messages.length > 10 && (
                                    <div className="bg-accent dark:bg-accent-dark/20 p-2 rounded text-center mb-4">
                                        <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                            Showing last 10 messages for context • 
                                            <button 
                                                onClick={() => setShowAllMessages(true)}
                                                className="text-primary dark:text-primary-dark hover:underline ml-1"
                                            >
                                                View all {messages.length}
                                            </button>
                                        </p>
                                    </div>
                                )}

                                {displayMessages.map((message, index) => {
                                    const memberInfo = getMemberInfo(message.authorId);
                                    const isOwnMessage = message.authorId === loggedInProfile.userId;
                                    const isConsecutive = isConsecutiveMessage(message, displayMessages[index - 1]);
                                    
                                    return (
                                        <div 
                                            key={message.id}
                                            className={`flex gap-3 ${isConsecutive ? 'mt-1' : 'mt-4'}`}
                                        >
                                            {!isConsecutive && (
                                                <div className="w-8 h-8 bg-primary text-on-primary rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                                                    {message.authorUsername.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            {isConsecutive && <div className="w-8 flex-shrink-0"></div>}
                                            
                                            <div className="flex-1 min-w-0">
                                                {!isConsecutive && (
                                                    <div className="flex items-baseline gap-2 mb-1">
                                                        <span className={`font-bold text-sm ${
                                                            isOwnMessage ? 'text-primary dark:text-primary-dark' : 'text-text-primary dark:text-text-primary-dark'
                                                        }`}>
                                                            {message.authorUsername}
                                                            {isOwnMessage && <span className="text-xs ml-1">(You)</span>}
                                                        </span>
                                                        <span className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                                            {formatTime(message.timestamp)}
                                                        </span>
                                                        {memberInfo.totalScore > 0 && (
                                                            <span className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                                                • {memberInfo.totalScore.toFixed(0)} pts
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                <div className={`text-sm break-words ${
                                                    isOwnMessage ? 'text-text-primary dark:text-text-primary-dark' : 'text-text-primary dark:text-text-primary-dark'
                                                }`}>
                                                    {message.message}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Message Input */}
                    <div className="p-4 border-t border-accent dark:border-accent-dark bg-surface dark:bg-surface-dark">
                        <form onSubmit={sendMessage} className="flex gap-2">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder={`Message ${leagueName}...`}
                                disabled={isSending}
                                className="flex-1 px-3 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme text-text-primary dark:text-text-primary-dark placeholder-text-secondary dark:placeholder-text-secondary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50"
                                maxLength={500}
                            />
                            <button
                                type="submit"
                                disabled={!newMessage.trim() || isSending}
                                className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-on-primary font-bold rounded-theme transition-colors disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isSending ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-on-primary"></div>
                                ) : (
                                    <Icon name="send" className="h-4 w-4" />
                                )}
                            </button>
                        </form>
                        <div className="text-xs text-text-secondary dark:text-text-secondary-dark mt-2">
                            Press Enter to send • {500 - newMessage.length} characters remaining
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeagueChat;