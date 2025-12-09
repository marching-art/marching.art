// =============================================================================
// HUD COMPONENTS INDEX
// =============================================================================
// Central export for all Game HUD components

export { BentoBox, BentoGrid, BentoHeader } from './BentoBox';
export { default as GlobalTicker } from './GlobalTicker';
export { default as WorldTicker } from './WorldTicker';

// Phase 2: Command Center Layout Components
export { default as ResourceHeader } from './ResourceHeader';
export {
  CommandCenterLayout,
  IntelligenceColumn,
  CommandColumn,
  LogisticsColumn,
  Panel,
} from './CommandCenterLayout';
