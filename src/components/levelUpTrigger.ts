// src/components/levelUpTrigger.ts
// Global event trigger for the level-up celebration. Kept out of
// LevelUpCelebration.tsx so that file only exports components, which keeps
// Vite's fast refresh working (react-refresh/only-export-components). The
// <LevelUpCelebrationContainer> listens for the 'level-up' event dispatched here.
// Usage: triggerLevelUp(5) or triggerLevelUp(5, 'A Class')

export const triggerLevelUp = (newLevel: number, classUnlocked?: string) => {
  const event = new CustomEvent('level-up', {
    detail: { newLevel, classUnlocked },
  });
  window.dispatchEvent(event);
};
