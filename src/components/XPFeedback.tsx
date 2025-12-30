// =============================================================================
// XP FEEDBACK - Global floating XP/CC gain animation
// =============================================================================
// Displays prominent floating feedback when XP or CorpsCoin is gained
// Usage: triggerXPFeedback(100, 'xp') or triggerXPFeedback(50, 'coin')

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Coins } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface FeedbackItem {
  id: string;
  type: 'xp' | 'coin';
  amount: number;
  message?: string;
}

// =============================================================================
// GLOBAL EVENT SYSTEM
// =============================================================================

export const triggerXPFeedback = (amount: number, type: 'xp' | 'coin' = 'xp', message?: string) => {
  const event = new CustomEvent('xp-feedback', {
    detail: { amount, type, message },
  });
  window.dispatchEvent(event);
};

// Convenience helpers
export const showXPGain = (amount: number, message?: string) => triggerXPFeedback(amount, 'xp', message);
export const showCoinGain = (amount: number, message?: string) => triggerXPFeedback(amount, 'coin', message);

// =============================================================================
// FEEDBACK ITEM COMPONENT
// =============================================================================

const FeedbackItemComponent: React.FC<{ item: FeedbackItem; onComplete: () => void }> = ({
  item,
  onComplete,
}) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const isXP = item.type === 'xp';
  const Icon = isXP ? TrendingUp : Coins;
  const colorClass = isXP ? 'text-blue-400' : 'text-gold-400';
  const bgClass = isXP ? 'bg-blue-500/20 border-blue-500/40' : 'bg-gold-500/20 border-gold-500/40';
  const glowColor = isXP ? 'rgba(59,130,246,0.6)' : 'rgba(234,179,8,0.6)';
  const label = isXP ? 'XP' : 'CC';

  return (
    <motion.div
      className="fixed top-20 left-1/2 z-[200] pointer-events-none"
      initial={{ opacity: 0, y: 20, x: '-50%', scale: 0.8 }}
      animate={{
        opacity: [0, 1, 1, 0],
        y: [20, 0, -10, -30],
        x: '-50%',
        scale: [0.8, 1.1, 1, 0.9],
      }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 2.5, times: [0, 0.15, 0.7, 1] }}
    >
      <div
        className={`flex items-center gap-3 px-5 py-3 rounded-lg border ${bgClass} backdrop-blur-sm`}
        style={{ boxShadow: `0 0 20px ${glowColor}` }}
      >
        <Icon className={`w-6 h-6 ${colorClass}`} />
        <div className="flex flex-col">
          <span className={`text-2xl font-bold ${colorClass} tabular-nums`}>
            +{item.amount.toLocaleString()} {label}
          </span>
          {item.message && (
            <span className="text-xs text-gray-400">{item.message}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// =============================================================================
// CONTAINER COMPONENT
// =============================================================================

export const XPFeedbackContainer: React.FC = () => {
  const [items, setItems] = useState<FeedbackItem[]>([]);

  useEffect(() => {
    const handleFeedback = (event: CustomEvent<{ amount: number; type: 'xp' | 'coin'; message?: string }>) => {
      const { amount, type, message } = event.detail;
      const newItem: FeedbackItem = {
        id: `${type}-${Date.now()}-${Math.random()}`,
        type,
        amount,
        message,
      };
      setItems((prev) => [...prev, newItem]);
    };

    window.addEventListener('xp-feedback', handleFeedback as EventListener);
    return () => window.removeEventListener('xp-feedback', handleFeedback as EventListener);
  }, []);

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <AnimatePresence>
      {items.map((item) => (
        <FeedbackItemComponent
          key={item.id}
          item={item}
          onComplete={() => removeItem(item.id)}
        />
      ))}
    </AnimatePresence>
  );
};

export default XPFeedbackContainer;
