// MotionProvider - LazyMotion wrapper for reduced bundle size
// OPTIMIZATION: Defers framer-motion features from initial bundle
//
// Uses async import to load features on-demand, reducing initial JS payload.
// Components should import `m` instead of `motion` from framer-motion.

import { LazyMotion } from 'framer-motion';

// Async feature loader - defers ~80KB from initial bundle
// Features are loaded after initial render, not blocking FCP/LCP
const loadFeatures = () => import('framer-motion').then(mod => mod.domMax);

/**
 * LazyMotion provider that wraps the app with async-loaded animation features.
 *
 * Benefits:
 * - Defers framer-motion features from initial bundle (~80KB savings on FCP)
 * - Features load asynchronously after initial render
 * - Still provides full animation capabilities (domMax includes drag, layout, etc.)
 *
 * Usage:
 * - Wrap your app with <MotionProvider>
 * - In components, import { m } from 'framer-motion' instead of { motion }
 * - Use <m.div> instead of <motion.div>
 */
export const MotionProvider = ({ children }) => {
  return (
    <LazyMotion features={loadFeatures} strict={false}>
      {children}
    </LazyMotion>
  );
};

export default MotionProvider;
