// src/pages/AchievementsPage.js
// Quick fix for missing AchievementsPage component

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import Icon from '../components/ui/Icon';

const AchievementsPage = () => {
    const navigate = useNavigate();
    const { loggedInProfile } = useUserStore();
    const [selectedCategory, setSelectedCategory] = useState('all');

    // Mock achievements data
    const mockAchievements = [
        {
            id: 'first_corps',
            title: 'First Formation',
            description: 'Create your first drum corps lineup',
            category: 'lineup',
            completed: true,
            xpReward: 100,
            unlockedAt: new Date('2024-01-15')
        },
        {
            id: 'complete_lineup',
            title: 'Full Ensemble',
            description: 'Fill all 8 caption positions in a lineup',
            category: 'lineup',
            completed: true,
            xpReward: 200,
            unlockedAt: new Date('2024-01-16')
        },
        {
            id: 'staff_specialist',
            title: 'Staff Specialist',
            description: 'Add your first Hall of Fame staff member',
            category: 'lineup',
            completed: false,
            xpReward: 300,
            progress: 0,
            target: 1
        },
        {
            id: 'high_scorer',
            title: 'High Scorer',
            description: 'Score 800+ points in a single week',
            category: 'scoring',
            completed: false,
            xpReward: 400,
            progress: 743,
            target: 800
        }
    ];

    const categories = [
        { id: 'all', label: 'All Achievements', icon: 'trophy' },
        { id: 'lineup', label: 'Lineup Building', icon: 'users' },
        { id: 'scoring', label: 'Scoring', icon: 'target' },
        { id: 'social', label: 'Social', icon: 'heart' },
        { id: 'trading', label: 'Trading', icon: 'trending-up' }
    ];

    const filteredAchievements = mockAchievements.filter(achievement => 
        selectedCategory === 'all' || achievement.category === selectedCategory
    );

    const completedCount = mockAchievements.filter(a => a.completed).length;
    const totalXP = mockAchievements.filter(a => a.completed).reduce((sum, a) => sum + a.xpReward, 0);

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            {/* Header */}
            <div className="bg-surface dark:bg-surface-dark border-b border-accent dark:border-accent-dark">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark">
                                Achievements
                            </h1>
                            <p className="text-text-secondary dark:text-text-secondary-dark mt-1">
                                Track your drum corps journey and unlock rewards
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <div className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                                    {completedCount}/{mockAchievements.length}
                                </div>
                                <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                    Completed • {totalXP} XP Earned
                                </div>
                            </div>

                            <button
                                onClick={() => navigate('/dashboard')}
                                className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark text-text-primary dark:text-text-primary-dark px-4 py-2 rounded-theme hover:bg-accent/10 transition-colors flex items-center gap-2"
                            >
                                <Icon name="arrow-left" size={16} />
                                Dashboard
                            </button>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4">
                        <div className="flex items-center gap-3">
                            <div className="flex-1 bg-accent/20 rounded-full h-3">
                                <div 
                                    className="bg-primary h-3 rounded-full transition-all duration-500"
                                    style={{ width: `${(completedCount / mockAchievements.length) * 100}%` }}
                                ></div>
                            </div>
                            <span className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                                {Math.round((completedCount / mockAchievements.length) * 100)}%
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Category Filters */}
                <div className="flex flex-wrap gap-2 mb-8">
                    {categories.map(category => {
                        const categoryCount = mockAchievements.filter(a => 
                            category.id === 'all' || a.category === category.id
                        ).length;
                        
                        return (
                            <button
                                key={category.id}
                                onClick={() => setSelectedCategory(category.id)}
                                className={`px-4 py-2 rounded-theme font-medium transition-colors flex items-center gap-2 ${
                                    selectedCategory === category.id
                                        ? 'bg-primary text-on-primary'
                                        : 'bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark border border-accent dark:border-accent-dark hover:bg-accent/10'
                                }`}
                            >
                                <Icon name={category.icon} size={16} />
                                <span>{category.label}</span>
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                    selectedCategory === category.id
                                        ? 'bg-on-primary/20 text-on-primary'
                                        : 'bg-accent dark:bg-accent-dark text-text-secondary dark:text-text-secondary-dark'
                                }`}>
                                    {categoryCount}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Achievements Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAchievements.map((achievement) => (
                        <div
                            key={achievement.id}
                            className={`bg-surface dark:bg-surface-dark rounded-theme p-6 border transition-all hover:shadow-lg ${
                                achievement.completed 
                                    ? 'border-green-500 shadow-md shadow-green-500/20' 
                                    : 'border-accent dark:border-accent-dark hover:border-primary/50'
                            }`}
                        >
                            {/* Achievement Icon */}
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                                achievement.completed 
                                    ? 'bg-green-500/20 border-2 border-green-500' 
                                    : 'bg-primary/20 border-2 border-primary'
                            }`}>
                                <Icon 
                                    name="trophy" 
                                    size={24} 
                                    className={achievement.completed ? 'text-green-500' : 'text-primary'} 
                                />
                            </div>

                            {/* Achievement Info */}
                            <div className="mb-4">
                                <h3 className="font-bold text-lg mb-2 text-text-primary dark:text-text-primary-dark">
                                    {achievement.title}
                                </h3>
                                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                    {achievement.description}
                                </p>
                            </div>

                            {/* Progress Bar (for in-progress achievements) */}
                            {!achievement.completed && achievement.progress !== undefined && (
                                <div className="mb-4">
                                    <div className="flex justify-between text-xs text-text-secondary dark:text-text-secondary-dark mb-1">
                                        <span>Progress</span>
                                        <span>{achievement.progress}/{achievement.target}</span>
                                    </div>
                                    <div className="w-full bg-accent/20 rounded-full h-2">
                                        <div 
                                            className="bg-primary h-2 rounded-full transition-all"
                                            style={{ width: `${Math.min((achievement.progress / achievement.target) * 100, 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}

                            {/* Completion Status */}
                            {achievement.completed && achievement.unlockedAt && (
                                <div className="mb-4 text-xs text-green-600 dark:text-green-400">
                                    ✅ Completed {achievement.unlockedAt.toLocaleDateString()}
                                </div>
                            )}

                            {/* Reward */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Icon name="star" size={16} className="text-yellow-500" />
                                    <span className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                                        {achievement.xpReward} XP
                                    </span>
                                </div>
                                
                                {achievement.completed && (
                                    <div className="text-green-500">
                                        <Icon name="check-circle" size={20} />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AchievementsPage;