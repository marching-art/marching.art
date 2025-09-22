// pages/NotificationsPage.js
// Notifications page for Enhanced Fantasy Drum Corps Game
// Displays user notifications and activity feed

import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, dataNamespace } from '../firebase';
import { useUserStore } from '../store/userStore';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../components/ui/Icon';
import toast from 'react-hot-toast';

const NotificationsPage = () => {
    const { user } = useUserStore();
    const navigate = useNavigate();

    // State management
    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedFilter, setSelectedFilter] = useState('all');
    const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

    // Load notifications on mount
    useEffect(() => {
        if (user) {
            loadNotifications();
        }
    }, [user]);

    const loadNotifications = async () => {
        if (!user) return;

        setIsLoading(true);
        try {
            const notificationsRef = collection(db, `artifacts/${dataNamespace}/users/${user.uid}/notifications`);
            const notificationsQuery = query(
                notificationsRef,
                orderBy('createdAt', 'desc'),
                limit(50)
            );

            const snapshot = await getDocs(notificationsQuery);
            const notificationData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setNotifications(notificationData);
        } catch (error) {
            console.error('Error loading notifications:', error);
            toast.error('Failed to load notifications');
        } finally {
            setIsLoading(false);
        }
    };

    // Mark notification as read
    const markAsRead = async (notificationId) => {
        if (!user) return;

        try {
            const notificationRef = doc(db, `artifacts/${dataNamespace}/users/${user.uid}/notifications/${notificationId}`);
            await updateDoc(notificationRef, {
                isRead: true,
                readAt: new Date()
            });

            setNotifications(prev => 
                prev.map(notification => 
                    notification.id === notificationId 
                        ? { ...notification, isRead: true, readAt: new Date() }
                        : notification
                )
            );
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    // Mark all notifications as read
    const markAllAsRead = async () => {
        if (!user) return;

        setIsMarkingAllRead(true);
        try {
            const unreadNotifications = notifications.filter(n => !n.isRead);
            
            await Promise.all(
                unreadNotifications.map(notification => {
                    const notificationRef = doc(db, `artifacts/${dataNamespace}/users/${user.uid}/notifications/${notification.id}`);
                    return updateDoc(notificationRef, {
                        isRead: true,
                        readAt: new Date()
                    });
                })
            );

            setNotifications(prev => 
                prev.map(notification => ({
                    ...notification,
                    isRead: true,
                    readAt: new Date()
                }))
            );

            toast.success('All notifications marked as read');
        } catch (error) {
            console.error('Error marking all as read:', error);
            toast.error('Failed to mark all as read');
        } finally {
            setIsMarkingAllRead(false);
        }
    };

    // Delete notification
    const deleteNotification = async (notificationId) => {
        if (!user) return;

        try {
            const notificationRef = doc(db, `artifacts/${dataNamespace}/users/${user.uid}/notifications/${notificationId}`);
            await deleteDoc(notificationRef);

            setNotifications(prev => prev.filter(n => n.id !== notificationId));
            toast.success('Notification deleted');
        } catch (error) {
            console.error('Error deleting notification:', error);
            toast.error('Failed to delete notification');
        }
    };

    // Filter notifications
    const filteredNotifications = notifications.filter(notification => {
        switch (selectedFilter) {
            case 'unread':
                return !notification.isRead;
            case 'achievements':
                return notification.type === 'achievement';
            case 'trades':
                return notification.type === 'trade';
            case 'leagues':
                return notification.type === 'league';
            default:
                return true;
        }
    });

    // Notification type icons and colors
    const getNotificationStyle = (type) => {
        const styles = {
            achievement: { icon: 'trophy', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
            trade: { icon: 'trending-up', color: 'text-green-500', bg: 'bg-green-500/10' },
            league: { icon: 'users', color: 'text-blue-500', bg: 'bg-blue-500/10' },
            system: { icon: 'info', color: 'text-gray-500', bg: 'bg-gray-500/10' },
            score: { icon: 'bar-chart', color: 'text-purple-500', bg: 'bg-purple-500/10' },
            social: { icon: 'message-circle', color: 'text-pink-500', bg: 'bg-pink-500/10' },
        };
        return styles[type] || styles.system;
    };

    // Format relative time
    const formatTime = (timestamp) => {
        const now = new Date();
        const time = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
        const diffInMinutes = Math.floor((now - time) / (1000 * 60));

        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
        if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d ago`;
        return time.toLocaleDateString();
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;
    const filterOptions = [
        { value: 'all', label: 'All', count: notifications.length },
        { value: 'unread', label: 'Unread', count: unreadCount },
        { value: 'achievements', label: 'Achievements', count: notifications.filter(n => n.type === 'achievement').length },
        { value: 'trades', label: 'Trades', count: notifications.filter(n => n.type === 'trade').length },
        { value: 'leagues', label: 'Leagues', count: notifications.filter(n => n.type === 'league').length },
    ];

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
                    <h3 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark">
                        Loading notifications...
                    </h3>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            {/* Header */}
            <div className="bg-surface dark:bg-surface-dark border-b border-accent dark:border-accent-dark">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div>
                                <h1 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark">
                                    Notifications
                                </h1>
                                <p className="text-text-secondary dark:text-text-secondary-dark mt-1">
                                    Stay updated with your drum corps activity
                                </p>
                            </div>
                            {unreadCount > 0 && (
                                <div className="bg-primary text-on-primary text-sm font-bold px-3 py-1 rounded-full">
                                    {unreadCount}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    disabled={isMarkingAllRead}
                                    className="bg-accent dark:bg-accent-dark text-text-primary dark:text-text-primary-dark px-4 py-2 rounded-theme hover:bg-accent-hover dark:hover:bg-accent-hover transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    <Icon name="check-check" size={16} />
                                    {isMarkingAllRead ? 'Marking...' : 'Mark All Read'}
                                </button>
                            )}
                            
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark text-text-primary dark:text-text-primary-dark px-4 py-2 rounded-theme hover:bg-accent/10 transition-colors flex items-center gap-2"
                            >
                                <Icon name="arrow-left" size={16} />
                                Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Filters */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {filterOptions.map(option => (
                        <button
                            key={option.value}
                            onClick={() => setSelectedFilter(option.value)}
                            className={`px-4 py-2 rounded-theme font-medium transition-colors flex items-center gap-2 ${
                                selectedFilter === option.value
                                    ? 'bg-primary text-on-primary'
                                    : 'bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark border border-accent dark:border-accent-dark hover:bg-accent/10'
                            }`}
                        >
                            <span>{option.label}</span>
                            {option.count > 0 && (
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                    selectedFilter === option.value
                                        ? 'bg-on-primary/20 text-on-primary'
                                        : 'bg-accent dark:bg-accent-dark text-text-secondary dark:text-text-secondary-dark'
                                }`}>
                                    {option.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Notifications List */}
                {filteredNotifications.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4">🔔</div>
                        <h3 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                            {selectedFilter === 'unread' ? 'No unread notifications' : 'No notifications'}
                        </h3>
                        <p className="text-text-secondary dark:text-text-secondary-dark">
                            {selectedFilter === 'unread' 
                                ? "You're all caught up! Check back later for updates."
                                : "When you have activity, notifications will appear here."
                            }
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <AnimatePresence>
                            {filteredNotifications.map((notification, index) => {
                                const style = getNotificationStyle(notification.type);
                                return (
                                    <motion.div
                                        key={notification.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        transition={{ delay: index * 0.05 }}
                                        className={`bg-surface dark:bg-surface-dark rounded-theme border transition-all hover:shadow-md ${
                                            notification.isRead 
                                                ? 'border-accent dark:border-accent-dark' 
                                                : 'border-primary/30 shadow-sm'
                                        }`}
                                    >
                                        <div className="p-4">
                                            <div className="flex items-start gap-4">
                                                {/* Notification Icon */}
                                                <div className={`p-2 rounded-full ${style.bg} flex-shrink-0`}>
                                                    <Icon name={style.icon} size={16} className={style.color} />
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <h4 className={`font-semibold ${
                                                                notification.isRead 
                                                                    ? 'text-text-secondary dark:text-text-secondary-dark' 
                                                                    : 'text-text-primary dark:text-text-primary-dark'
                                                            }`}>
                                                                {notification.title}
                                                            </h4>
                                                            <p className={`text-sm mt-1 ${
                                                                notification.isRead 
                                                                    ? 'text-text-secondary dark:text-text-secondary-dark' 
                                                                    : 'text-text-primary dark:text-text-primary-dark'
                                                            }`}>
                                                                {notification.message}
                                                            </p>
                                                            
                                                            {/* Action buttons if any */}
                                                            {notification.actionUrl && (
                                                                <button
                                                                    onClick={() => {
                                                                        markAsRead(notification.id);
                                                                        navigate(notification.actionUrl);
                                                                    }}
                                                                    className="text-primary hover:text-primary-hover text-sm font-medium mt-2 flex items-center gap-1"
                                                                >
                                                                    {notification.actionText || 'View'}
                                                                    <Icon name="external-link" size={12} />
                                                                </button>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-2 text-xs text-text-secondary dark:text-text-secondary-dark">
                                                            <span>{formatTime(notification.createdAt)}</span>
                                                            {!notification.isRead && (
                                                                <div className="w-2 h-2 bg-primary rounded-full"></div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center gap-1">
                                                    {!notification.isRead && (
                                                        <button
                                                            onClick={() => markAsRead(notification.id)}
                                                            className="p-2 text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark hover:bg-accent/10 rounded-theme transition-colors"
                                                            title="Mark as read"
                                                        >
                                                            <Icon name="check" size={16} />
                                                        </button>
                                                    )}
                                                    
                                                    <button
                                                        onClick={() => deleteNotification(notification.id)}
                                                        className="p-2 text-text-secondary dark:text-text-secondary-dark hover:text-red-500 hover:bg-red-500/10 rounded-theme transition-colors"
                                                        title="Delete notification"
                                                    >
                                                        <Icon name="trash-2" size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}

                {/* Load More (if needed) */}
                {filteredNotifications.length === 50 && (
                    <div className="text-center py-8">
                        <button 
                            onClick={loadNotifications}
                            className="bg-accent dark:bg-accent-dark text-text-primary dark:text-text-primary-dark px-6 py-3 rounded-theme hover:bg-accent-hover dark:hover:bg-accent-hover transition-colors"
                        >
                            Load More Notifications
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationsPage;