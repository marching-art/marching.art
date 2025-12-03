// ShowsGrid - Grid display of shows for a selected week
import React from 'react';
import { motion } from 'framer-motion';
import ShowCard from './ShowCard';
import EmptyState from '../EmptyState';

const ShowsGrid = ({
  shows,
  selectedWeek,
  getActualDate,
  formatDateCompact,
  getMyCorpsAtShow,
  onRegisterCorps
}) => {
  if (shows.length === 0) {
    return (
      <EmptyState
        title="NO SHOWS SCHEDULED"
        subtitle={`No shows scheduled for Week ${selectedWeek}...`}
      />
    );
  }

  return (
    <motion.div
      key={`shows-${selectedWeek}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 overflow-y-auto min-h-0"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pb-4">
        {shows.map((show, index) => {
          const myCorps = getMyCorpsAtShow(show);
          const showDate = getActualDate(show.day);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const isPast = showDate && showDate < today;

          return (
            <ShowCard
              key={`${show.eventName}-${show.day}`}
              show={show}
              index={index}
              myCorps={myCorps}
              formattedDate={formatDateCompact(show.day)}
              isPast={isPast}
              onRegister={onRegisterCorps}
            />
          );
        })}
      </div>
    </motion.div>
  );
};

export default ShowsGrid;
