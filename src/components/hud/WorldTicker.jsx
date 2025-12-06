// =============================================================================
// WORLD TICKER COMPONENT (Footer Marquee Zone)
// =============================================================================
// A scrolling marquee displaying live scores and events from the drum corps world.
// Mimics ESPN BottomLine or stock tickers - adds life to the simulation.
//
// Fixed at 32px height. Spans full width at bottom of viewport.

import React, { useState, useEffect, useRef } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { Trophy, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

// =============================================================================
// TICKER ITEM TYPES
// =============================================================================

/**
 * Score Item - Shows a corps score from a competition
 * Format: "[CORPS] 87.450 (+1.2) • [SHOW NAME]"
 */
const ScoreItem = ({ corps, score, change, showName }) => {
  const TrendIcon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
  const changeColor = change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-cream/40';

  return (
    <div className="flex items-center gap-3 px-4 whitespace-nowrap">
      <span className="text-xs font-display font-bold uppercase text-gold-400">
        {corps}
      </span>
      <span className="text-sm font-mono font-bold text-cream tabular-nums">
        {score.toFixed(3)}
      </span>
      {change !== 0 && (
        <span className={`flex items-center gap-0.5 text-xs font-mono ${changeColor}`}>
          <TrendIcon className="w-3 h-3" />
          {Math.abs(change).toFixed(1)}
        </span>
      )}
      {showName && (
        <>
          <span className="text-cream/20">•</span>
          <span className="text-xs text-cream/50 italic truncate max-w-[150px]">
            {showName}
          </span>
        </>
      )}
    </div>
  );
};

/**
 * Event Item - Shows an upcoming or live event
 * Format: "🔴 LIVE: [EVENT NAME] • [LOCATION]"
 */
const EventItem = ({ eventName, location, isLive }) => {
  return (
    <div className="flex items-center gap-2 px-4 whitespace-nowrap">
      {isLive ? (
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-bold uppercase text-red-400">LIVE</span>
        </span>
      ) : (
        <Zap className="w-3 h-3 text-gold-400" />
      )}
      <span className="text-xs font-display font-bold uppercase text-cream">
        {eventName}
      </span>
      {location && (
        <>
          <span className="text-cream/20">•</span>
          <span className="text-xs text-cream/50">
            {location}
          </span>
        </>
      )}
    </div>
  );
};

/**
 * Ranking Item - Shows a ranking change
 * Format: "[CORPS] moves to #3 in World Class"
 */
const RankingItem = ({ corps, rank, className }) => {
  return (
    <div className="flex items-center gap-2 px-4 whitespace-nowrap">
      <Trophy className="w-3 h-3 text-gold-400" />
      <span className="text-xs font-display font-bold uppercase text-gold-400">
        {corps}
      </span>
      <span className="text-xs text-cream/60">
        moves to
      </span>
      <span className="text-sm font-mono font-bold text-cream">
        #{rank}
      </span>
      <span className="text-xs text-cream/40">
        in {className}
      </span>
    </div>
  );
};

// =============================================================================
// TICKER SEPARATOR
// =============================================================================

const TickerSeparator = () => (
  <div className="flex items-center px-4">
    <span className="w-1 h-1 bg-gold-400/50 rounded-full" />
  </div>
);

// =============================================================================
// WORLD TICKER COMPONENT
// =============================================================================

const WorldTicker = ({ items = [], className = '' }) => {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const controls = useAnimationControls();
  const [contentWidth, setContentWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  // Calculate widths for animation
  useEffect(() => {
    if (contentRef.current && containerRef.current) {
      setContentWidth(contentRef.current.scrollWidth);
      setContainerWidth(containerRef.current.offsetWidth);
    }
  }, [items]);

  // Animate the ticker
  useEffect(() => {
    if (contentWidth > containerWidth) {
      const duration = contentWidth / 50; // Speed: 50px per second

      controls.start({
        x: [0, -contentWidth],
        transition: {
          duration,
          ease: 'linear',
          repeat: Infinity,
        },
      });
    }

    return () => controls.stop();
  }, [contentWidth, containerWidth, controls]);

  // Default items if none provided
  const tickerItems = items.length > 0 ? items : [
    { type: 'score', corps: 'Blue Devils', score: 97.125, change: 0.8, showName: 'Tempus Blue' },
    { type: 'score', corps: 'Carolina Crown', score: 96.800, change: 1.2, showName: 'King of Dreams' },
    { type: 'event', eventName: 'DCI Southwestern', location: 'San Antonio, TX', isLive: true },
    { type: 'score', corps: 'Bluecoats', score: 96.450, change: -0.3, showName: 'Lucy' },
    { type: 'ranking', corps: 'Santa Clara Vanguard', rank: 3, className: 'World Class' },
    { type: 'score', corps: 'Boston Crusaders', score: 95.900, change: 0.5, showName: 'YOUtopia' },
    { type: 'event', eventName: 'DCI Eastern Classic', location: 'Allentown, PA', isLive: false },
    { type: 'score', corps: 'The Cadets', score: 95.650, change: 0, showName: 'This I Believe' },
  ];

  // Render item based on type
  const renderItem = (item, index) => {
    switch (item.type) {
      case 'score':
        return (
          <ScoreItem
            key={`score-${index}`}
            corps={item.corps}
            score={item.score}
            change={item.change}
            showName={item.showName}
          />
        );
      case 'event':
        return (
          <EventItem
            key={`event-${index}`}
            eventName={item.eventName}
            location={item.location}
            isLive={item.isLive}
          />
        );
      case 'ranking':
        return (
          <RankingItem
            key={`ranking-${index}`}
            corps={item.corps}
            rank={item.rank}
            className={item.className}
          />
        );
      default:
        return null;
    }
  };

  return (
    <footer
      className={`
        flex items-center
        h-8 overflow-hidden
        bg-black/60 backdrop-blur-xl
        border-t border-white/5
        ${className}
      `}
      style={{ gridArea: 'ticker' }}
      ref={containerRef}
    >
      {/* Gradient fade left */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black/80 to-transparent z-10 pointer-events-none" />

      {/* Ticker content - duplicated for seamless loop */}
      <motion.div
        ref={contentRef}
        className="flex items-center"
        animate={controls}
      >
        {/* First set */}
        {tickerItems.map((item, index) => (
          <React.Fragment key={`a-${index}`}>
            {renderItem(item, index)}
            <TickerSeparator />
          </React.Fragment>
        ))}
        {/* Duplicate set for seamless loop */}
        {tickerItems.map((item, index) => (
          <React.Fragment key={`b-${index}`}>
            {renderItem(item, index)}
            <TickerSeparator />
          </React.Fragment>
        ))}
      </motion.div>

      {/* Gradient fade right */}
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black/80 to-transparent z-10 pointer-events-none" />
    </footer>
  );
};

export default WorldTicker;
