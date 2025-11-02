import React from 'react';

/**
 * StatCard - ESPN/Sleeper style stat display
 * Shows key metrics in a clean, scannable format
 */
const StatCard = ({ 
    label, 
    value, 
    subtitle, 
    trend, 
    isLive = false, 
    icon,
    color = 'primary',
    onClick 
}) => {
    const colorClasses = {
        primary: 'border-l-4 border-purple-500',
        success: 'border-l-4 border-green-500',
        warning: 'border-l-4 border-yellow-500',
        error: 'border-l-4 border-red-500',
        secondary: 'border-l-4 border-blue-500'
    };

    return (
        <div 
            className={`stat-card ${colorClasses[color]} ${isLive ? 'stat-card-live' : ''} ${onClick ? 'cursor-pointer' : ''}`}
            onClick={onClick}
        >
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                    {icon && <span className="text-xl opacity-60">{icon}</span>}
                    <span className="text-xs font-semibold uppercase tracking-wide opacity-60">
                        {label}
                    </span>
                </div>
                {isLive && (
                    <span className="badge badge-live text-xs">
                        <span className="status-indicator status-live"></span>
                        Live
                    </span>
                )}
            </div>
            
            <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-bold text-gradient">
                    {value}
                </span>
                {trend && (
                    <span className={`text-sm font-semibold ${
                        trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-gray-500'
                    }`}>
                        {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend)}
                    </span>
                )}
            </div>
            
            {subtitle && (
                <span className="text-xs opacity-60">
                    {subtitle}
                </span>
            )}
        </div>
    );
};

export default StatCard;
