// src/components/xpFeedbackTrigger.ts
// Global event triggers for the floating XP/CorpsCoin feedback. Kept out of
// XPFeedback.tsx so that file only exports components, which keeps Vite's fast
// refresh working (react-refresh/only-export-components). The
// <XPFeedbackContainer> listens for the 'xp-feedback' event dispatched here.
// Usage: triggerXPFeedback(100, 'xp') or triggerXPFeedback(50, 'coin')

export const triggerXPFeedback = (amount: number, type: 'xp' | 'coin' = 'xp', message?: string) => {
  const event = new CustomEvent('xp-feedback', {
    detail: { amount, type, message },
  });
  window.dispatchEvent(event);
};

// Convenience helpers
export const showXPGain = (amount: number, message?: string) =>
  triggerXPFeedback(amount, 'xp', message);
export const showCoinGain = (amount: number, message?: string) =>
  triggerXPFeedback(amount, 'coin', message);
