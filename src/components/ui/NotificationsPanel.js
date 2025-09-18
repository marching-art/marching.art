import React, { useEffect, useRef } from 'react';

const timeSince = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000; if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000; if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400; if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600; if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60; if (interval > 1) return Math.floor(interval) + "m ago";
    return Math.floor(seconds) + "s ago";
};

const NotificationsPanel = ({ notifications, onClose, onMarkAsRead, setPage, onViewLeague }) => {
    const panelRef = useRef(null);

    useEffect(() => {
        // Mark as read when the panel is opened
        onMarkAsRead();

        const handleClickOutside = (event) => {
            if (panelRef.current && !panelRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose, onMarkAsRead]);

    const handleNotificationClick = (notification) => {
        if (notification.link) {
            // This is a simplified router. For a link like "/leagues/xyz",
            // it extracts 'xyz' and calls the appropriate handler.
            if (notification.link.startsWith('/leagues/')) {
                const leagueId = notification.link.split('/')[2];
                onViewLeague(leagueId);
            } else {
                // Handle other link types if needed
            }
        }
        onClose();
    };

    return (
        <div ref={panelRef} className="absolute top-full right-0 mt-2 w-80 bg-surface dark:bg-surface-dark rounded-theme shadow-lg border border-accent dark:border-accent-dark z-20 overflow-hidden">
            <div className="p-3 border-b border-accent dark:border-accent-dark">
                <h3 className="font-semibold text-text-primary dark:text-text-primary-dark">Notifications</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
                {notifications.length > 0 ? (
                    notifications.map(notif => (
                        <button 
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={`w-full text-left p-3 flex items-start gap-3 transition-colors hover:bg-accent dark:hover:bg-accent-dark/20 ${!notif.isRead ? 'bg-primary/5 dark:bg-primary-dark/5' : ''}`}
                        >
                            {!notif.isRead && <div className="mt-1.5 w-2 h-2 rounded-full bg-primary flex-shrink-0"></div>}
                            <div className="flex-grow">
                                <p className="text-sm text-text-primary dark:text-text-primary-dark">{notif.message}</p>
                                <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1">{timeSince(notif.timestamp)}</p>
                            </div>
                        </button>
                    ))
                ) : (
                    <p className="p-4 text-center text-sm text-text-secondary dark:text-text-secondary-dark">You have no notifications.</p>
                )}
            </div>
        </div>
    );
};

export default NotificationsPanel;