// ShowsGrid - Grid display of shows for a selected week (Brutalist Architecture)
import React from 'react';
import { motion } from 'framer-motion';
import ShowCard from './ShowCard';
import { ConsoleEmptyState } from '../ui/CommandConsole';
import { isEventPast } from '../../utils/scheduleUtils';

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
      <ConsoleEmptyState
        variant="radar"
        title="AWAITING SCHEDULE DATA"
        subtitle={`No shows detected for Week ${selectedWeek}. Scanning for upcoming events...`}
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
        {shows.map((show, index) => {
          const myCorps = getMyCorpsAtShow(show);
          const showDate = getActualDate(show.day);
          const isPast = isEventPast(showDate);

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
