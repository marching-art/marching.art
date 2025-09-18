import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import { db, dataNamespace } from '../../firebase';
import Icon from './Icon';
import NotificationsPanel from './NotificationsPanel';

const NotificationsIcon = ({ user, setPage, onViewLeague }) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    useEffect(() => {
    if (!user?.uid || !dataNamespace) {
        console.warn("Cannot load notifications: user or dataNamespace missing");
        return;
    }

    try {
        const notifsRef = collection(db, 'artifacts', dataNamespace, 'users', user.uid, 'notifications');
        const q = query(notifsRef, orderBy('timestamp', 'desc'));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const fetchedNotifs = [];
            let count = 0;
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                fetchedNotifs.push({ id: doc.id, ...data });
                if (!data.isRead) {
                    count++;
                }
            });
            setNotifications(fetchedNotifs);
            setUnreadCount(count);
        }, (error) => {
            console.error("Error loading notifications:", error);
            setNotifications([]);
            setUnreadCount(0);
        });

        return () => unsubscribe();
    } catch (error) {
        console.error("Error setting up notifications listener:", error);
        setNotifications([]);
        setUnreadCount(0);
    }
}, [user, dataNamespace]);

    const handleTogglePanel = () => {
        setIsPanelOpen(prev => !prev);
    };

    const handleMarkAsRead = async () => {
        if (!user?.uid || unreadCount === 0) return;

        const batch = writeBatch(db);
        notifications.forEach(notif => {
            if (!notif.isRead) {
                const notifRef = doc(db, `artifacts/${dataNamespace}/users/${user.uid}/notifications`, notif.id);
                batch.update(notifRef, { isRead: true });
            }
        });
        await batch.commit();
    };

    return (
        <div className="relative">
            <button 
                onClick={handleTogglePanel}
                className="relative p-2 rounded-theme text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark/20"
            >
                <Icon path="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-surface dark:ring-surface-dark"></span>
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
