import React from 'react';

const ScheduleHeader = ({ seasonName, isLiveSeason, currentDay }) => {
    return (
        <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-primary dark:text-primary-dark">
                Season Schedule
            </h1>
            <p className="text-text-secondary dark:text-text-secondary-dark mt-2">
                {seasonName} • {isLiveSeason ? 'Live Season' : 'Off-Season'} • Day {currentDay}
            </p>
        </div>
    );
};

export default ScheduleHeader;