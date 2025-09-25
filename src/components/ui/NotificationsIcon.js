// src/components/ui/NotificationsIcon.js - Fixed dataNamespace and error handling
import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import { db, dataNamespace } from '../../firebase';
import Icon from './Icon';
import NotificationsPanel from './NotificationsPanel';

const NotificationsIcon = ({ user, setPage, onViewLeague }) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        // Reset error state when user changes
        setHasError(false);
        
        if (!user?.uid) {
            console.warn("NotificationsIcon: No user provided");
            setNotifications([]);
            setUnreadCount(0);
            return;
        }

        // Check if dataNamespace is available
        const namespace = dataNamespace || process.env.REACT_APP_DATA_NAMESPACE || 'marching-art';
        
        if (!namespace) {
            console.error("NotificationsIcon: dataNamespace not configured. Please set REACT_APP_DATA_NAMESPACE in your environment variables.");
            setHasError(true);
            return;
        }

        try {
            const notifsRef = collection(db, 'artifacts', namespace, 'users', user.uid, 'notifications');
            const q = query(notifsRef, orderBy('timestamp', 'desc'));

            const unsubscribe = onSnapshot(q, (querySnapshot) => {
                try {
                    const fetchedNotifs = [];
                    let count = 0;
                    
                    querySnapshot.forEach((docSnap) => {
                        const data = docSnap.data();
                        if (data) {
                            fetchedNotifs.push({ 
                                id: docSnap.id, 
                                ...data,
                                // Ensure timestamp exists
                                timestamp: data.timestamp || new Date()
                            });
                            if (!data.isRead) {
                                count++;
                            }
                        }
                    });
                    
                    setNotifications(fetchedNotifs);
                    setUnreadCount(count);
                    setHasError(false);
                } catch (error) {
                    console.error("Error processing notifications:", error);
                    setHasError(true);
                }
            }, (error) => {
                console.error("Error loading notifications:", error);
                setNotifications([]);
                setUnreadCount(0);
                setHasError(true);
            });

            return () => {
                try {
                    unsubscribe();
                } catch (error) {
                    console.error("Error unsubscribing from notifications:", error);
                }
            };
        } catch (error) {
            console.error("Error setting up notifications listener:", error);
            setNotifications([]);
            setUnreadCount(0);
            setHasError(true);
        }
    }, [user?.uid]);

    const handleTogglePanel = () => {
        setIsPanelOpen(prev => !prev);
    };

    const handleMarkAsRead = async () => {
        if (!user?.uid || unreadCount === 0) return;

        const namespace = dataNamespace || process.env.REACT_APP_DATA_NAMESPACE || 'marching-art';
        
        try {
            const batch = writeBatch(db);
            
            notifications.forEach(notif => {
                if (!notif.isRead) {
                    const notifRef = doc(db, 'artifacts', namespace, 'users', user.uid, 'notifications', notif.id);
                    batch.update(notifRef, { isRead: true });
                }
            });
            
            await batch.commit();
        } catch (error) {
            console.error("Error marking notifications as read:", error);
        }
    };

    // Don't render if there's an error or no user
    if (hasError || !user?.uid) {
        return null;
    }

    return (
        <div className="relative">
            <button 
                onClick={handleTogglePanel}
                className="relative p-2 rounded-theme text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors"
                title="Notifications"
            >
                <Icon 
                    name="bell"
                    path="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                    className="w-5 h-5"
                />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 block h-4 w-4 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center ring-2 ring-surface dark:ring-surface-dark">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>
            
            {isPanelOpen && (
                <NotificationsPanel
                    notifications={notifications}
                    onClose={() => setIsPanelOpen(false)}
                    onMarkAsRead={handleMarkAsRead}
                    setPage={setPage}
                    onViewLeague={onViewLeague}
                />
            )}
        </div>
    );
};

export default NotificationsIcon;