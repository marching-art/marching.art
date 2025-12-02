// ShowCard - Individual show card for schedule
import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Check, Music, Plus, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const ShowCard = ({
  show,
  index,
  myCorps,
  formattedDate,
  isPast,
  onRegister
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`glass-dark rounded-xl p-4 border border-cream-500/10 ${
        isPast ? 'opacity-70' : ''
      } ${myCorps.length > 0 ? 'ring-1 ring-green-500/30' : ''}`}
    >
      {/* Show Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-cream-100 truncate text-sm">
            {show.eventName || show.name}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-xs text-cream-500/70">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formattedDate}
            </span>
          </div>
          {show.location && (
            <div className="flex items-center gap-1 mt-1 text-xs text-cream-500/60 truncate">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{show.location}</span>
            </div>
          )}
        </div>
        <div className={`p-1.5 rounded-lg flex-shrink-0 ${
          isPast ? 'bg-charcoal-700' : 'bg-gold-500/20'
        }`}>
          <Music className={`w-4 h-4 ${
            isPast ? 'text-cream-500/60' : 'text-gold-500'
          }`} />
        </div>
      </div>

      {/* Registered Corps */}
      {myCorps.length > 0 && (
        <div className="mb-3 p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
          <div className="flex items-center gap-1 text-xs text-green-400 mb-1">
            <Check className="w-3 h-3" />
            <span className="font-medium">Registered</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {myCorps.map((corps, idx) => (
              <span
                key={idx}
                className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-xs"
              >
                {corps.corpsName.length > 12
                  ? corps.corpsName.substring(0, 12) + '...'
                  : corps.corpsName}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action Button */}
      {isPast ? (
        <Link
          to="/scores"
          className="btn-outline w-full text-sm py-2 flex items-center justify-center gap-1.5"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          View Scores
        </Link>
      ) : (
        <button
          onClick={() => onRegister(show)}
          className="btn-primary w-full text-sm py-2 flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          {myCorps.length > 0 ? 'Edit Registration' : 'Register Corps'}
        </button>
      )}
    </motion.div>
  );
};

export default ShowCard;
