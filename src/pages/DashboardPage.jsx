import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import StatCard from '../components/modern/StatCard';
import CorpsCard from '../components/modern/CorpsCard';
import { getAllUserCorps, CORPS_CLASSES, CORPS_CLASS_ORDER } from '../utils/profileCompatibility';
import { hasJoinedSeason } from '../utils/profileCompatibility';

const ModernDashboard = ({ profile, userId, setPage }) => {
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [corpsData, setCorpsData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCorpsClass, setSelectedCorpsClass] = useState('worldClass');

    useEffect(() => {
        const seasonSettingsRef = doc(db, 'game-settings', 'season');
        
        const unsubscribe = onSnapshot(seasonSettingsRef, async (docSnap) => {
            if (docSnap.exists()) {
                const settings = { id: docSnap.id, ...docSnap.data() };
                setSeasonSettings(settings);

                if (settings.dataDocId) {
                    const corpsDataRef = doc(db, 'dci-data', settings.dataDocId);
                    const corpsDocSnap = await getDoc(corpsDataRef);
                    if (corpsDocSnap.exists()) {
                        setCorpsData(corpsDocSnap.data().corpsValues || []);
                    }
                }
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    if (isLoading || !seasonSettings) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="text-4xl mb-4">🎺</div>
                    <p className="text-lg font-semibold text-gradient">Loading...</p>
                </div>
            </div>
        );
    }

    const hasJoinedCurrentSeason = hasJoinedSeason(profile, seasonSettings.seasonUid);
    const userCorps = getAllUserCorps(profile);
    const totalPoints = Object.values(userCorps).reduce((sum, corps) => sum + (corps.totalSeasonScore || 0), 0);

    // Calculate rank (mock - would be real data)
    const userRank = 42; // Replace with real rank
    const totalUsers = 156; // Replace with real count

    // Get upcoming shows
    const upcomingShows = Object.values(userCorps)
        .flatMap(corps => Object.entries(corps.selectedShows || {}))
        .slice(0, 3);

    return (
        <div className="app-main custom-scrollbar max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2">
                    Welcome back, <span className="text-gradient">{profile.username}</span>
                </h1>
                <p className="text-base opacity-60">{seasonSettings.name}</p>
            </div>

            {/* Key Stats Grid */}
            <div className="grid-stats mb-8">
                <StatCard
                    label="Total Points"
                    value={totalPoints.toFixed(1)}
                    subtitle="Across all corps"
                    trend={12.5}
                    icon="🎯"
                    color="primary"
                />
                <StatCard
                    label="Rank"
                    value={`#${userRank}`}
                    subtitle={`of ${totalUsers} players`}
                    trend={-3}
                    icon="🏆"
                    color="success"
                />
                <StatCard
                    label="Teams Active"
                    value={Object.keys(userCorps).length}
                    subtitle={`${Object.keys(userCorps).length} corps entered`}
                    icon="🎺"
                    color="secondary"
                />
                <StatCard
                    label="Next Show"
                    value={upcomingShows.length > 0 ? `Day ${upcomingShows[0][0]}` : 'None'}
                    subtitle={upcomingShows.length > 0 ? upcomingShows[0][1].showName : 'No shows scheduled'}
                    icon="📅"
                    color="warning"
                    isLive={seasonSettings.status === 'live-season'}
                />
            </div>

            {/* Corps Class Selector */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {CORPS_CLASS_ORDER.map(key => {
                    const classInfo = CORPS_CLASSES[key];
                    const hasCorps = userCorps[key]?.corpsName;
                    
                    return (
                        <button
                            key={key}
                            onClick={() => setSelectedCorpsClass(key)}
                            className={`btn ${
                                selectedCorpsClass === key 
                                    ? 'btn-primary' 
                                    : 'btn-ghost'
                            } whitespace-nowrap`}
                        >
                            <span className={`w-2 h-2 rounded-full ${classInfo.color}`}></span>
                            {classInfo.name}
                            {hasCorps && <span className="badge badge-success text-xs">✓</span>}
                        </button>
                    );
                })}
            </div>

            {/* Main Content: Your Corps */}
            {userCorps[selectedCorpsClass] ? (
                <div className="space-y-6">
                    {/* Corps Overview Card */}
                    <div className="card-floating">
                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-bold mb-2">
                                    {userCorps[selectedCorpsClass].corpsName}
                                </h2>
                                <p className="text-sm opacity-60">
                                    {CORPS_CLASSES[selectedCorpsClass]?.name} • {userCorps[selectedCorpsClass].totalSeasonScore.toFixed(3)} points
                                </p>
                            </div>
                            <button 
                                onClick={() => setPage('profile', { userId })}
                                className="btn-ghost text-sm"
                            >
                                View Details →
                            </button>
                        </div>

                        {/* Quick Actions */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <button className="btn-primary">
                                <span>⚙️</span>
                                Manage Lineup
                            </button>
                            <button className="btn-ghost">
                                <span>📅</span>
                                Schedule
                            </button>
                            <button className="btn-ghost">
                                <span>📊</span>
                                Stats
                            </button>
                            <button className="btn-ghost">
                                <span>🔄</span>
                                Trade ({userCorps[selectedCorpsClass].weeklyTrades?.used || 0}/2)
                            </button>
                        </div>
                    </div>

                    {/* Lineup Preview */}
                    <div className="card">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold">Your Lineup</h3>
                            <span className="text-sm opacity-60">
                                {Object.keys(userCorps[selectedCorpsClass].lineup || {}).length} / 8 positions filled
                            </span>
                        </div>
                        
                        <div className="grid-roster">
                            {['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'].map(position => {
                                const corpsInSlot = userCorps[selectedCorpsClass].lineup?.[position];
                                const corpsInfo = corpsInSlot ? corpsData.find(c => c.corpsName === corpsInSlot) : null;
                                
                                return (
                                    <CorpsCard
                                        key={position}
                                        name={corpsInfo?.corpsName || 'Empty Slot'}
                                        points={corpsInfo?.points || 0}
                                        position={position}
                                        status={corpsInfo ? 'selected' : 'available'}
                                        compact
                                        onClick={() => console.log('Open lineup editor')}
                                    />
                                );
                            })}
                        </div>
                    </div>

                    {/* Upcoming Shows */}
                    {upcomingShows.length > 0 && (
                        <div className="card">
                            <h3 className="text-xl font-bold mb-4">Upcoming Shows</h3>
                            <div className="space-y-3">
                                {upcomingShows.map(([day, show]) => (
                                    <div 
                                        key={day}
                                        className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-gray-700 hover:border-purple-500 transition-all cursor-pointer"
                                    >
                                        <div>
                                            <div className="font-semibold mb-1">{show.showName}</div>
                                            <div className="text-xs opacity-60">Day {day}</div>
                                        </div>
                                        <span className="badge badge-primary">Scheduled</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="card-floating text-center py-12">
                    <div className="text-6xl mb-4">🎺</div>
                    <h3 className="text-2xl font-bold mb-2">Create Your {CORPS_CLASSES[selectedCorpsClass]?.name} Corps</h3>
                    <p className="text-sm opacity-60 mb-6 max-w-md mx-auto">
                        Build your fantasy corps and compete for the championship. Select your lineup and schedule shows to start earning points.
                    </p>
                    <button className="btn-primary text-lg px-8">
                        Get Started →
                    </button>
                </div>
            )}

            {/* League Preview */}
            <div className="card mt-8">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold">My Leagues</h3>
                    <button 
                        onClick={() => setPage('leagues')}
                        className="btn-ghost text-sm"
                    >
                        View All →
                    </button>
                </div>
                <div className="text-center py-8 opacity-60">
                    <p>Join or create a league to compete with friends</p>
                </div>
            </div>
        </div>
    );
};

export default ModernDashboard;
