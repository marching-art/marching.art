import React from 'react';
import ShowCard from './ShowCard';

const EventsDisplay = ({
    events,
    seasonSettings,
    fantasyRecaps,
    attendanceStats,
    currentDay,
    selectedWeek,
    quickFilter,
    onViewRecap,
    onShowModal,
    onSetModalData
}) => {
    const isLiveSeason = seasonSettings?.status === 'live-season';

    const getCalendarDate = (dayOffset) => {
        if (!seasonSettings?.schedule?.startDate) return null;
        const startDate = seasonSettings.schedule.startDate.toDate();
        const date = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
        date.setUTCDate(date.getUTCDate() + dayOffset - 1);
        return date;
    };

    const hasRecapForDay = (day) => {
        return fantasyRecaps?.recaps?.some(r => r.offSeasonDay === day && r.shows?.length > 0);
    };

    const getDisplayTitle = () => {
        switch (quickFilter) {
            case 'today': return 'Today\'s Events';
            case 'upcoming': return 'Upcoming Events';
            default: return `Week ${selectedWeek} Events`;
        }
    };

    const getEmptyStateMessage = () => {
        switch (quickFilter) {
            case 'today': return 'No events today';
            case 'upcoming': return 'No upcoming events';
            default: return 'No events scheduled this week';
        }
    };

    return (
        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                    {getDisplayTitle()}
                </h2>
                <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                    {events.length} event{events.length !== 1 ? 's' : ''}
                </div>
            </div>

            {events.length === 0 ? (
                <div className="text-center py-12">
                    <div className="text-6xl mb-4">📅</div>
                    <p className="text-text-secondary dark:text-text-secondary-dark text-lg">
                        {getEmptyStateMessage()}
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {events.map((event, eventIndex) => {
                        const dayNumber = isLiveSeason ? event.dayIndex + 1 : event.offSeasonDay;
                        const calendarDate = getCalendarDate(dayNumber);
                        const isCurrentDay = dayNumber === currentDay;
                        const isPastDay = dayNumber < currentDay;

                        return (
                            <div 
                                key={eventIndex} 
                                className={`p-6 rounded-lg border transition-all ${
                                    isCurrentDay 
                                        ? 'bg-primary/10 border-primary/30 shadow-lg' 
                                        : isPastDay
                                        ? 'bg-background/50 dark:bg-background-dark/50 border-accent/30 opacity-75'
                                        : 'bg-background dark:bg-background-dark border-accent/50 hover:border-accent'
                                }`}
                            >
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4">
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
                                                {calendarDate 
                                                    ? calendarDate.toLocaleDateString('en-US', { 
                                                        weekday: 'long', 
                                                        month: 'long', 
                                                        day: 'numeric' 
                                                    })
                                                    : `Day ${dayNumber}`
                                                }
                                            </h3>
                                            {isCurrentDay && (
                                                <span className="px-2 py-1 bg-primary text-on-primary text-xs font-bold rounded-full">
                                                    TODAY
                                                </span>
                                            )}
                                        </div>
                                        {hasRecapForDay(dayNumber) && (
                                            <button
                                                onClick={() => onViewRecap && onViewRecap(dayNumber)}
                                                className="text-sm text-primary dark:text-primary-dark hover:underline flex items-center gap-1"
                                            >
                                                📊 View Day Recap
                                            </button>
                                        )}
                                    </div>
                                    <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                        {event.shows?.length || 0} show{(event.shows?.length || 0) !== 1 ? 's' : ''}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {(event.shows || []).map((show, showIndex) => (
                                        <ShowCard
                                            key={showIndex}
                                            show={show}
                                            dayNumber={dayNumber}
                                            isPastDay={isPastDay}
                                            fantasyRecaps={fantasyRecaps}
                                            attendanceStats={attendanceStats}
                                            seasonUid={seasonSettings?.seasonUid}
                                            seasonEvents={events}
                                            onShowModal={onShowModal}
                                            onSetModalData={onSetModalData}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default EventsDisplay;