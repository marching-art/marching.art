import React from 'react';

const ScheduleControls = ({ 
    viewMode, 
    setViewMode, 
    quickFilter, 
    setQuickFilter, 
    goToCurrentWeek, 
    hasUserCorps 
}) => {
    return (
        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                {/* View Mode Toggle */}
                <div className="flex bg-background dark:bg-background-dark rounded-theme p-1">
                    <button
                        onClick={() => setViewMode('calendar')}
                        className={`px-4 py-2 rounded-theme text-sm font-medium transition-all ${
                            viewMode === 'calendar'
                                ? 'bg-primary text-on-primary shadow-md'
                                : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'
                        }`}
                    >
                        Full Schedule
                    </button>
                    {hasUserCorps && (
                        <button
                            onClick={() => setViewMode('personal')}
                            className={`px-4 py-2 rounded-theme text-sm font-medium transition-all ${
                                viewMode === 'personal'
                                    ? 'bg-primary text-on-primary shadow-md'
                                    : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'
                            }`}
                        >
                            My Schedule
                        </button>
                    )}
                </div>

                {/* Quick Filters */}
                <div className="flex gap-2">
                    {['all', 'today', 'upcoming'].map(filter => (
                        <button
                            key={filter}
                            onClick={() => setQuickFilter(filter)}
                            className={`px-3 py-1 rounded-theme text-sm transition-all capitalize ${
                                quickFilter === filter
                                    ? 'bg-accent text-text-primary dark:text-text-primary-dark'
                                    : 'text-text-secondary dark:text-text-secondary-dark hover:bg-accent/50'
                            }`}
                        >
                            {filter}
                        </button>
                    ))}
                    <button
                        onClick={goToCurrentWeek}
                        className="px-3 py-1 bg-primary text-on-primary rounded-theme text-sm font-medium hover:bg-primary/90 transition-all"
                    >
                        Current Week
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ScheduleControls;