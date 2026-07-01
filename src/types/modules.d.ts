// Ambient module declarations for packages without bundled TypeScript types.
// canvas-confetti is installed but ships no types; react-helmet-async is only
// referenced by the (currently unused) SEO component.
declare module 'canvas-confetti';
declare module 'react-helmet-async';
