import React, { useState } from 'react';
import CorpsCard from '../components/modern/CorpsCard';
import { CORPS_CLASSES } from '../utils/profileCompatibility';

/**
 * VisualLineupEditor - Sleeper-style lineup management
 * Visual, intuitive, with quick swaps and stats
 */
const VisualLineupEditor = ({ 
    corpsClass = 'worldClass',
    currentLineup = {},
    availableCorps = [],
    pointCap = 150,
    onUpdateLineup,
    isLocked = false
}) => {
    const [selectedPosition, setSelectedPosition] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const positions = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];
    
    const lineupCorps = positions.map(pos => ({
        position: pos,
        corps: availableCorps.find(c => c.corpsName === currentLineup[pos]) || null
    }));

    const usedPoints = lineupCorps.reduce((sum, slot) => sum + (slot.corps?.points || 0), 0);
    const remainingPoints = pointCap - usedPoints;

    const filteredAvailable = availableCorps
        .filter(c => !Object.values(currentLineup).includes(c.corpsName))
        .filter(c => searchTerm === '' || c.corpsName.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleSelectCorps = (corps) => {
        if (!selectedPosition || isLocked) return;
        
        const newLineup = { ...currentLineup };
        
        // Check point cap
        const currentInSlot = availableCorps.find(c => c.corpsName === newLineup[selectedPosition]);
        const pointsToAdd = corps.points - (currentInSlot?.points || 0);
        
        if (usedPoints + pointsToAdd > pointCap) {
            alert(`This would exceed your ${pointCap} point cap!`);
            return;
        }
        
        newLineup[selectedPosition] = corps.corpsName;
        onUpdateLineup(newLineup);
        setSelectedPosition(null);
    };

    const handleRemoveCorps = (position) => {
        if (isLocked) return;
        const newLineup = { ...currentLineup };
        delete newLineup[position];
        onUpdateLineup(newLineup);
    };

    return (
        <div className="space-y-6">
            {/* Header: Points Cap */}
            <div className="card-floating">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-bold mb-1">
                            {CORPS_CLASSES[corpsClass]?.name} Lineup
                        </h2>
                        <p className="text-sm opacity-60">
                            Click a position to select a corps
                        </p>
                    </div>
                    {isLocked && (
                        <span className="badge badge-warning">
                            🔒 Locked
                        </span>
                    )}
                </div>

                {/* Points Progress */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold">Point Cap</span>
                        <span className={`text-lg font-bold ${
                            remainingPoints < 0 ? 'text-red-500' : 'text-green-500'
                        }`}>
                            {remainingPoints} / {pointCap}
                        </span>
                    </div>
                    <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                            className={`h-full transition-all ${
                                remainingPoints < 0 
                                    ? 'bg-gradient-to-r from-red-500 to-red-600' 
                                    : 'bg-gradient-to-r from-purple-500 to-purple-600'
                            }`}
                            style={{ width: `${Math.min((usedPoints / pointCap) * 100, 100)}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* Lineup Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {lineupCorps.map(slot => (
                    <div 
                        key={slot.position}
                        className={`
                            relative
                            ${selectedPosition === slot.position ? 'ring-2 ring-purple-500 rounded-xl' : ''}
                        `}
                    >
                        {slot.corps ? (
                            <div className="relative group">
                                <CorpsCard
                                    name={slot.corps.corpsName}
                                    points={slot.corps.points}
                                    position={slot.position}
                                    status={isLocked ? 'locked' : 'selected'}
                                    onClick={() => !isLocked && setSelectedPosition(slot.position)}
                                />
                                {!isLocked && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveCorps(slot.position);
                                        }}
                                        className="absolute top-2 right-2 w-6 h-6 bg-red-500/90 hover:bg-red-500 rounded-full flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        ) : (
                            <button
                                onClick={() => !isLocked && setSelectedPosition(slot.position)}
                                disabled={isLocked}
                                className={`
                                    w-full aspect-[3/4] rounded-xl border-2 border-dashed
                                    flex flex-col items-center justify-center gap-2
                                    transition-all
                                    ${selectedPosition === slot.position 
                                        ? 'border-purple-500 bg-purple-500/10' 
                                        : 'border-gray-700 hover:border-purple-500/50 hover:bg-slate-800'
                                    }
                                    ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                `}
                            >
                                <span className="text-3xl opacity-30">+</span>
                                <span className="badge badge-primary text-xs">
                                    {slot.position}
                                </span>
                                <span className="text-xs opacity-60">Empty</span>
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* Corps Selection */}
            {selectedPosition && !isLocked && (
                <div className="card">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold">
                            Select Corps for {selectedPosition}
                        </h3>
                        <button
                            onClick={() => setSelectedPosition(null)}
                            className="btn-ghost text-sm"
                        >
                            Cancel
                        </button>
                    </div>

                    {/* Search */}
                    <input
                        type="text"
                        placeholder="Search corps..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-800 border border-gray-700 rounded-lg mb-4 text-white placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                    />

                    {/* Available Corps Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-96 overflow-y-auto custom-scrollbar">
                        {filteredAvailable.map(corps => (
                            <CorpsCard
                                key={corps.corpsName}
                                name={corps.corpsName}
                                points={corps.points}
                                status={corps.points > remainingPoints + (lineupCorps.find(s => s.position === selectedPosition)?.corps?.points || 0) ? 'locked' : 'available'}
                                compact
                                onClick={() => handleSelectCorps(corps)}
                            />
                        ))}
                    </div>

                    {filteredAvailable.length === 0 && (
                        <div className="text-center py-8 opacity-60">
                            <p>No corps available</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default VisualLineupEditor;
