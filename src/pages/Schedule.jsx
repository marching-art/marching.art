// src/pages/Schedule.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Clock, ChevronRight } from 'lucide-react';

const Schedule = () => {
  const weeks = [
    { week: 1, dates: 'June 15-21', shows: 12 },
    { week: 2, dates: 'June 22-28', shows: 18 },
    { week: 3, dates: 'June 29-July 5', shows: 24 },
  ];

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-display font-bold text-gradient mb-4">Season Schedule</h1>
        <p className="text-cream-300">Upcoming shows and competition dates</p>
      </motion.div>

      <div className="space-y-4">
        {weeks.map((week, index) => (
          <motion.div
            key={week.week}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="card hover:shadow-glow transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-cream-100">Week {week.week}</h3>
                <p className="text-cream-500/60">{week.dates}</p>
                <p className="text-sm text-gold-500 mt-1">{week.shows} shows scheduled</p>
              </div>
              <ChevronRight className="w-5 h-5 text-cream-500/40" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Schedule;
