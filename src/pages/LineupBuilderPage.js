// pages/LineupBuilderPage.js
// Enhanced Lineup Builder Page for Fantasy Drum Corps Game
// Optimized for ultimate user experience and scalability

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, dataNamespace } from '../firebase';
import { useUserStore } from '../store/userStore';
import { CORPS_CLASSES } from '../utils/profileCompatibility';
import LineupBuilder from '../components/LineupBuilder';
import LoadingScreen from '../components/ui/LoadingScreen';
import Icon from '../components/ui/Icon';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const LineupBuilderPage = () => {
    const { corpsClass = 'worldClass' } = useParams();
    const navigate = useNavigate();
    const { user, loggedInProfile } = useUserStore();
    
    // Core state
    const [corpsData, setCorpsData] = useState([]);
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [initialData, setInitialData] = useState(null);
    
    // UI state
    const [selectedView, setSelectedView] = useState('builder'); // 'builder', 'preview', 'analytics'
    const [showTutorial, setShowTutorial] = useState(false);

    // Validate corps class
    const isValidClass = CORPS_CLASSES.hasOwnProperty(corpsClass);
    const classDetails = CORPS_CLASSES[corpsClass] || CORPS_CLASSES.worldClass;

    // Premium features based on user level
    const premiumFeatures = useMemo(() => {
        const level = loggedInProfile?.level || 1;
        return {
            advancedAnalytics: level >= 5,
            staffTrading: level >= 3,
            multipleCorps: level >= 10,
            aiRecommendations: level >= 15,
            historicalSimulation: level >= 20
        };
    }, [loggedInProfile?.level]);

    // Load initial data
    useEffect(() => {
        const initializePage = async () => {
            if (!user || !isValidClass) {
                if (!isValidClass) {
                    navigate('/dashboard');
                    return;
                }
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                await Promise.all([
                    loadCorpsData(),
                    loadSeasonSettings(),
                    loadUserCorpsData()
                ]);
            } catch (err) {
                console.error('Error initializing lineup builder:', err);
                setError('Failed to load lineup builder. Please try again.');
                toast.error('Failed to load data');
            } finally {
                setIsLoading(false);
            }
        };

        initializePage();
    }, [user, corpsClass, isValidClass, navigate]);

    const loadCorpsData = async () => {
        try {
            const corpsRef = collection(db, `artifacts/${dataNamespace}/dci-data`);
            const corpsQuery = query(
                corpsRef,
                orderBy('totalScore', 'desc'),
                limit(500) // Limit for performance
            );
            
            const snapshot = await getDocs(corpsQuery);
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filter and optimize data for the specific class
            const filteredData = data.filter(corps => {
                const points = corps.points || corps.totalScore || 0;
                return points <= classDetails.pointCap && points > 0;
            }).sort((a, b) => (b.points || b.totalScore || 0) - (a.points || a.totalScore || 0));

            setCorpsData(filteredData);
        } catch (error) {
            console.error('Error loading corps data:', error);
            throw new Error('Failed to load corps data');
        }
    };

    const loadSeasonSettings = async () => {
        try {
            const settingsRef = doc(db, `artifacts/${dataNamespace}/settings/current-season`);
            const settingsDoc = await getDoc(settingsRef);
            
            if (settingsDoc.exists()) {
                setSeasonSettings(settingsDoc.data());
            } else {
                // Default season settings
                setSeasonSettings({
                    name: "2025 Fantasy Season",
                    isActive: true,
                    weeklyDeadlines: ["Saturday 12:00 PM EST"],
                    tradingEnabled: true
                });
            }
        } catch (error) {
            console.error('Error loading season settings:', error);
            // Continue with default settings
            setSeasonSettings({
                name: "2025 Fantasy Season",
                isActive: true,
                weeklyDeadlines: ["Saturday 12:00 PM EST"],
                tradingEnabled: true
            });
        }
    };

    const loadUserCorpsData = async () => {
        try {
            if (!loggedInProfile?.corps?.[corpsClass]) {
                setInitialData(null);
                return;
            }

            const userCorps = loggedInProfile.corps[corpsClass];
            setInitialData(userCorps);
        } catch (error) {
            console.error('Error loading user corps data:', error);
            setInitialData(null);
        }
    };

    const handleSaveSuccess = (savedCorpsClass, corpsName) => {
        toast.success(`🎉 ${corpsName} saved successfully!`);
        
        // Refresh user data
        loadUserCorpsData();
        
        // Navigate to dashboard after successful save
        setTimeout(() => {
            navigate('/dashboard');
        }, 2000);
    };

    const handleClassChange = (newClass) => {
        if (newClass !== corpsClass) {
            navigate(`/enhanced-lineup/${newClass}`);
        }
    };

    // Tutorial content for new users
    const tutorialSteps = [
        {
            title: "Welcome to Lineup Builder! 🎺",
            content: "Create your fantasy drum corps by selecting performances from each caption category. You have a point budget to work within."
        },
        {
            title: "Caption Selection 🎵",
            content: "Choose corps performances for all 8 captions: GE1, GE2, Visual Performance, Visual Analysis, Color Guard, Brass, Music Analysis, and Percussion."
        },
        {
            title: "Staff Bonuses ⭐",
            content: "Select Hall of Fame staff members to boost your corps' performance. Each staff member provides unique bonuses to specific captions."
        },
        {
            title: "Budget Management 💰",
            content: `Stay within your ${classDetails.pointCap} point budget. Higher-scoring performances cost more points but can earn more fantasy points.`
        }
    ];

    if (isLoading) {
        return <LoadingScreen message="Loading lineup builder..." />;
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <div className="text-6xl mb-4">🥁</div>
                    <h1 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                        Unable to Load Lineup Builder
                    </h1>
                    <p className="text-text-secondary dark:text-text-secondary-dark mb-6">
                        {error}
                    </p>
                    <div className="space-y-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full bg-primary text-on-primary px-6 py-3 rounded-theme font-medium hover:bg-primary-hover transition-colors"
                        >
                            Try Again
                        </button>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="w-full bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark px-6 py-3 rounded-theme font-medium border border-accent dark:border-accent-dark hover:bg-accent/10 transition-colors"
                        >
                            Return to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            {/* Header Section */}
            <div className="bg-surface dark:bg-surface-dark border-b border-accent dark:border-accent-dark">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark">
                                {initialData ? 'Edit' : 'Create'} {classDetails.name} Corps
                            </h1>
                            <p className="text-text-secondary dark:text-text-secondary-dark mt-1">
                                {initialData ? `Editing: ${initialData.corpsName}` : `Build your ${classDetails.name.toLowerCase()} fantasy corps`}
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Class Selector */}
                            <select
                                value={corpsClass}
                                onChange={(e) => handleClassChange(e.target.value)}
                                className="bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme px-4 py-2 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
                            >
                                {Object.entries(CORPS_CLASSES).map(([key, details]) => (
                                    <option key={key} value={key}>
                                        {details.name} ({details.pointCap} pts)
                                    </option>
                                ))}
                            </select>

                            {/* Tutorial Button */}
                            <button
                                onClick={() => setShowTutorial(true)}
                                className="bg-accent dark:bg-accent-dark text-text-primary dark:text-text-primary-dark px-4 py-2 rounded-theme hover:bg-accent-hover dark:hover:bg-accent-hover transition-colors flex items-center gap-2"
                            >
                                <Icon name="help-circle" size={16} />
                                Help
                            </button>

                            {/* Return to Dashboard */}
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark text-text-primary dark:text-text-primary-dark px-4 py-2 rounded-theme hover:bg-accent/10 transition-colors flex items-center gap-2"
                            >
                                <Icon name="arrow-left" size={16} />
                                Dashboard
                            </button>
                        </div>
                    </div>

                    {/* Premium Features Indicator */}
                    {loggedInProfile?.level >= 5 && (
                        <div className="mt-4 flex items-center gap-2 text-sm">
                            <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                                <Icon name="star" size={14} />
                                <span>Premium Features Unlocked:</span>
                            </div>
                            <div className="flex gap-3 text-text-secondary dark:text-text-secondary-dark">
                                {premiumFeatures.advancedAnalytics && <span>📊 Analytics</span>}
                                {premiumFeatures.staffTrading && <span>⚡ Staff Trading</span>}
                                {premiumFeatures.aiRecommendations && <span>🤖 AI Tips</span>}
                                {premiumFeatures.historicalSimulation && <span>📅 Historical Mode</span>}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Sidebar - Class Info & Tips */}
                    <div className="lg:col-span-3">
                        <div className="sticky top-4 space-y-6">
                            {/* Class Details Card */}
                            <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark">
                                <h3 className="font-bold text-text-primary dark:text-text-primary-dark mb-4">
                                    {classDetails.name} Rules
                                </h3>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-text-secondary dark:text-text-secondary-dark">Point Cap:</span>
                                        <span className="font-medium text-text-primary dark:text-text-primary-dark">{classDetails.pointCap}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-text-secondary dark:text-text-secondary-dark">Required Captions:</span>
                                        <span className="font-medium text-text-primary dark:text-text-primary-dark">8</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-text-secondary dark:text-text-secondary-dark">Staff Bonus:</span>
                                        <span className="font-medium text-green-500">±15%</span>
                                    </div>
                                </div>
                                
                                <div className="mt-4 pt-4 border-t border-accent dark:border-accent-dark">
                                    <h4 className="font-semibold text-text-primary dark:text-text-primary-dark mb-2">Strategy Tips</h4>
                                    <ul className="text-xs text-text-secondary dark:text-text-secondary-dark space-y-1">
                                        <li>• Balance high-scoring corps with budget constraints</li>
                                        <li>• Consider historical performance consistency</li>
                                        <li>• Staff bonuses can significantly impact final scores</li>
                                        <li>• Save budget for crucial captions like GE1 and GE2</li>
                                    </ul>
                                </div>
                            </div>

                            {/* Season Status */}
                            {seasonSettings && (
                                <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark">
                                    <h3 className="font-bold text-text-primary dark:text-text-primary-dark mb-3">
                                        Season Status
                                    </h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${seasonSettings.isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                            <span className="text-text-secondary dark:text-text-secondary-dark">
                                                {seasonSettings.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                        <div className="text-text-secondary dark:text-text-secondary-dark">
                                            {seasonSettings.name}
                                        </div>
                                        {seasonSettings.weeklyDeadlines && (
                                            <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                                Deadline: {seasonSettings.weeklyDeadlines[0]}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Main Lineup Builder */}
                    <div className="lg:col-span-9">
                        <LineupBuilder
                            corpsClass={corpsClass}
                            corpsData={corpsData}
                            seasonSettings={seasonSettings}
                            onSave={handleSaveSuccess}
                            initialData={initialData}
                        />
                    </div>
                </div>
            </div>

            {/* Tutorial Modal */}
            <AnimatePresence>
                {showTutorial && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
                        onClick={() => setShowTutorial(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-surface dark:bg-surface-dark rounded-theme p-8 max-w-2xl w-full border border-accent dark:border-accent-dark"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                                    How to Build Your Corps
                                </h2>
                                <button
                                    onClick={() => setShowTutorial(false)}
                                    className="text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark"
                                >
                                    <Icon name="x" size={24} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {tutorialSteps.map((step, index) => (
                                    <div key={index} className="flex gap-4">
                                        <div className="w-8 h-8 bg-primary text-on-primary rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                                            {index + 1}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                                                {step.title}
                                            </h3>
                                            <p className="text-text-secondary dark:text-text-secondary-dark text-sm">
                                                {step.content}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-8 flex justify-end">
                                <button
                                    onClick={() => setShowTutorial(false)}
                                    className="bg-primary text-on-primary px-6 py-3 rounded-theme font-medium hover:bg-primary-hover transition-colors"
                                >
                                    Let's Build! 🎺
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default LineupBuilderPage;