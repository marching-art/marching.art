// TicketStub - Event card styled as a ticket/pass with perforated edges
// Features: Stamped effect for registered, dramatic open/closed states
import React from 'react';
import { m } from 'framer-motion';
import { MapPin, Lock, Music, Plus, ExternalLink, Zap, Check, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

const TicketStub = ({
  show,
  index,
  myCorps,
  formattedDate,
  isPast,
  onRegister,
  isWeekend = false
}) => {
  const isRegistered = myCorps.length > 0;
  const isLocked = show.locked || isPast;
  const isOpen = !isLocked;

  // Parse date parts
  const dateParts = formattedDate.split(' ');
  const dayOfWeek = dateParts[0] || '';
  const month = dateParts[1] || '';
  const dayNum = dateParts[2] || '';

  // Determine if this is a major event (regional/championship)
  const isMajorEvent = show.eventName?.toLowerCase().includes('regional') ||
                       show.eventName?.toLowerCase().includes('championship') ||
                       show.eventName?.toLowerCase().includes('finals') ||
                       isWeekend;

  return (
    <m.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: 'easeOut' }}
      className={`
        relative flex-shrink-0 flex
        ${isMajorEvent ? 'w-[320px] lg:w-[360px]' : 'w-[280px] lg:w-[300px]'}
        ${isLocked ? 'opacity-50' : ''}
        group
      `}
    >
      {/* Main Ticket Body */}
      <div className={`
        relative flex-1 flex overflow-hidden
        transition-all duration-300
        ${isOpen
          ? isRegistered
            ? 'bg-gradient-to-br from-gold-500/20 via-charcoal-900/90 to-charcoal-950 border-2 border-gold-500/40 shadow-[0_0_30px_rgba(234,179,8,0.2)]'
            : 'bg-gradient-to-br from-charcoal-800/90 via-charcoal-900/95 to-charcoal-950 border-2 border-gold-500/20 hover:border-gold-500/40 hover:shadow-[0_0_25px_rgba(234,179,8,0.15)]'
          : 'bg-charcoal-950/80 border-2 border-charcoal-800'
        }
      `}>
        {/* Stadium Light Overlay for Open Shows */}
        {isOpen && (
          <div className="absolute inset-0 bg-stadium-lights-subtle opacity-50 pointer-events-none" />
        )}

        {/* REGISTERED Stamp Overlay */}
        {isRegistered && isOpen && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-15deg]">
              <div className="px-6 py-2 border-4 border-gold-500/30">
                <span className="font-display font-black text-3xl text-gold-500/20 uppercase tracking-[0.2em]">
                  REGISTERED
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Left Section - Date Block */}
        <div className={`
          flex-shrink-0 w-20 lg:w-24 flex flex-col items-center justify-center p-3
          border-r-2 border-dashed
          ${isOpen
            ? isRegistered
              ? 'bg-gold-500/10 border-gold-500/30'
              : 'bg-charcoal-800/50 border-charcoal-700'
            : 'bg-charcoal-900/50 border-charcoal-800'
          }
        `}>
          <span className={`
            text-[10px] font-display font-bold uppercase tracking-wider
            ${isOpen ? 'text-gold-400' : 'text-cream/30'}
          `}>
            {dayOfWeek}
          </span>
          <span className={`
            text-3xl lg:text-4xl font-display font-black
            ${isOpen
              ? isRegistered
                ? 'text-gold-400 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]'
                : 'text-cream'
              : 'text-cream/30'
            }
          `}>
            {dayNum}
          </span>
          <span className={`
            text-xs font-display font-bold uppercase
            ${isOpen ? 'text-cream/60' : 'text-cream/20'}
          `}>
            {month}
          </span>

          {/* Major Event Star */}
          {isMajorEvent && isOpen && (
            <div className="mt-2">
              <Star className="w-4 h-4 text-gold-400 fill-gold-400 drop-shadow-[0_0_6px_rgba(234,179,8,0.6)]" />
            </div>
          )}
        </div>

        {/* Right Section - Event Details */}
        <div className="flex-1 flex flex-col p-4 min-w-0 relative z-10">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className={`
                font-display font-bold text-sm lg:text-base truncate
                ${isOpen ? 'text-cream' : 'text-cream/40'}
                ${isMajorEvent && isOpen ? 'text-gold-300' : ''}
              `}>
                {show.eventName || show.name}
              </h3>
              {show.location && (
                <div className={`
                  flex items-center gap-1 mt-1 text-xs truncate
                  ${isOpen ? 'text-cream/50' : 'text-cream/20'}
                `}>
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{show.location}</span>
                </div>
              )}
            </div>

            {/* Status Icon */}
            <div className={`
              w-10 h-10 flex items-center justify-center flex-shrink-0
              ${isLocked
                ? 'bg-charcoal-800 border border-charcoal-700'
                : isRegistered
                  ? 'bg-gold-500/20 border border-gold-500/40'
                  : 'bg-charcoal-800 border border-gold-500/20'
              }
            `}>
              {isLocked ? (
                <Lock className="w-5 h-5 text-cream/30" />
              ) : isRegistered ? (
                <Check className="w-5 h-5 text-gold-400 drop-shadow-[0_0_6px_rgba(234,179,8,0.5)]" />
              ) : (
                <Music className="w-5 h-5 text-gold-400/70" />
              )}
            </div>
          </div>

          {/* Status Badge */}
          <div className="mb-3">
            {isLocked ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-charcoal-800 text-cream/30 border border-charcoal-700">
                <Lock className="w-3 h-3" />
                {isPast ? 'Closed' : 'Locked'}
              </span>
            ) : (
              <span className={`
                inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider
                ${isRegistered
                  ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
                  : 'bg-green-500/20 text-green-400 border border-green-500/30 animate-pulse'
                }
              `}
              style={{ animationDuration: '3s' }}
              >
                {isRegistered ? (
                  <>
                    <Zap className="w-3 h-3" />
                    Registered
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-sm bg-green-400 animate-ping" style={{ animationDuration: '2s' }} />
                    Open
                  </>
                )}
              </span>
            )}
          </div>

          {/* Registered Corps */}
          {isRegistered && (
            <div className="mb-3 flex flex-wrap gap-1">
              {myCorps.slice(0, 2).map((corps, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 text-[10px] font-bold bg-gold-500/15 text-gold-300 border border-gold-500/25"
                >
                  {corps.corpsName.length > 12
                    ? corps.corpsName.substring(0, 12) + '...'
                    : corps.corpsName}
                </span>
              ))}
              {myCorps.length > 2 && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-gold-500/10 text-gold-400/70">
                  +{myCorps.length - 2}
                </span>
              )}
            </div>
          )}

          {/* Action Button */}
          <div className="mt-auto">
            {isPast ? (
              <Link to="/scores" className="block">
                <button className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold uppercase tracking-wide bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-all">
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Scores
                </button>
              </Link>
            ) : (
              <button
                onClick={() => onRegister(show)}
                disabled={isLocked}
                className={`
                  w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold uppercase tracking-wide transition-all
                  disabled:opacity-30 disabled:cursor-not-allowed
                  ${isRegistered
                    ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30 hover:bg-gold-500/30'
                    : 'bg-gradient-to-r from-gold-500 to-gold-600 text-charcoal-950 shadow-[0_0_15px_rgba(234,179,8,0.3)] hover:shadow-[0_0_25px_rgba(234,179,8,0.5)]'
                  }
                `}
              >
                <Plus className="w-3.5 h-3.5" />
                {isRegistered ? 'Edit Registration' : 'Register Corps'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Perforated Edge (Right Side) */}
      <div className={`
        w-4 flex flex-col items-center justify-center gap-1.5 py-3
        ${isOpen
          ? isRegistered
            ? 'bg-gold-500/10 border-y-2 border-r-2 border-gold-500/40'
            : 'bg-charcoal-800/50 border-y-2 border-r-2 border-gold-500/20 group-hover:border-gold-500/40'
          : 'bg-charcoal-900/50 border-y-2 border-r-2 border-charcoal-800'
        }
      `}>
        {/* Perforation Holes */}
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className={`
              w-2 h-2 rounded-sm
              ${isOpen
                ? isRegistered
                  ? 'bg-charcoal-950 border border-gold-500/20'
                  : 'bg-charcoal-950 border border-charcoal-700'
                : 'bg-charcoal-950 border border-charcoal-800'
              }
            `}
          />
        ))}
      </div>
    </m.div>
  );
};

export default TicketStub;
