// src/components/leagues/LeagueChat.js - Complete league chat component
import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, dataNamespace } from '../../firebase';
import { useUserStore } from '../../store/userStore';
import Icon from '../ui/Icon';

const LeagueChat = ({ 
    league, 
    currentUser, 
    members = [], 
    onViewProfile,
    // Legacy props for compatibility
    leagueId,
    leagueName,
    leagueMembers = []
}) => {
    const { loggedInProfile } = useUserStore();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState(null);

    // Use props or fallback to legacy props
    const activeLeague = league || { id: leagueId, name: leagueName };
    const activeUser = currentUser || loggedInProfile;
    const activeMembers = members.length > 0 ? members : leagueMembers || [];

    useEffect(() => {
        if (!activeLeague?.id) {
            setError('No league specified');
            setIsLoading(false);
            return;
        }

        const namespace = dataNamespace || 'marching-art';
        
        try {
            // Set up real-time listener for chat messages
            const messagesRef = collection(db, 'leagues', activeLeague.id, 'chat');
            const q = query(messagesRef, orderBy('timestamp', 'desc'));

            const unsubscribe = onSnapshot(q, (querySnapshot) => {
                try {
                    const fetchedMessages = [];
                    querySnapshot.forEach((doc) => {
                        const data = doc.data();
                        if (data) {
                            fetchedMessages.push({
                                id: doc.id,
                                ...data,
                                timestamp: data.timestamp || new Date()
                            });
                        }
                    });
                    
                    // Ensure messages is always an array before using slice
                    setMessages(fetchedMessages || []);
                    setIsLoading(false);
                    setError(null);
                } catch (processingError) {
                    console.error('Error processing chat messages:', processingError);
                    setMessages([]);
                    setIsLoading(false);
                    setError('Error loading messages');
                }
            }, (error) => {
                console.error('Error loading chat messages:', error);
                setMessages([]);
                setIsLoading(false);
                setError('Unable to load chat');
            });

            return () => unsubscribe();
        } catch (error) {
            console.error('Error setting up chat listener:', error);
            setMessages([]);
            setIsLoading(false);
            setError('Failed to initialize chat');
        }
    }, [activeLeague?.id]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        
        if (!newMessage.trim() || !activeUser?.userId || isSending) {
            return;
        }

        setIsSending(true);
        
        try {
            const messagesRef = collection(db, 'leagues', activeLeague.id, 'chat');
            
            await addDoc(messagesRef, {
                message: newMessage.trim(),
                authorId: activeUser.userId,
                authorName: activeUser.username || 'Anonymous',
                timestamp: serverTimestamp(),
                createdAt: new Date()
            });
            
            setNewMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
            setError('Failed to send message');
        } finally {
            setIsSending(false);
        }
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return '';
        
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffInHours = (now - date) / (1000 * 60 * 60);
        
        if (diffInHours < 24) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    };

    const getMemberInfo = (authorId) => {
        const member = activeMembers.find(m => m.id === authorId || m.userId === authorId);
        return member || { username: 'Unknown User', id: authorId };
    };

    if (error) {
        return (
            <div className="p-4 text-center">
                <Icon name="alert-triangle" className="h-8 w-8 text-red-500 mx-auto mb-2" />
                <p className="text-text-secondary dark:text-text-secondary-dark">{error}</p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="p-4 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary dark:border-primary-dark mx-auto mb-2"></div>
                <p className="text-text-secondary dark:text-text-secondary-dark">Loading chat...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-96">
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 p-4 bg-background dark:bg-background-dark rounded-t-theme">
                {messages && messages.length > 0 ? (
                    // Safely slice messages array - this fixes the error at line 136
                    messages.slice(0, 50).reverse().map((message) => {
                        const member = getMemberInfo(message.authorId);
                        const isCurrentUser = message.authorId === activeUser?.userId;
                        
                        return (
                            <div
                                key={message.id}
                                className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-xs lg:max-w-md px-3 py-2 rounded-theme ${
                                        isCurrentUser
                                            ? 'bg-primary text-on-primary'
                                            : 'bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark'
                                    }`}
                                >
                                    {!isCurrentUser && (
                                        <div className="text-xs text-text-secondary dark:text-text-secondary-dark mb-1">
                                            <button
                                                onClick={() => onViewProfile && onViewProfile(member.id)}
                                                className="hover:underline"
                                            >
                                                {member.username}
                                            </button>
                                        </div>
                                    )}
                                    <p className={`text-sm ${
                                        isCurrentUser 
                                            ? 'text-on-primary' 
                                            : 'text-text-primary dark:text-text-primary-dark'
                                    }`}>
                                        {message.message}
                                    </p>
                                    <p className={`text-xs mt-1 ${
                                        isCurrentUser 
                                            ? 'text-on-primary/70' 
                                            : 'text-text-secondary dark:text-text-secondary-dark'
                                    }`}>
                                        {formatTimestamp(message.timestamp)}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-8">
                        <Icon name="message-circle" className="h-12 w-12 text-text-secondary dark:text-text-secondary-dark mx-auto mb-2" />
                        <p className="text-text-secondary dark:text-text-secondary-dark">
                            No messages yet. Be the first to start the conversation!
                        </p>
                    </div>
                )}
            </div>
            
            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-4 bg-surface dark:bg-surface-dark rounded-b-theme border-t border-accent dark:border-accent-dark">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={activeUser?.userId ? "Type a message..." : "Please log in to chat"}
                        disabled={!activeUser?.userId || isSending}
                        className="flex-1 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme px-3 py-2 text-text-primary dark:text-text-primary-dark placeholder-text-secondary dark:placeholder-text-secondary-dark focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50"
                        maxLength={500}
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim() || !activeUser?.userId || isSending}
                        className="px-4 py-2 bg-primary text-on-primary rounded-theme hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isSending ? (
                            <Icon name="loader" className="h-4 w-4 animate-spin" />
                        ) : (
                            <Icon name="arrow-right" className="h-4 w-4" />
                        )}
                    </button>
                </div>
                <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1">
                    {newMessage.length}/500 characters
                </p>
            </form>
        </div>
    );
};

export default LeagueChat;