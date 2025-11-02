import React from 'react';

/**
 * CorpsCard - Visual card for corps/player selection
 * ESPN/Sleeper style with image, stats, and status
 */
const CorpsCard = ({ 
    name,
    points,
    trend,
    status = 'available', // available, selected, locked, injured
    position,
    imageUrl,
    stats = {},
    onClick,
    onAction,
    actionLabel = 'Select',
    compact = false
}) => {
    const statusConfig = {
        available: { 
            border: 'border-gray-600', 
            bg: 'bg-slate-800',
            badge: null
        },
        selected: { 
            border: 'border-purple-500', 
            bg: 'bg-gradient-to-br from-slate-800 to-purple-900/30',
            badge: { label: 'Active', color: 'success' }
        },
        locked: { 
            border: 'border-gray-700', 
            bg: 'bg-slate-900',
            badge: { label: 'Locked', color: 'warning' }
        },
        injured: { 
            border: 'border-red-900', 
            bg: 'bg-slate-900',
            badge: { label: 'Out', color: 'error' }
        }
    };

    const config = statusConfig[status] || statusConfig.available;
    const isInteractive = status !== 'locked' && onClick;

    if (compact) {
        return (
            <div 
                className={`player-card ${config.bg} ${config.border} p-3 ${status === 'locked' ? 'locked' : ''} ${status === 'selected' ? 'selected' : ''}`}
                onClick={isInteractive ? onClick : undefined}
            >
                <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            {position && (
                                <span className="text-xs font-bold text-purple-400 uppercase">
                                    {position}
                                </span>
                            )}
                            {config.badge && (
                                <span className={`badge badge-${config.badge.color} text-xs py-0 px-2`}>
                                    {config.badge.label}
                                </span>
                            )}
                        </div>
                        <div className="font-bold text-sm truncate mb-1">
                            {name}
                        </div>
                        <div className="text-xs opacity-60">
                            {points} pts
                        </div>
                    </div>
                    {onAction && status !== 'locked' && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onAction(); }}
                            className="btn-ghost text-xs px-3 py-1"
                        >
                            {actionLabel}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div 
            className={`player-card ${config.bg} ${config.border} ${status === 'locked' ? 'locked' : ''} ${status === 'selected' ? 'selected' : ''}`}
            onClick={isInteractive ? onClick : undefined}
        >
            {/* Header: Position & Status */}
            <div className="flex items-start justify-between mb-3">
                {position && (
                    <span className="badge badge-primary text-xs">
                        {position}
                    </span>
                )}
                {config.badge && (
                    <span className={`badge badge-${config.badge.color} text-xs`}>
                        {config.badge.label}
                    </span>
                )}
            </div>

            {/* Corps Image Placeholder */}
            <div className="w-full aspect-square bg-gradient-to-br from-slate-700 to-slate-900 rounded-lg mb-3 flex items-center justify-center">
                {imageUrl ? (
                    <img src={imageUrl} alt={name} className="w-full h-full object-cover rounded-lg" />
                ) : (
                    <span className="text-4xl opacity-30">🎺</span>
                )}
            </div>

            {/* Corps Name */}
            <div className="font-bold text-sm mb-2 truncate">
                {name}
            </div>

            {/* Stats Row */}
            <div className="flex items-center justify-between mb-3">
                <div>
                    <div className="text-2xl font-bold text-gradient">
                        {points}
                    </div>
                    <div className="text-xs opacity-60">Points</div>
                </div>
                
                {trend !== undefined && (
                    <div className={`text-sm font-semibold ${
                        trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-gray-500'
                    }`}>
                        {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend)}
                    </div>
                )}
            </div>

            {/* Additional Stats */}
            {Object.keys(stats).length > 0 && (
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-700">
                    {Object.entries(stats).slice(0, 4).map(([key, value]) => (
                        <div key={key} className="text-center">
                            <div className="text-xs opacity-60 mb-1">{key}</div>
                            <div className="text-sm font-semibold">{value}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Action Button */}
            {onAction && status !== 'locked' && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onAction(); }}
                    className="btn-primary w-full mt-3 text-sm"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
};

export default CorpsCard;
