// ShowsGrid - Grid display of shows for a selected week
import React from 'react';
import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import ShowCard from './ShowCard';

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
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
        <p className="text-slate-500 dark:text-slate-400">No shows scheduled for Week {selectedWeek}</p>
      </div>
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
