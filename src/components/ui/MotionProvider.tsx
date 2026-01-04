// src/components/ui/MotionProvider.tsx
// =============================================================================
// LAZY MOTION PROVIDER - Reduces Framer Motion bundle size by ~60%
// =============================================================================
// Uses LazyMotion with dynamically imported features to defer loading
// animation code until it's actually needed.
//
// This provider wraps the app and provides animation features on-demand,
// significantly reducing the initial JavaScript bundle size.

import React from 'react';
import { LazyMotion } from 'framer-motion';

// Dynamically import only the DOM animation features (excludes SVG, 3D, etc.)
// This reduces framer-motion's contribution to the bundle by ~60%
const loadFeatures = () =>
  import('framer-motion').then((mod) => mod.domAnimation);

interface MotionProviderProps {
  children: React.ReactNode;
}

/**
 * MotionProvider - Wrap your app with this to enable lazy-loaded animations
 *
 * Features included in domAnimation:
 * - animate, exit, initial props
 * - Variants
 * - AnimatePresence
 * - useAnimation hook
 * - Drag (basic)
 * - Layout animations
 *
 * NOT included (use domMax if needed):
 * - SVG animations
 * - Path animations
 * - 3D transforms
 */
export const MotionProvider: React.FC<MotionProviderProps> = ({ children }) => {
  return (
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  );
};

export default MotionProvider;
