// =============================================================================
// ROUTE PREFETCHING UTILITY
// =============================================================================
// Prefetches route chunks on hover/focus for faster navigation
// Uses dynamic imports to load page chunks before user clicks

// Track which routes have been prefetched to avoid duplicate requests
const prefetchedRoutes = new Set<string>();

// Map of routes to their dynamic imports
const routeImports: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => import('../pages/Dashboard'),
  '/schedule': () => import('../pages/Schedule'),
  '/scores': () => import('../pages/Scores'),
  '/profile': () => import('../pages/Profile'),
  '/leagues': () => import('../pages/Leagues'),
  '/hall-of-champions': () => import('../pages/HallOfChampions'),
  '/admin': () => import('../pages/Admin'),
  '/retired-corps': () => import('../pages/RetiredCorpsGallery'),
  '/corps-history': () => import('../pages/CorpsHistory'),
  '/shop': () => import('../pages/Shop'),
  '/achievements': () => import('../pages/Achievements'),
  '/records': () => import('../pages/Records'),
  '/studio': () => import('../pages/Studio'),
  '/exchange': () => import('../pages/Exchange'),
  '/guide': () => import('../pages/HowToPlay'),
  '/updates': () => import('../pages/Updates'),
  '/install': () => import('../pages/InstallApp'),
};

/**
 * Prefetch a route's JavaScript chunk
 * Call this on mouseenter/focus to preload the page before navigation
 *
 * @param path - The route path to prefetch (e.g., '/dashboard')
 */
export function prefetchRoute(path: string): void {
  // Normalize path (remove trailing slash, handle dynamic segments)
  const normalizedPath = path.split('/').slice(0, 2).join('/') || path;

  // Skip if already prefetched
  if (prefetchedRoutes.has(normalizedPath)) {
    return;
  }

  // Find matching import
  const importFn = routeImports[normalizedPath];
  if (importFn) {
    prefetchedRoutes.add(normalizedPath);
    // Use requestIdleCallback if available, otherwise setTimeout
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        importFn().catch(() => {
          // Remove from set so it can be retried
          prefetchedRoutes.delete(normalizedPath);
        });
      });
    } else {
      setTimeout(() => {
        importFn().catch(() => {
          prefetchedRoutes.delete(normalizedPath);
        });
      }, 0);
    }
  }
}
