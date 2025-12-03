// ShowCard - Individual show card for schedule (Brutalist Architecture)
import React from 'react';
import { MapPin, Lock, Music, Plus, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  BrutalistCard,
  BrutalistHeader,
  BrutalistButton,
  BrutalistIconBox,
  BrutalistStamp,
  BrutalistDivider,
  MetricBadge
} from '../ui';

const ShowCard = ({
  show,
  index,
  myCorps,
  formattedDate,
  isPast,
  onRegister
}) => {
  const isRegistered = myCorps.length > 0;
  const isLocked = show.locked || isPast;

  // Determine card border state
  const getBorderState = () => {
    if (isRegistered && !isLocked) return 'success';
    return null;
  };

  // Determine status badge
  const getStatusBadge = () => {
    if (isLocked) {
      return <MetricBadge variant="muted" size="sm" icon={Lock}>{isPast ? 'Closed' : 'Locked'}</MetricBadge>;
    }
    if (show.scoresAvailable) {
      return <MetricBadge variant="info" size="sm">Scores Available</MetricBadge>;
    }
    return <MetricBadge variant="success" size="sm">Open</MetricBadge>;
  };

  return (
    <BrutalistCard
      variant="interactive"
      padding="none"
      border={getBorderState()}
      dimmed={isLocked}
      animate
      animateDelay={index * 0.03}
      className="relative flex overflow-hidden"
    >
      {/* REGISTERED Stamp Effect */}
      {isRegistered && !isLocked && (
        <div className="absolute top-3 right-3 z-20">
          <BrutalistStamp variant="success">Registered</BrutalistStamp>
        </div>
      )}

      {/* Left: Date Section */}
      <div className={`flex-shrink-0 w-20 md:w-24 p-3 md:p-4 flex flex-col items-center justify-center ${
        isRegistered && !isLocked
          ? 'bg-green-500/10 dark:bg-green-500/20'
          : 'bg-primary/10 dark:bg-primary/20'
      }`}>
        <span className="text-[10px] font-display font-bold uppercase tracking-wider text-text-muted">
          {formattedDate.split(' ')[0]}
        </span>
        <span className="text-2xl md:text-3xl font-display font-bold text-text-main">
          {formattedDate.split(' ')[2]}
        </span>
        <span className="text-xs font-display font-medium text-text-muted">
          {formattedDate.split(' ')[1]}
        </span>
      </div>

      {/* Dashed Divider */}
      <BrutalistDivider
        variant="dashed"
        className={`w-0 border-l-2 my-0 mx-0 h-auto ${
          isRegistered && !isLocked ? 'border-green-500/50' : 'border-border-default'
        }`}
      />

      {/* Right: Show Info */}
      <div className="flex-1 p-3 md:p-4 flex flex-col min-w-0">
        {/* Show Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <BrutalistHeader size="xs" className="truncate">
              {show.eventName || show.name}
            </BrutalistHeader>
            {show.location && (
              <div className="flex items-center gap-1 mt-1 text-xs text-text-muted font-bold truncate">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{show.location}</span>
              </div>
            )}
          </div>
          <BrutalistIconBox
            icon={isLocked ? Lock : Music}
            variant={isLocked ? 'muted' : isRegistered ? 'success' : 'primary'}
            size="sm"
          />
        </div>

        {/* Status Badge */}
        <div className="mb-2">
          {getStatusBadge()}
        </div>

        {/* Registered Corps List */}
        {isRegistered && (
          <div className="mb-2">
            <div className="flex flex-wrap gap-1">
              {myCorps.map((corps, idx) => (
                <MetricBadge
                  key={idx}
                  variant="success"
                  size="sm"
                  className="bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400"
                >
                  {corps.corpsName.length > 12
                    ? corps.corpsName.substring(0, 12) + '...'
                    : corps.corpsName}
                </MetricBadge>
              ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-auto pt-2">
          {isPast ? (
            <Link to="/scores">
              <BrutalistButton variant="solid" size="sm" fullWidth className="bg-blue-500 border-blue-700">
                <ExternalLink className="w-3.5 h-3.5" />
                View Scores
              </BrutalistButton>
            </Link>
          ) : (
            <BrutalistButton
              variant="solid"
              size="sm"
              fullWidth
              onClick={() => onRegister(show)}
            >
              <Plus className="w-3.5 h-3.5" />
              {myCorps.length > 0 ? 'Edit Registration' : 'Register Corps'}
            </BrutalistButton>
          )}
        </div>
      </div>
    </BrutalistCard>
  );
};

export default ShowCard;
