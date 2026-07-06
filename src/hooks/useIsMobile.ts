// =============================================================================
// useIsMobile - shared viewport breakpoint hook
// =============================================================================
// matchMedia-based so components branching between mobile and desktop variants
// (bottom sheet vs centered modal, etc.) share one definition of "mobile".
// The initial value is read synchronously, so the first paint renders the
// correct variant — an ad-hoc resize listener starting at `false` flashes the
// desktop variant on phones for one frame.

import { useSyncExternalStore } from 'react';

// Matches Tailwind's `sm` breakpoint: below it we treat the viewport as mobile.
const MOBILE_QUERY = '(max-width: 639px)';

const getQuery = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(MOBILE_QUERY)
    : null;

const subscribe = (onStoreChange: () => void) => {
  const mql = getQuery();
  if (!mql) return () => {};
  mql.addEventListener('change', onStoreChange);
  return () => mql.removeEventListener('change', onStoreChange);
};

const getSnapshot = () => getQuery()?.matches ?? false;

// SSR/test environments without matchMedia render the desktop variant.
const getServerSnapshot = () => false;

export const useIsMobile = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

export default useIsMobile;
