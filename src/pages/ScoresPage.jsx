import React, { useState, useEffect } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import { CORPS_CLASSES, CORPS_CLASS_ORDER } from '../utils/profileCompatibility';

const ModernScoresPage = () => {
    const [allRecaps, setAllRecaps] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [selectedDay, setSelectedDay] = useState(null);
    const [selectedCorpsClass, setSelectedCorpsClass] = useState('worldClass');
    const [isLoading, setIsLoading] = useState(true);
    const [expandedShow, setExpandedShow] = useState(null);

    useEffect(() => {
        const fetchRecaps = async () => {
            setIsLoading(true);
            try {
                const recapsQuery = query(collection(db, 'fantasy_recaps'));
                const querySnapshot = await getDocs(recapsQuery);
                const fetchedRecaps = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                if (fetchedRecaps.length > 0) {
                    fetchedRecaps.sort((a, b) => b.seasonName.localeCompare(a.seasonName));
                    setAllRecaps(fetchedRecaps);
                    const latestSeason = fetchedRecaps[0];
                    setSelectedSeason(latestSeason);
                    
                    if (latestSeason.recaps && latestSeason.recaps.length > 0) {
                        setSelectedDay(latestSeason.recaps[latestSeason.recaps.length - 1]);
                    }
                }
            } catch (error) {
                console.error("Error fetching recaps:", error);
            }
            setIsLoading(false);
        };
        fetchRecaps();
    }, []);

    if (isLoading) {
        return (
            <div className="app-main flex items-center justify-center">
                <div className="text-center">
                    <div className="text-6xl mb-4 animate-pulse">📊</div>
                    <p className="text-lg font-semibold text-gradient">Loading Scores...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="app-main custom-scrollbar max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-gradient mb-2">Live Scores</h1>
                <p className="text-base opacity-60">Track performance across all shows</p>
            </div>

            {/* Filters - Sticky Card */}
            <div className="card-floating mb-6 sticky top-4 z-10">
                <div className="grid md:grid-cols-3 gap-4">
                    {/* Season Selector */}
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-2 block">
                            Season
                        </label>
                        <select 
                            value={selectedSeason?.id || ''} 
                            onChange={(e) => {
                                const season = allRecaps.find(s => s.id === e.target.value);
                                setSelectedSeason(season);
                                if (season?.recaps?.length > 0) {
                                    setSelectedDay(season.recaps[season.recaps.length - 1]);
                                }
                            }}
                            className="w-full px-4 py-3 bg-slate-800 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                        >
                            {allRecaps.map(season => (
                                <option key={season.id} value={season.id}>
                                    {season.seasonName}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Day Selector */}
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-2 block">
                            Competition Day
                        </label>
                        {selectedSeason?.recaps && (
                            <select 
                                value={selectedSeason.recaps.indexOf(selectedDay)} 
                                onChange={(e) => {
                                    const dayIndex = parseInt(e.target.value);
                                    setSelectedDay(selectedSeason.recaps[dayIndex]);
                                }}
                                className="w-full px-4 py-3 bg-slate-800 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                            >
                                {selectedSeason.recaps.map((day, index) => (
                                    <option key={index} value={index}>
                                        Day {day.day} • {day.showsOnDay.length} shows
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Corps Class Filter */}
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-2 block">
                            Division
                        </label>
                        <div className="flex gap-2">
                            {CORPS_CLASS_ORDER.map(key => {
                                const classInfo = CORPS_CLASSES[key];
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setSelectedCorpsClass(key)}
                                        className={`flex-1 px-3 py-2 rounded-lg font-semibold text-xs transition-all ${
                                            selectedCorpsClass === key
                                                ? 'bg-purple-500 text-white'
                                                : 'bg-slate-800 text-gray-400 hover:text-white hover:bg-slate-700'
                                        }`}
                                    >
                                        <div className={`w-2 h-2 rounded-full ${classInfo.color} inline-block mr-1`}></div>
                                        {classInfo.name.replace(' Class', '')}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Shows Grid */}
            {selectedDay?.showsOnDay ? (
                <div className="space-y-4">
                    {selectedDay.showsOnDay.map((show, idx) => {
                        const filteredResults = show.results
                            .filter(res => res.corpsClass === selectedCorpsClass || !res.corpsClass)
                            .sort((a, b) => b.totalScore - a.totalScore);

                        if (filteredResults.length === 0) return null;

                        const isExpanded = expandedShow === idx;
                        const topThree = filteredResults.slice(0, 3);

                        return (
                            <div 
                                key={idx} 
                                className="card hover:shadow-xl transition-all cursor-pointer"
                                onClick={() => setExpandedShow(isExpanded ? null : idx)}
                            >
                                {/* Show Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h3 className="text-xl font-bold mb-1">
                                            {show.showName}
                                        </h3>
                                        <p className="text-sm opacity-60">
                                            {filteredResults.length} corps competing
                                        </p>
                                    </div>
                                    <span className="badge badge-primary">
                                        Day {selectedDay.day}
                                    </span>
                                </div>

                                {/* Top 3 Podium */}
                                {!isExpanded && (
                                    <div className="grid grid-cols-3 gap-3 mb-3">
                                        {topThree.map((corps, position) => (
                                            <div 
                                                key={corps.uid || corps.id}
                                                className="text-center p-3 bg-slate-800/50 rounded-lg border border-gray-700"
                                            >
                                                <div className="text-2xl mb-1">
                                                    {position === 0 ? '🥇' : position === 1 ? '🥈' : '🥉'}
                                                </div>
                                                <div className="font-bold text-sm mb-1 truncate">
                                                    {corps.corpsName}
                                                </div>
                                                <div className="text-lg font-bold text-gradient">
                                                    {corps.totalScore.toFixed(3)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Expanded Full Results */}
                                {isExpanded && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-gray-700">
                                                    <th className="p-3 text-left font-semibold opacity-60 w-12">#</th>
                                                    <th className="p-3 text-left font-semibold opacity-60">Corps</th>
                                                    <th className="p-3 text-right font-semibold opacity-60">GE</th>
                                                    <th className="p-3 text-right font-semibold opacity-60">Visual</th>
                                                    <th className="p-3 text-right font-semibold opacity-60">Music</th>
                                                    <th className="p-3 text-right font-semibold opacity-60">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredResults.map((res, i) => (
                                                    <tr 
                                                        key={res.uid || res.id} 
                                                        className="border-b border-gray-800 hover:bg-slate-800/50 transition-colors"
                                                    >
                                                        <td className="p-3 font-bold">
                                                            {i + 1}
                                                            {i < 3 && <span className="ml-1">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>}
                                                        </td>
                                                        <td className="p-3 font-semibold">
                                                            {res.corpsName}
                                                        </td>
                                                        <td className="p-3 text-right opacity-60">{res.geScore.toFixed(3)}</td>
                                                        <td className="p-3 text-right opacity-60">{res.visualScore.toFixed(3)}</td>
                                                        <td className="p-3 text-right opacity-60">{res.musicScore.toFixed(3)}</td>
                                                        <td className="p-3 text-right font-bold text-gradient">
                                                            {res.totalScore.toFixed(3)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Expand Toggle */}
                                <div className="text-center mt-3 pt-3 border-t border-gray-800">
                                    <button className="text-sm text-purple-400 hover:text-purple-300 font-semibold">
                                        {isExpanded ? '↑ Show Less' : '↓ View All Results'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="card text-center py-12">
                    <div className="text-6xl mb-4 opacity-30">📊</div>
                    <p className="opacity-60">No scores available for this day</p>
                </div>
            )}
        </div>
    );
};

export default ModernScoresPage;
