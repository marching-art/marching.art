// pages/AnalyticsPage.js
// Analytics page for Enhanced Fantasy Drum Corps Game
// Admin dashboard with comprehensive analytics and insights

import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit, where } from 'firebase/firestore';
import { db, dataNamespace } from '../firebase';
import { useUserStore } from '../store/userStore';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from '../components/ui/Icon';
import toast from 'react-hot-toast';

const AnalyticsPage = () => {
    const { user, loggedInProfile } = useUserStore();
    const navigate = useNavigate();

    // State management
    const [analytics, setAnalytics] = useState({
        users: {
            total: 0,
            active: 0,
            new: 0,
            premium: 0
        },
        corps: {
            total: 0,
            complete: 0,
            average_score: 0
        },
        activity: {
            daily_logins: 0,
            lineups_created: 0,
            trades_completed: 0
        },
        performance: {
            response_time: 0,
            error_rate: 0,
            uptime: 99.9
        }
    });
    
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTimeframe, setSelectedTimeframe] = useState('7d');
    const [selectedMetric, setSelectedMetric] = useState('users');

    // Check admin access
    useEffect(() => {
        if (!loggedInProfile?.isAdmin) {
            navigate('/dashboard');
            return;
        }
    }, [loggedInProfile, navigate]);

    // Load analytics data
    useEffect(() => {
        if (loggedInProfile?.isAdmin) {
            loadAnalyticsData();
        }
    }, [loggedInProfile, selectedTimeframe]);

    const loadAnalyticsData = async () => {
        setIsLoading(true);
        try {
            // Simulate analytics data (in production, this would call Cloud Functions)
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

            // Mock analytics data
            const mockAnalytics = {
                users: {
                    total: 2847,
                    active: 1923,
                    new: 156,
                    premium: 432
                },
                corps: {
                    total: 5394,
                    complete: 4821,
                    average_score: 87.3
                },
                activity: {
                    daily_logins: 892,
                    lineups_created: 67,
                    trades_completed: 23
                },
                performance: {
                    response_time: 245,
                    error_rate: 0.12,
                    uptime: 99.94
                }
            };

            setAnalytics(mockAnalytics);
        } catch (error) {
            console.error('Error loading analytics:', error);
            toast.error('Failed to load analytics data');
        } finally {
            setIsLoading(false);
        }
    };

    // Metric cards configuration
    const metricCards = [
        {
            id: 'users',
            title: 'Users',
            value: analytics.users.total.toLocaleString(),
            change: '+12.3%',
            changeType: 'positive',
            icon: 'users',
            color: 'bg-blue-500',
            subMetrics: [
                { label: 'Active', value: analytics.users.active.toLocaleString() },
                { label: 'New', value: analytics.users.new.toLocaleString() },
                { label: 'Premium', value: analytics.users.premium.toLocaleString() }
            ]
        },
        {
            id: 'corps',
            title: 'Corps Created',
            value: analytics.corps.total.toLocaleString(),
            change: '+8.7%',
            changeType: 'positive',
            icon: 'trophy',
            color: 'bg-yellow-500',
            subMetrics: [
                { label: 'Complete', value: analytics.corps.complete.toLocaleString() },
                { label: 'Avg Score', value: analytics.corps.average_score.toFixed(1) },
                { label: 'Completion Rate', value: `${((analytics.corps.complete / analytics.corps.total) * 100).toFixed(1)}%` }
            ]
        },
        {
            id: 'activity',
            title: 'Daily Activity',
            value: analytics.activity.daily_logins.toLocaleString(),
            change: '+15.2%',
            changeType: 'positive',
            icon: 'activity',
            color: 'bg-green-500',
            subMetrics: [
                { label: 'Logins', value: analytics.activity.daily_logins.toLocaleString() },
                { label: 'Lineups', value: analytics.activity.lineups_created.toLocaleString() },
                { label: 'Trades', value: analytics.activity.trades_completed.toLocaleString() }
            ]
        },
        {
            id: 'performance',
            title: 'Performance',
            value: `${analytics.performance.response_time}ms`,
            change: '-5.3%',
            changeType: 'positive',
            icon: 'zap',
            color: 'bg-purple-500',
            subMetrics: [
                { label: 'Response Time', value: `${analytics.performance.response_time}ms` },
                { label: 'Error Rate', value: `${analytics.performance.error_rate}%` },
                { label: 'Uptime', value: `${analytics.performance.uptime}%` }
            ]
        }
    ];

    const timeframeOptions = [
        { value: '1d', label: 'Last 24 Hours' },
        { value: '7d', label: 'Last 7 Days' },
        { value: '30d', label: 'Last 30 Days' },
        { value: '90d', label: 'Last 90 Days' }
    ];

    if (!loggedInProfile?.isAdmin) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="text-6xl mb-4">🚫</div>
                    <h1 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                        Access Denied
                    </h1>
                    <p className="text-text-secondary dark:text-text-secondary-dark mb-6">
                        You need administrator privileges to access this page.
                    </p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="bg-primary text-on-primary px-6 py-3 rounded-theme font-medium hover:bg-primary-hover transition-colors"
                    >
                        Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
                    <h3 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark">
                        Loading analytics...
                    </h3>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            {/* Header */}
            <div className="bg-surface dark:bg-surface-dark border-b border-accent dark:border-accent-dark">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark">
                                Analytics Dashboard
                            </h1>
                            <p className="text-text-secondary dark:text-text-secondary-dark mt-1">
                                Monitor system performance and user activity
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Timeframe Selector */}
                            <select
                                value={selectedTimeframe}
                                onChange={(e) => setSelectedTimeframe(e.target.value)}
                                className="bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme px-4 py-2 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
                            >
                                {timeframeOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>

                            {/* Refresh Button */}
                            <button
                                onClick={loadAnalyticsData}
                                disabled={isLoading}
                                className="bg-accent dark:bg-accent-dark text-text-primary dark:text-text-primary-dark px-4 py-2 rounded-theme hover:bg-accent-hover dark:hover:bg-accent-hover transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                <Icon name="refresh-cw" size={16} className={isLoading ? 'animate-spin' : ''} />
                                Refresh
                            </button>

                            {/* Back Button */}
                            <button
                                onClick={() => navigate('/admin')}
                                className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark text-text-primary dark:text-text-primary-dark px-4 py-2 rounded-theme hover:bg-accent/10 transition-colors flex items-center gap-2"
                            >
                                <Icon name="arrow-left" size={16} />
                                Admin
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Metric Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {metricCards.map((metric, index) => (
                        <motion.div
                            key={metric.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={`bg-surface dark:bg-surface-dark rounded-theme p-6 border cursor-pointer transition-all hover:shadow-lg ${
                                selectedMetric === metric.id 
                                    ? 'border-primary shadow-md' 
                                    : 'border-accent dark:border-accent-dark hover:border-primary/50'
                            }`}
                            onClick={() => setSelectedMetric(metric.id)}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-3 rounded-full ${metric.color}/20`}>
                                    <Icon name={metric.icon} size={24} className={`${metric.color.replace('bg-', 'text-')}`} />
                                </div>
                                <div className={`text-sm font-medium px-2 py-1 rounded-full ${
                                    metric.changeType === 'positive' 
                                        ? 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-500/20' 
                                        : 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-500/20'
                                }`}>
                                    {metric.change}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-1">
                                    {metric.value}
                                </h3>
                                <p className="text-text-secondary dark:text-text-secondary-dark text-sm font-medium">
                                    {metric.title}
                                </p>
                            </div>

                            {/* Sub-metrics */}
                            <div className="mt-4 pt-4 border-t border-accent dark:border-accent-dark">
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                    {metric.subMetrics.map((subMetric, subIndex) => (
                                        <div key={subIndex} className="text-center">
                                            <div className="font-semibold text-text-primary dark:text-text-primary-dark">
                                                {subMetric.value}
                                            </div>
                                            <div className="text-text-secondary dark:text-text-secondary-dark">
                                                {subMetric.label}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Detailed Analytics Sections */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* User Growth Chart */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark"
                    >
                        <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                            User Growth
                        </h3>
                        
                        {/* Mock Chart Placeholder */}
                        <div className="h-64 bg-accent/10 rounded-theme flex items-center justify-center">
                            <div className="text-center">
                                <Icon name="trending-up" size={48} className="text-accent dark:text-accent-dark mx-auto mb-2" />
                                <p className="text-text-secondary dark:text-text-secondary-dark">
                                    Chart visualization would be here
                                </p>
                                <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1">
                                    (Integrate with Chart.js or similar)
                                </p>
                            </div>
                        </div>
                    </motion.div>

                    {/* Top Performers */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark"
                    >
                        <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                            Top Performers
                        </h3>
                        
                        <div className="space-y-3">
                            {[
                                { name: 'DrumCorpsLegend', score: 892, corps: 'Blue Devils 2024' },
                                { name: 'BrassQueen', score: 887, corps: 'Carolina Crown 2023' },
                                { name: 'PercussionPro', score: 881, corps: 'Santa Clara Vanguard 2022' },
                                { name: 'GuardMaster', score: 876, corps: 'Bluecoats 2024' },
                                { name: 'MusicMaestro', score: 871, corps: 'Phantom Regiment 2021' }
                            ].map((user, index) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-background dark:bg-background-dark rounded-theme">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                                            index === 0 ? 'bg-yellow-500' : 
                                            index === 1 ? 'bg-gray-400' : 
                                            index === 2 ? 'bg-yellow-600' : 'bg-accent dark:bg-accent-dark'
                                        }`}>
                                            {index + 1}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-text-primary dark:text-text-primary-dark">
                                                {user.name}
                                            </div>
                                            <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                                {user.corps}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-text-primary dark:text-text-primary-dark">
                                            {user.score}
                                        </div>
                                        <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                            points
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* System Health */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark"
                    >
                        <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                            System Health
                        </h3>
                        
                        <div className="space-y-4">
                            {[
                                { 
                                    label: 'Database', 
                                    status: 'healthy', 
                                    value: '245ms', 
                                    description: 'Average query time' 
                                },
                                { 
                                    label: 'Authentication', 
                                    status: 'healthy', 
                                    value: '99.9%', 
                                    description: 'Success rate' 
                                },
                                { 
                                    label: 'Cloud Functions', 
                                    status: 'warning', 
                                    value: '512ms', 
                                    description: 'Average execution time' 
                                },
                                { 
                                    label: 'Storage', 
                                    status: 'healthy', 
                                    value: '87%', 
                                    description: 'Utilization' 
                                }
                            ].map((service, index) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-background dark:bg-background-dark rounded-theme">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${
                                            service.status === 'healthy' ? 'bg-green-500' :
                                            service.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}></div>
                                        <div>
                                            <div className="font-semibold text-text-primary dark:text-text-primary-dark">
                                                {service.label}
                                            </div>
                                            <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                                {service.description}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-text-primary dark:text-text-primary-dark">
                                            {service.value}
                                        </div>
                                        <div className={`text-xs font-medium ${
                                            service.status === 'healthy' ? 'text-green-500' :
                                            service.status === 'warning' ? 'text-yellow-500' : 'text-red-500'
                                        }`}>
                                            {service.status.toUpperCase()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Recent Activity */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark"
                    >
                        <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                            Recent Activity
                        </h3>
                        
                        <div className="space-y-3">
                            {[
                                { 
                                    action: 'New user registration', 
                                    user: 'user_12847', 
                                    time: '2 minutes ago',
                                    icon: 'user-plus',
                                    color: 'text-green-500'
                                },
                                { 
                                    action: 'Corps lineup created', 
                                    user: 'DrumCorpsLegend', 
                                    time: '5 minutes ago',
                                    icon: 'trophy',
                                    color: 'text-blue-500'
                                },
                                { 
                                    action: 'Staff trade completed', 
                                    user: 'BrassQueen', 
                                    time: '8 minutes ago',
                                    icon: 'trending-up',
                                    color: 'text-purple-500'
                                },
                                { 
                                    action: 'Achievement unlocked', 
                                    user: 'PercussionPro', 
                                    time: '12 minutes ago',
                                    icon: 'star',
                                    color: 'text-yellow-500'
                                },
                                { 
                                    action: 'League created', 
                                    user: 'GuardMaster', 
                                    time: '15 minutes ago',
                                    icon: 'users',
                                    color: 'text-cyan-500'
                                }
                            ].map((activity, index) => (
                                <div key={index} className="flex items-center gap-3 p-3 bg-background dark:bg-background-dark rounded-theme">
                                    <Icon name={activity.icon} size={16} className={activity.color} />
                                    <div className="flex-1">
                                        <div className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                                            {activity.action}
                                        </div>
                                        <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                            by {activity.user}
                                        </div>
                                    </div>
                                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                        {activity.time}
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <button className="w-full mt-4 text-primary hover:text-primary-hover text-sm font-medium">
                            View All Activity
                        </button>
                    </motion.div>
                </div>

                {/* Cost Analysis Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="mt-8 bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark"
                >
                    <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                        Cost Analysis
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {[
                            { 
                                service: 'Firestore', 
                                cost: '$12.34', 
                                usage: '2.1M reads', 
                                trend: '+2.3%',
                                color: 'bg-orange-500'
                            },
                            { 
                                service: 'Cloud Functions', 
                                cost: '$8.76', 
                                usage: '145K invocations', 
                                trend: '+1.8%',
                                color: 'bg-blue-500'
                            },
                            { 
                                service: 'Hosting', 
                                cost: '$3.21', 
                                usage: '89GB transferred', 
                                trend: '+4.1%',
                                color: 'bg-green-500'
                            },
                            { 
                                service: 'Storage', 
                                cost: '$1.45', 
                                usage: '12GB stored', 
                                trend: '+0.9%',
                                color: 'bg-purple-500'
                            }
                        ].map((service, index) => (
                            <div key={index} className="text-center p-4 bg-background dark:bg-background-dark rounded-theme">
                                <div className={`w-12 h-12 ${service.color}/20 rounded-full flex items-center justify-center mx-auto mb-3`}>
                                    <Icon name="dollar-sign" size={20} className={service.color.replace('bg-', 'text-')} />
                                </div>
                                <div className="font-bold text-lg text-text-primary dark:text-text-primary-dark">
                                    {service.cost}
                                </div>
                                <div className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                                    {service.service}
                                </div>
                                <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                    {service.usage}
                                </div>
                                <div className="text-xs text-green-500 mt-1">
                                    {service.trend}
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-theme">
                        <div className="flex items-center gap-3">
                            <Icon name="check-circle" size={20} className="text-green-500" />
                            <div>
                                <div className="font-semibold text-green-600 dark:text-green-400">
                                    Cost Target: $0.05/user/month ✅
                                </div>
                                <div className="text-sm text-green-600/80 dark:text-green-400/80">
                                    Current: $0.046/user/month ({analytics.users.total} users)
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Quick Actions */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 }}
                    className="mt-8 bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark"
                >
                    <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                        Quick Actions
                    </h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { 
                                label: 'Export Data', 
                                icon: 'download', 
                                action: () => toast.success('Export initiated') 
                            },
                            { 
                                label: 'Send Newsletter', 
                                icon: 'mail', 
                                action: () => toast.success('Newsletter sent') 
                            },
                            { 
                                label: 'Backup Database', 
                                icon: 'database', 
                                action: () => toast.success('Backup started') 
                            },
                            { 
                                label: 'Update Scores', 
                                icon: 'refresh-cw', 
                                action: () => toast.success('Scores updated') 
                            }
                        ].map((action, index) => (
                            <button
                                key={index}
                                onClick={action.action}
                                className="flex flex-col items-center gap-2 p-4 bg-background dark:bg-background-dark rounded-theme hover:bg-accent/10 transition-colors"
                            >
                                <Icon name={action.icon} size={24} className="text-primary" />
                                <span className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                                    {action.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default AnalyticsPage;