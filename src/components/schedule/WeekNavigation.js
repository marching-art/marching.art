import React from 'react';

const WeekNavigation = ({ 
    selectedWeek, 
    setSelectedWeek, 
    currentWeek, 
    maxWeeks, 
    jumpToWeek 
}) => {
    const weeks = Array.from({ length: maxWeeks }, (_, i) => i + 1);

    return (
        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                    Week Navigation
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setSelectedWeek(Math.max(1, selectedWeek - 1))}
                        disabled={selectedWeek === 1}
                        className="px-3 py-1 bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark rounded-theme disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent dark:hover:bg-accent-dark/20 transition-all"
                    >
                        ← Prev
                    </button>
                    <span className="text-sm text-text-secondary dark:text-text-secondary-dark px-2">
                        Week {selectedWeek} of {maxWeeks}
                    </span>
                    <button
                        onClick={() => setSelectedWeek(Math.min(maxWeeks, selectedWeek + 1))}
                        disabled={selectedWeek === maxWeeks}
                        className="px-3 py-1 bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark rounded-theme disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent dark:hover:bg-accent-dark/20 transition-all"
                    >
                        Next →
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-10 gap-2">
                {weeks.map(week => (
                    <button 
                        key={week} 
                        onClick={() => jumpToWeek(week)} 
                        className={`p-3 rounded-theme font-semibold transition-all relative ${
                            selectedWeek === week 
                                ? 'bg-primary text-on-primary shadow-lg' 
                                : week === currentWeek
                                ? 'bg-accent text-text-primary dark:text-text-primary-dark border-2 border-primary dark:border-primary-dark'
                                : 'bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark/20'
                        }`}
                    >
                        Week {week}
                        {week === currentWeek && week !== selectedWeek && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full"></span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default WeekNavigation;