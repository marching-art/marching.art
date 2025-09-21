import React from 'react';
import Icon from '../ui/Icon';

const ScheduleFilters = ({
    searchTerm,
    setSearchTerm,
    filterByClass,
    setFilterByClass,
    quickFilter,
    setQuickFilter,
    sortBy,
    setSortBy,
    showMyCorpsOnly,
    setShowMyCorpsOnly,
    compactView,
    setCompactView,
    selectedCorps,
    setSelectedCorps,
    userCorps,
    availableCorps,
    onClearFilters,
    seasonEvents = []
}) => {
    // Get all events that include specific classes
    const getEventsForClass = (className) => {
        if (!seasonEvents || seasonEvents.length === 0) return [];
        
        return seasonEvents.filter(event => {
            if (!event.shows) return false;
            
            return event.shows.some(show => {
                // Check if event has class restrictions
                if (show.classRestrictions) {
                    return show.classRestrictions.includes(className);
                }
                
                // Check event name for class indicators
                const eventName = show.eventName.toLowerCase();
                switch (className) {
                    case 'worldClass':
                        return eventName.includes('world') || 
                               eventName.includes('dci') || 
                               (!eventName.includes('open') && !eventName.includes('class a'));
                    case 'openClass':
                        return eventName.includes('open');
                    case 'aClass':
                        return eventName.includes('class a') || eventName.includes('a class');
                    default:
                        return true;
                }
            });
        });
    };

    const handleClassFilter = (className) => {
        if (filterByClass === className) {
            setFilterByClass('all'); // Toggle off if same class selected
        } else {
            setFilterByClass(className);
        }
    };

    const clearAllFilters = () => {
        setSearchTerm('');
        setFilterByClass('all');
        setQuickFilter('all');
        setSortBy('day');
        setShowMyCorpsOnly(false);
        setSelectedCorps(new Set());
        if (onClearFilters) onClearFilters();
    };

    const hasActiveFilters = searchTerm || 
                           filterByClass !== 'all' || 
                           quickFilter !== 'all' || 
                           showMyCorpsOnly || 
                           selectedCorps.size > 0;

    return (
        <div className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-4 mb-6 space-y-4">
            {/* Search Bar */}
            <div className="relative">
                <Icon 
                    path="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" 
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-secondary dark:text-text-secondary-dark" 
                />
                <input
                    type="text"
                    placeholder="Search events, locations, or corps..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-accent dark:border-accent-dark rounded-theme bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark"
                />
                {searchTerm && (
                    <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark"
                    >
                        <Icon path="M6 18L18 6M6 6l12 12" className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Filter Controls Row 1 */}
            <div className="flex flex-wrap gap-3">
                {/* Class Filters - Fixed to show events properly */}
                <div className="flex gap-2">
                    <button
                        onClick={() => handleClassFilter('all')}
                        className={`px-3 py-1 rounded-theme text-sm font-medium transition-colors ${
                            filterByClass === 'all'
                                ? 'bg-primary dark:bg-primary-dark text-white'
                                : 'bg-accent dark:bg-accent-dark/20 text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'
                        }`}
                    >
                        All Classes
                    </button>
                    <button
                        onClick={() => handleClassFilter('worldClass')}
                        className={`px-3 py-1 rounded-theme text-sm font-medium transition-colors ${
                            filterByClass === 'worldClass'
                                ? 'bg-primary dark:bg-primary-dark text-white'
                                : 'bg-accent dark:bg-accent-dark/20 text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'
                        }`}
                    >
                        World Class ({getEventsForClass('worldClass').length})
                    </button>
                    <button
                        onClick={() => handleClassFilter('openClass')}
                        className={`px-3 py-1 rounded-theme text-sm font-medium transition-colors ${
                            filterByClass === 'openClass'
                                ? 'bg-primary dark:bg-primary-dark text-white'
                                : 'bg-accent dark:bg-accent-dark/20 text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'
                        }`}
                    >
                        Open Class ({getEventsForClass('openClass').length})
                    </button>
                    <button
                        onClick={() => handleClassFilter('aClass')}
                        className={`px-3 py-1 rounded-theme text-sm font-medium transition-colors ${
                            filterByClass === 'aClass'
                                ? 'bg-primary dark:bg-primary-dark text-white'
                                : 'bg-accent dark:bg-accent-dark/20 text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'
                        }`}
                    >
                        A Class ({getEventsForClass('aClass').length})
                    </button>
                </div>

                {/* Quick Filters */}
                <div className="flex gap-2">
                    <select
                        value={quickFilter}
                        onChange={(e) => setQuickFilter(e.target.value)}
                        className="px-3 py-1 rounded-theme text-sm border border-accent dark:border-accent-dark bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark"
                    >
                        <option value="all">All Events</option>
                        <option value="today">Today</option>
                        <option value="thisWeek">This Week</option>
                        <option value="favorites">Favorites</option>
                        <option value="attending">My Corps Attending</option>
                    </select>

                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="px-3 py-1 rounded-theme text-sm border border-accent dark:border-accent-dark bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark"
                    >
                        <option value="day">Sort by Day</option>
                        <option value="attendance">Sort by Attendance</option>
                        <option value="name">Sort by Event Name</option>
                        <option value="location">Sort by Location</option>
                    </select>
                </div>
            </div>

            {/* Filter Controls Row 2 */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Toggle Switches */}
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showMyCorpsOnly}
                        onChange={(e) => setShowMyCorpsOnly(e.target.checked)}
                        className="w-4 h-4 text-primary dark:text-primary-dark border-accent dark:border-accent-dark rounded focus:ring-primary dark:focus:ring-primary-dark focus:ring-2"
                    />
                    <span className="text-sm text-text-primary dark:text-text-primary-dark">
                        My Corps Only
                    </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={compactView}
                        onChange={(e) => setCompactView(e.target.checked)}
                        className="w-4 h-4 text-primary dark:text-primary-dark border-accent dark:border-accent-dark rounded focus:ring-primary dark:focus:ring-primary-dark focus:ring-2"
                    />
                    <span className="text-sm text-text-primary dark:text-text-primary-dark">
                        Compact View
                    </span>
                </label>

                {/* Clear Filters */}
                {hasActiveFilters && (
                    <button
                        onClick={clearAllFilters}
                        className="flex items-center gap-2 px-3 py-1 text-sm text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark transition-colors"
                    >
                        <Icon path="M6 18L18 6M6 6l12 12" className="w-4 h-4" />
                        Clear Filters
                    </button>
                )}
            </div>

            {/* Corps Selection - Enhanced for better UX */}
            {availableCorps && availableCorps.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                        Filter by Corps:
                    </h4>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                        {availableCorps.slice(0, 20).map((corps) => (
                            <button
                                key={corps.name}
                                onClick={() => {
                                    const newSelected = new Set(selectedCorps);
                                    if (newSelected.has(corps.name)) {
                                        newSelected.delete(corps.name);
                                    } else {
                                        newSelected.add(corps.name);
                                    }
                                    setSelectedCorps(newSelected);
                                }}
                                className={`px-2 py-1 text-xs rounded-theme transition-colors ${
                                    selectedCorps.has(corps.name)
                                        ? 'bg-primary dark:bg-primary-dark text-white'
                                        : 'bg-accent dark:bg-accent-dark/20 text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'
                                }`}
                            >
                                {corps.name}
                                {userCorps && Object.values(userCorps).some(uc => uc.name === corps.name) && (
                                    <span className="ml-1 text-yellow-400">★</span>
                                )}
                            </button>
                        ))}
                        {availableCorps.length > 20 && (
                            <span className="px-2 py-1 text-xs text-text-secondary dark:text-text-secondary-dark">
                                +{availableCorps.length - 20} more...
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Active Filters Summary */}
            {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-accent dark:border-accent-dark">
                    <span className="text-xs text-text-secondary dark:text-text-secondary-dark">Active filters:</span>
                    
                    {searchTerm && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 dark:bg-primary-dark/10 text-primary dark:text-primary-dark text-xs rounded-theme">
                            Search: "{searchTerm}"
                            <button onClick={() => setSearchTerm('')}>
                                <Icon path="M6 18L18 6M6 6l12 12" className="w-3 h-3" />
                            </button>
                        </span>
                    )}
                    
                    {filterByClass !== 'all' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 dark:bg-primary-dark/10 text-primary dark:text-primary-dark text-xs rounded-theme">
                            Class: {filterByClass === 'worldClass' ? 'World' : filterByClass === 'openClass' ? 'Open' : 'A Class'}
                            <button onClick={() => setFilterByClass('all')}>
                                <Icon path="M6 18L18 6M6 6l12 12" className="w-3 h-3" />
                            </button>
                        </span>
                    )}
                    
                    {quickFilter !== 'all' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 dark:bg-primary-dark/10 text-primary dark:text-primary-dark text-xs rounded-theme">
                            Filter: {quickFilter}
                            <button onClick={() => setQuickFilter('all')}>
                                <Icon path="M6 18L18 6M6 6l12 12" className="w-3 h-3" />
                            </button>
                        </span>
                    )}
                    
                    {showMyCorpsOnly && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 dark:bg-primary-dark/10 text-primary dark:text-primary-dark text-xs rounded-theme">
                            My Corps Only
                            <button onClick={() => setShowMyCorpsOnly(false)}>
                                <Icon path="M6 18L18 6M6 6l12 12" className="w-3 h-3" />
                            </button>
                        </span>
                    )}
                    
                    {selectedCorps.size > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 dark:bg-primary-dark/10 text-primary dark:text-primary-dark text-xs rounded-theme">
                            {selectedCorps.size} Corps Selected
                            <button onClick={() => setSelectedCorps(new Set())}>
                                <Icon path="M6 18L18 6M6 6l12 12" className="w-3 h-3" />
                            </button>
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default ScheduleFilters;