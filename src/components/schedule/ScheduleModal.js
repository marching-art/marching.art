import React, { useMemo, useState, useCallback } from 'react';
import { CORPS_CLASSES, CORPS_CLASS_ORDER } from '../../utils/profileCompatibility';
import { formatDate, formatTimeUntil, isToday, isPastDate } from '../../utils/dateUtils';
import Icon from '../ui/Icon';

const ScheduleModal = ({
    isOpen,
    onClose,
    modalType,
    modalData,
    favoriteShows = new Set(),
    notifications = new Set(),
    onToggleFavorite,
    onToggleNotification,
    userCorps = {}
}) => {
    const [selectedTab, setSelectedTab] = useState('overview');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClass, setSelectedClass] = useState('all');
    const [sortBy, setSortBy] = useState('corps');
    
    if (!isOpen || !modalData) return null;

    const { eventName, location, day, date, attendance, scores, isFavorite, hasNotification } = modalData;
    const showKey = `${day}_${eventName}`;
    
    // Enhanced attendee processing with search and filtering
    const processedAttendees = useMemo(() => {
        if (!attendance?.attendees) return [];
        
        let allAttendees = [];
        
        CORPS_CLASS_ORDER.forEach(corpsClass => {
            const classAttendees = attendance.attendees[corpsClass] || [];
            classAttendees.forEach(attendee => {
                allAttendees.push({
                    ...attendee,
                    corpsClass,
                    className: CORPS_CLASSES[corpsClass].name,
                    classColor: CORPS_CLASSES[corpsClass].color,
                    isUserCorps: Object.values(userCorps).some(corps => corps.name === attendee.corpsName)
                });
            });
        });
        
        // Apply search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            allAttendees = allAttendees.filter(attendee =>
                attendee.corpsName.toLowerCase().includes(term) ||
                attendee.username.toLowerCase().includes(term)
            );
        }
        
        // Apply class filter
        if (selectedClass !== 'all') {
            allAttendees = allAttendees.filter(attendee => attendee.corpsClass === selectedClass);
        }
        
        // Apply sorting
        allAttendees.sort((a, b) => {
            switch (sortBy) {
                case 'user':
                    return a.username.localeCompare(b.username);
                case 'class':
                    const classOrder = CORPS_CLASS_ORDER.indexOf(a.corpsClass) - CORPS_CLASS_ORDER.indexOf(b.corpsClass);
                    return classOrder !== 0 ? classOrder : a.corpsName.localeCompare(b.corpsName);
                default: // 'corps'
                    return a.corpsName.localeCompare(b.corpsName);
            }
        });
        
        return allAttendees;
    }, [attendance, searchTerm, selectedClass, sortBy, userCorps]);

    // Group attendees by corps for compact view
    const attendeesByCorps = useMemo(() => {
        const grouped = new Map();
        
        processedAttendees.forEach(attendee => {
            if (!grouped.has(attendee.corpsName)) {
                grouped.set(attendee.corpsName, {
                    corpsName: attendee.corpsName,
                    corpsLocation: attendee.corpsLocation,
                    corpsClass: attendee.corpsClass,
                    className: attendee.className,
                    classColor: attendee.classColor,
                    members: [],
                    isUserCorps: attendee.isUserCorps
                });
            }
            grouped.get(attendee.corpsName).members.push(attendee);
        });
        
        return Array.from(grouped.values()).sort((a, b) => a.corpsName.localeCompare(b.corpsName));
    }, [processedAttendees]);

    // Calculate statistics
    const stats = useMemo(() => {
        const totalAttendance = attendance ? 
            Object.values(attendance.counts).reduce((sum, count) => sum + count, 0) : 0;
        
        const classCounts = attendance?.counts || { worldClass: 0, openClass: 0, aClass: 0 };
        const userCorpsCount = processedAttendees.filter(a => a.isUserCorps).length;
        const uniqueCorps = new Set(processedAttendees.map(a => a.corpsName)).size;
        
        return {
            totalAttendance,
            classCounts,
            userCorpsCount,
            uniqueCorps,
            searchResults: processedAttendees.length
        };
    }, [attendance, processedAttendees]);

    const handleShare = useCallback(async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${eventName} - marching.art`,
                    text: `Check out this drum corps event: ${eventName} on ${formatDate(date)}`,
                    url: window.location.href
                });
            } catch (error) {
                // User cancelled sharing
            }
        } else {
            navigator.clipboard.writeText(window.location.href);
            alert('Link copied to clipboard!');
        }
    }, [eventName, date]);

    const handleExport = useCallback(() => {
        const csvContent = [
            ['Corps Name', 'Director', 'Class', 'Location'],
            ...attendeesByCorps.map(corps => [
                corps.corpsName,
                corps.members.map(m => m.username).join('; '),
                corps.className,
                corps.corpsLocation || ''
            ])
        ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${eventName.replace(/[^a-zA-Z0-9]/g, '_')}_attendance.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [eventName, attendeesByCorps]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-accent/20 dark:border-accent-dark/20">
                    <div>
                        <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                            {eventName.replace(/DCI/g, 'marching.art')}
                        </h2>
                        <p className="text-text-secondary dark:text-text-secondary-dark">
                            {location} • Day {day} • {formatDate(date, { includeDay: true })}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-background dark:hover:bg-background-dark rounded-full transition-colors"
                    >
                        <Icon path="M6 18L18 6M6 6l12 12" className="w-5 h-5 text-text-secondary" />
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-accent/20 dark:border-accent-dark/20">
                    {[
                        { id: 'overview', label: 'Overview', icon: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25' },
                        { id: 'attendees', label: `Corps (${stats.uniqueCorps})`, icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z' },
                        ...(scores && scores.length > 0 ? [{ id: 'scores', label: 'Results', icon: 'M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.228a9.014 9.014 0 012.916.52 6.003 6.003 0 01-4.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0A6.772 6.772 0 0112 14.25m0 0a6.772 6.772 0 01-4.478-1.622m0 0a6.726 6.726 0 01-2.748-1.35m0 0A6.003 6.003 0 012.25 9c0-1.357.445-2.611 1.198-3.625m0 0A9.014 9.014 0 015.364 4.85m0 0A9.014 9.014 0 0112 2.25' }] : [])
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setSelectedTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
                                selectedTab === tab.id
                                    ? 'text-primary border-b-2 border-primary bg-primary/5'
                                    : 'text-text-secondary hover:text-text-primary dark:text-text-secondary-dark dark:hover:text-text-primary-dark'
                            }`}
                        >
                            <Icon path={tab.icon} className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Modal Content */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {selectedTab === 'overview' && (
                        <div className="space-y-6">
                            {/* Event Status & Actions */}
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-3 mb-4">
                                    {isToday(date) && (
                                        <span className="px-3 py-1 bg-primary text-on-primary rounded-full text-sm font-bold">
                                            TODAY
                                        </span>
                                    )}
                                    {!isPastDate(date) && (
                                        <div className="text-primary font-medium">
                                            {formatTimeUntil(date)}
                                        </div>
                                    )}
                                </div>

                                {/* Quick Actions */}
                                <div className="flex items-center justify-center gap-3 mb-6">
                                    <button
                                        onClick={() => onToggleFavorite(day, eventName)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-theme font-medium transition-colors ${
                                            isFavorite 
                                                ? 'bg-yellow-500 text-white hover:bg-yellow-600' 
                                                : 'bg-background dark:bg-background-dark text-text-secondary hover:text-yellow-500 border border-accent dark:border-accent-dark'
                                        }`}
                                    >
                                        <Icon path="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" 
                                              className="w-4 h-4" />
                                        {isFavorite ? 'Remove Favorite' : 'Add Favorite'}
                                    </button>
                                    
                                    <button
                                        onClick={() => onToggleNotification(day, eventName)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-theme font-medium transition-colors ${
                                            hasNotification 
                                                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                                                : 'bg-background dark:bg-background-dark text-text-secondary hover:text-blue-500 border border-accent dark:border-accent-dark'
                                        }`}
                                    >
                                        <Icon path="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" 
                                              className="w-4 h-4" />
                                        {hasNotification ? 'Remove Alert' : 'Set Alert'}
                                    </button>
                                    
                                    <button
                                        onClick={handleShare}
                                        className="flex items-center gap-2 px-4 py-2 bg-background dark:bg-background-dark text-text-secondary hover:text-text-primary border border-accent dark:border-accent-dark rounded-theme font-medium transition-colors"
                                    >
                                        <Icon path="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" 
                                              className="w-4 h-4" />
                                        Share
                                    </button>
                                </div>
                            </div>

                            {/* Statistics Cards */}
                            <div className="grid grid-cols-3 gap-4">
                                {CORPS_CLASS_ORDER.map(corpsClass => {
                                    const classData = CORPS_CLASSES[corpsClass];
                                    const count = stats.classCounts[corpsClass] || 0;
                                    const attendees = attendance?.attendees?.[corpsClass] || [];
                                    const userCorpsInClass = attendees.filter(attendee => 
                                        Object.values(userCorps).some(corps => corps.name === attendee.corpsName)
                                    );
                                    
                                    return (
                                        <div key={corpsClass} className={`
                                            text-center p-4 rounded-theme border transition-all
                                            ${userCorpsInClass.length > 0 ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-accent/30 dark:border-accent-dark/30 bg-background dark:bg-background-dark'}
                                        `}>
                                            <div className={`w-8 h-8 mx-auto rounded-full ${classData.color} mb-3`}></div>
                                            <div className="text-sm font-medium text-text-primary dark:text-text-primary-dark mb-1">
                                                {classData.name}
                                            </div>
                                            <div className="text-2xl font-bold text-primary dark:text-primary-dark mb-1">
                                                {count}
                                            </div>
                                            <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                                corps competing
                                            </div>
                                            {userCorpsInClass.length > 0 && (
                                                <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
                                                    {userCorpsInClass.length} of your corps
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Quick Stats */}
                            <div className="bg-background dark:bg-background-dark p-4 rounded-theme">
                                <h4 className="font-semibold text-text-primary dark:text-text-primary-dark mb-3">
                                    Event Statistics
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <span className="text-text-secondary dark:text-text-secondary-dark">Total Corps:</span>
                                        <div className="font-bold text-text-primary dark:text-text-primary-dark">{stats.uniqueCorps}</div>
                                    </div>
                                    <div>
                                        <span className="text-text-secondary dark:text-text-secondary-dark">Total Directors:</span>
                                        <div className="font-bold text-text-primary dark:text-text-primary-dark">{stats.totalAttendance}</div>
                                    </div>
                                    <div>
                                        <span className="text-text-secondary dark:text-text-secondary-dark">Your Corps:</span>
                                        <div className="font-bold text-text-primary dark:text-text-primary-dark">{stats.userCorpsCount}</div>
                                    </div>
                                    <div>
                                        <span className="text-text-secondary dark:text-text-secondary-dark">Event Day:</span>
                                        <div className="font-bold text-text-primary dark:text-text-primary-dark">Day {day}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedTab === 'attendees' && (
                        <div className="space-y-4">
                            {/* Search and Filter Controls */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        placeholder="Search corps or directors..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full px-3 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme focus:ring-2 focus:ring-primary focus:border-primary text-text-primary dark:text-text-primary-dark"
                                    />
                                </div>
                                
                                <select
                                    value={selectedClass}
                                    onChange={(e) => setSelectedClass(e.target.value)}
                                    className="px-3 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme text-text-primary dark:text-text-primary-dark"
                                >
                                    <option value="all">All Classes</option>
                                    {CORPS_CLASS_ORDER.map(corpsClass => (
                                        <option key={corpsClass} value={corpsClass}>
                                            {CORPS_CLASSES[corpsClass].name}
                                        </option>
                                    ))}
                                </select>
                                
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="px-3 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme text-text-primary dark:text-text-primary-dark"
                                >
                                    <option value="corps">Sort by Corps</option>
                                    <option value="user">Sort by Director</option>
                                    <option value="class">Sort by Class</option>
                                </select>
                            </div>

                            {/* Results Summary */}
                            <div className="flex items-center justify-between text-sm text-text-secondary dark:text-text-secondary-dark">
                                <span>
                                    Showing {stats.searchResults} of {stats.totalAttendance} 
                                    {searchTerm || selectedClass !== 'all' ? ' (filtered)' : ''}
                                </span>
                                {attendeesByCorps.length > 0 && (
                                    <button
                                        onClick={handleExport}
                                        className="flex items-center gap-1 px-3 py-1 bg-primary/20 text-primary rounded hover:bg-primary/30 transition-colors"
                                    >
                                        <Icon path="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" 
                                              className="w-4 h-4" />
                                        Export CSV
                                    </button>
                                )}
                            </div>

                            {/* Attendees List */}
                            {attendeesByCorps.length > 0 ? (
                                <div className="space-y-3 max-h-96 overflow-y-auto">
                                    {attendeesByCorps.map((corps, index) => (
                                        <div key={`${corps.corpsName}-${index}`} className={`
                                            p-4 rounded-theme border transition-all
                                            ${corps.isUserCorps ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-accent/30 dark:border-accent-dark/30 bg-background dark:bg-background-dark'}
                                        `}>
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-4 h-4 rounded-full ${corps.classColor}`}></div>
                                                    <div>
                                                        <h5 className="font-bold text-text-primary dark:text-text-primary-dark">
                                                            {corps.corpsName}
                                                        </h5>
                                                        <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                                            {corps.className}
                                                            {corps.corpsLocation && ` • ${corps.corpsLocation}`}
                                                        </div>
                                                    </div>
                                                </div>
                                                {corps.isUserCorps && (
                                                    <span className="px-2 py-1 bg-blue-500 text-white rounded-full text-xs font-bold">
                                                        YOUR CORPS
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <div className="space-y-2">
                                                <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                                    <strong>Directors ({corps.members.length}):</strong>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {corps.members.map((member, memberIndex) => (
                                                        <div key={`${member.uid}-${memberIndex}`} className="p-2 bg-surface dark:bg-surface-dark rounded border border-accent/20 dark:border-accent-dark/20">
                                                            <div className="font-medium text-text-primary dark:text-text-primary-dark">
                                                                {member.username}
                                                            </div>
                                                            {member.isUserCorps && (
                                                                <div className="text-xs text-blue-600 dark:text-blue-400">
                                                                    You
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <Icon path="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" 
                                          className="w-12 h-12 mx-auto mb-3 text-text-secondary opacity-50" />
                                    <p className="text-text-secondary dark:text-text-secondary-dark">
                                        {searchTerm || selectedClass !== 'all' ? 'No corps match your search criteria' : 'No participating corps yet'}
                                    </p>
                                    {(searchTerm || selectedClass !== 'all') && (
                                        <button
                                            onClick={() => {
                                                setSearchTerm('');
                                                setSelectedClass('all');
                                            }}
                                            className="mt-3 text-primary hover:text-primary-dark font-medium"
                                        >
                                            Clear filters
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {selectedTab === 'scores' && scores && scores.length > 0 && (
                        <div className="space-y-4">
                            <div className="text-center">
                                <h4 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-2">
                                    Event Results
                                </h4>
                                <p className="text-text-secondary dark:text-text-secondary-dark">
                                    Final scores and placements for {eventName}
                                </p>
                            </div>

                            <div className="space-y-3">
                                {scores.map((result, index) => (
                                    <div key={`${result.corpsName}-${index}`} className="p-4 bg-background dark:bg-background-dark rounded-theme border border-accent/30 dark:border-accent-dark/30">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center justify-center w-8 h-8 bg-primary text-on-primary rounded-full font-bold">
                                                    {result.placement}
                                                </div>
                                                <div>
                                                    <h5 className="font-bold text-text-primary dark:text-text-primary-dark">
                                                        {result.corpsName}
                                                    </h5>
                                                    <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                                        Total: {result.totalScore?.toFixed(3)} | 
                                                        General Effect: {result.generalEffectScore?.toFixed(1)} | 
                                                        Visual: {result.visualScore?.toFixed(1)} | 
                                                        Music: {result.musicScore?.toFixed(1)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScheduleModal;