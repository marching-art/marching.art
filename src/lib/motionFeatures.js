// Lazy-loaded framer-motion feature bundle for LazyMotion.
//
// This module exists purely to give the bundler a dynamic-import boundary for
// domMax. MotionProvider cannot simply do `import('framer-motion')` for the
// features: that specifier is also statically imported (LazyMotion, m, etc.),
// so the bundler resolves both imports to the same eager module and the
// "lazy" load never splits. Re-exporting domMax from a separate file lets
// `import('../lib/motionFeatures')` produce a genuinely separate chunk that
// only loads after first paint.
export { domMax as default } from 'framer-motion';
