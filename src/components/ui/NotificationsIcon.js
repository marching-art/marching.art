import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useUserStore } from '../../store/userStore';
import Icon from './Icon';

const NotificationsIcon = () => {
    const { user, loggedInProfile } = useUserStore();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Early return if user is not authenticated
        if (!user || !user.uid) {
            console.log('NotificationsIcon: No authenticated user found');
            setNotifications([]);
            setUnreadCount(0);
            setError(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            console.log('NotificationsIcon: Setting up listener for user:', user.uid);
            
            // Set up real-time listener for user notifications
            const notificationsRef = collection(db, `artifacts/prod/users/${user.uid}/notifications`);
            const q = query(
                notificationsRef,
                orderBy('createdAt', 'desc'),
                limit(50)
            );

            const unsubscribe = onSnapshot(q, 
                (querySnapshot) => {
                    console.log('NotificationsIcon: Received notifications update');
                    
                    const notificationsList = [];
                    let unreadCounter = 0;

                    querySnapshot.forEach((doc) => {
                        const data = doc.data();
                        const notification = {
                            id: doc.id,
                            ...data,
                            createdAt: data.createdAt?.toDate?.() || new Date()
                        };
                        
                        notificationsList.push(notification);
                        
                        if (!notification.read) {
                            unreadCounter++;
                        }
                    });

                    setNotifications(notificationsList);
                    setUnreadCount(unreadCounter);
                    setIsLoading(false);
                    setError(null);
                },
                (error) => {
                    console.error('NotificationsIcon: Error loading notifications:', error);
                    setError('Failed to load notifications');
                    setIsLoading(false);
                    
                    // Set empty state on error
                    setNotifications([]);
                    setUnreadCount(0);
                }
            );

            return () => {
                console.log('NotificationsIcon: Cleaning up listener');
                unsubscribe();
            };

        } catch (error) {
            console.error('NotificationsIcon: Error setting up listener:', error);
            setError('Cannot load notifications: setup failed');
            setIsLoading(false);
            setNotifications([]);
            setUnreadCount(0);
        }

    }, [user]);

    const markAsRead = async (notificationId) => {
        if (!user || !notificationId) return;

        try {
            const notificationRef = doc(db, `artifacts/prod/users/${user.uid}/notifications`, notificationId);
            await updateDoc(notificationRef, {
                read: true,
                readAt: new Date()
            });
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        if (!user || notifications.length === 0) return;

        try {
            const unreadNotifications = notifications.filter(n => !n.read);
            const promises = unreadNotifications.map(notification => 
                updateDoc(
                    doc(db, `artifacts/prod/users/${user.uid}/notifications`, notification.id),
                    { read: true, readAt: new Date() }
                )
            );
            
            await Promise.all(promises);
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'league':
                return "M18 18.72c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5zm1.64-6.98c-.23 1.44-1.62 2.53-3.14 2.53s-2.91-1.09-3.14-2.53l1.86-1.86c.48-.48 1.28-.48 1.76 0l2.66 1.86z";
            case 'score':
                return "M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z";
            case 'show':
                return "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5";
            default:
                return "M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0";
        }
    };

    const formatTimeAgo = (date) => {
        if (!date) return '';
        
        const now = new Date();
        const diffInMinutes = Math.floor((now - date) / (1000 * 60));
        
        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}h ago`;
        
        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 7) return `${diffInDays}d ago`;
        
        return date.toLocaleDateString();
    };

    // Don't render anything if user is not authenticated
    if (!user) {
        return null;
    }

    return (
        <div className="relative">
            {/* Notification Bell */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-theme text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors"
                title="Notifications"
            >
                <Icon 
                    path="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" 
                    className="w-6 h-6" 
                />
                
                {/* Unread Badge */}
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Notifications Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme shadow-lg z-50 max-h-96 overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-accent dark:border-accent-dark">
                        <h3 className="font-semibold text-text-primary dark:text-text-primary-dark">
                            Notifications
                        </h3>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="text-xs text-primary dark:text-primary-dark hover:text-primary-dark dark:hover:text-primary transition-colors"
                                >
                                    Mark all read
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark transition-colors"
                            >
                                <Icon path="M6 18L18 6M6 6l12 12" className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center p-8">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary dark:border-primary-dark"></div>
                                <span className="ml-2 text-sm text-text-secondary dark:text-text-secondary-dark">
                                    Loading notifications...
                                </span>
                            </div>
                        ) : error ? (
                            <div className="p-4 text-center">
                                <Icon path="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" className="w-8 h-8 text-red-500 mx-auto mb-2" />
                                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-8 text-center">
                                <Icon path="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" className="w-12 h-12 text-text-secondary dark:text-text-secondary-dark mx-auto mb-3" />
                                <p className="text-text-secondary dark:text-text-secondary-dark text-sm">
                                    No notifications yet
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-accent dark:divide-accent-dark">
                                {notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className={`p-4 hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors cursor-pointer ${
                                            !notification.read ? 'bg-primary/5 dark:bg-primary-dark/5' : ''
                                        }`}
                                        onClick={() => markAsRead(notification.id)}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                                notification.type === 'league' ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' :
                                                notification.type === 'score' ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400' :
                                                notification.type === 'show' ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' :
                                                'bg-gray-100 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400'
                                            }`}>
                                                <Icon path={getNotificationIcon(notification.type)} className="w-4 h-4" />
                                            </div>
                                            
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm ${!notification.read ? 'font-semibold' : 'font-medium'} text-text-primary dark:text-text-primary-dark`}>
                                                    {notification.title}
                                                </p>
                                                {notification.message && (
                                                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1 line-clamp-2">
                                                        {notification.message}
                                                    </p>
                                                )}
                                                <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-2">
                                                    {formatTimeAgo(notification.createdAt)}
                                                </p>
                                            </div>
                                            
                                            {!notification.read && (
                                                <div className="w-2 h-2 bg-primary dark:bg-primary-dark rounded-full flex-shrink-0 mt-2"></div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationsIcon;