// =============================================================================
// WORLD TICKER COMPONENT (Footer Marquee Zone)
// =============================================================================
// A scrolling marquee displaying historical DCI scores from the previous day.
// Mimics ESPN BottomLine or stock tickers - adds life to the simulation.
//
// Fixed at 32px height. Spans full width at bottom of viewport.

import React, { useState, useEffect, useRef } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { Trophy, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useSeasonStore } from '../../store/seasonStore';
import { getSeasonProgress } from '../../hooks/useSeason';

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
  const [historicalItems, setHistoricalItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Get season data from store
  const seasonData = useSeasonStore((state) => state.seasonData);
  const { currentDay } = seasonData ? getSeasonProgress(seasonData) : { currentDay: 1 };
  const previousDay = currentDay - 1;

  // Fetch historical DCI scores from the previous day
  useEffect(() => {
    const fetchHistoricalScores = async () => {
      if (!seasonData?.dataDocId || previousDay < 1) {
        setLoading(false);
        return;
      }

      try {
        // 1. Get corps data to find source years
        const corpsDataDoc = await getDoc(doc(db, `dci-data/${seasonData.dataDocId}`));
        if (!corpsDataDoc.exists()) {
          setLoading(false);
          return;
        }

        const corpsData = corpsDataDoc.data();
        const corpsValues = corpsData.corpsValues || [];
        const yearsToFetch = [...new Set(corpsValues.map(c => c.sourceYear))];

        // 2. Fetch historical scores for each year
        const historicalPromises = yearsToFetch.map(year =>
          getDoc(doc(db, `historical_scores/${year}`))
        );
        const historicalDocs = await Promise.all(historicalPromises);

        // 3. Find scores and events for the previous day
        const tickerData = [];
        let eventInfo = null;

        historicalDocs.forEach((docSnap) => {
          if (docSnap.exists()) {
            const yearData = docSnap.data().data || [];
            yearData.forEach(event => {
              if (event.offSeasonDay === previousDay && event.scores) {
                // Store event info
                if (!eventInfo) {
                  eventInfo = {
                    type: 'event',
                    eventName: event.eventName,
                    location: event.location,
                    isLive: false
                  };
                }
                // Add scores
                event.scores.forEach(score => {
                  tickerData.push({
                    type: 'score',
                    corps: score.corps,
                    score: score.score || 0,
                    change: 0,
                    showName: null
                  });
                });
              }
            });
          }
        });

        // Sort by score descending
        tickerData.sort((a, b) => b.score - a.score);

        // Build final items array with event interspersed
        const finalItems = [];
        if (eventInfo) {
          finalItems.push(eventInfo);
        }
        tickerData.forEach((item, idx) => {
          finalItems.push(item);
          // Add event reminder every 5 scores
          if (eventInfo && (idx + 1) % 5 === 0 && idx < tickerData.length - 1) {
            finalItems.push({ ...eventInfo });
          }
        });

        setHistoricalItems(finalItems);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching historical scores for ticker:', err);
        setLoading(false);
      }
    };

    fetchHistoricalScores();
  }, [seasonData?.dataDocId, previousDay]);

  // Use historical items if available, otherwise use provided items or fallback
  const tickerItems = historicalItems.length > 0 ? historicalItems : (items.length > 0 ? items : [
    { type: 'event', eventName: 'Loading DCI Scores...', location: '', isLive: false }
  ]);

  // Calculate widths for animation
  useEffect(() => {
    if (contentRef.current && containerRef.current) {
      setContentWidth(contentRef.current.scrollWidth);
      setContainerWidth(containerRef.current.offsetWidth);
    }
  }, [tickerItems]);

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
