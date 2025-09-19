import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, limit, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useUserStore } from '../../store/userStore';

const ChatNotificationBadge = ({ leagueId, onNewMessage }) => {
    const { loggedInProfile } = useUserStore();
    const [unreadCount, setUnreadCount] = useState(0);
    const [lastReadTimestamp, setLastReadTimestamp] = useState(null);

    useEffect(() => {
        if (!leagueId || !loggedInProfile) return;

        // Get last read timestamp from localStorage
        const lastRead = localStorage.getItem(`chat_lastRead_${leagueId}_${loggedInProfile.userId}`);
        const lastReadTime = lastRead ? new Date(lastRead) : new Date();
        setLastReadTimestamp(lastReadTime);

        // Listen for new messages
        const chatRef = collection(db, `leagues/${leagueId}/chat`);
        const q = query(
            chatRef, 
            where('timestamp', '>', lastReadTime),
            orderBy('timestamp', 'desc'),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const newMessages = querySnapshot.docs.filter(doc => {
                const data = doc.data();
                return data.authorId !== loggedInProfile.userId; // Don't count own messages
            });
            
            setUnreadCount(newMessages.length);
            
            if (newMessages.length > 0 && onNewMessage) {
                onNewMessage(newMessages.length);
            }
        });

        return () => unsubscribe();
    }, [leagueId, loggedInProfile, onNewMessage]);

    const markAsRead = () => {
        if (leagueId && loggedInProfile) {
            localStorage.setItem(
                `chat_lastRead_${leagueId}_${loggedInProfile.userId}`, 
                new Date().toISOString()
            );
            setUnreadCount(0);
        }
    };

    return {
        unreadCount,
        markAsRead
    };
};

export default ChatNotificationBadge;