// Service Worker for marching.art Progressive Web App
// Provides offline support, caching, and improved performance

const APP_VERSION = '2.0.1';
const CACHE_NAME = `marching-art-v${APP_VERSION}`;
const RUNTIME_CACHE = `marching-art-runtime-v${APP_VERSION}`;
const IMAGE_CACHE = `marching-art-images-v${APP_VERSION}`;
const FONT_CACHE = `marching-art-fonts-v${APP_VERSION}`;

// Core app shell to precache immediately on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.svg',
  '/logo192.png',
  '/logo192.webp',
  '/logo192.svg',
  '/logo512.png',
  '/logo512.webp',
  '/logo512.svg'
];

// Cache strategies
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
  NETWORK_ONLY: 'network-only',
  CACHE_ONLY: 'cache-only'
};

// Route patterns and their strategies
const ROUTE_STRATEGIES = [
  // Static assets - cache first
  { pattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i, strategy: CACHE_STRATEGIES.CACHE_FIRST, cache: IMAGE_CACHE, maxAge: 30 * 24 * 60 * 60 * 1000 },
  { pattern: /\.(?:woff|woff2|ttf|otf|eot)$/i, strategy: CACHE_STRATEGIES.CACHE_FIRST, cache: FONT_CACHE, maxAge: 365 * 24 * 60 * 60 * 1000 },
  { pattern: /\.(?:js|css)$/i, strategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE, cache: RUNTIME_CACHE },

  // Google Fonts - cache first with long expiry
  { pattern: /^https:\/\/fonts\.googleapis\.com/, strategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE, cache: FONT_CACHE },
  { pattern: /^https:\/\/fonts\.gstatic\.com/, strategy: CACHE_STRATEGIES.CACHE_FIRST, cache: FONT_CACHE, maxAge: 365 * 24 * 60 * 60 * 1000 },

  // Firebase APIs - network first for data freshness
  { pattern: /^https:\/\/firestore\.googleapis\.com/, strategy: CACHE_STRATEGIES.NETWORK_FIRST, cache: RUNTIME_CACHE, timeout: 5000 },
  { pattern: /^https:\/\/.*\.firebaseapp\.com/, strategy: CACHE_STRATEGIES.NETWORK_FIRST, cache: RUNTIME_CACHE, timeout: 5000 },
  { pattern: /^https:\/\/.*\.firebase\.com/, strategy: CACHE_STRATEGIES.NETWORK_FIRST, cache: RUNTIME_CACHE, timeout: 5000 },

  // API routes - network first
  { pattern: /\/api\//, strategy: CACHE_STRATEGIES.NETWORK_FIRST, cache: RUNTIME_CACHE, timeout: 10000 }
];

// Install event - precache essential assets
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing version ${APP_VERSION}...`);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Precaching app shell');
        return Promise.allSettled(
          PRECACHE_URLS.map(url =>
            cache.add(url).catch(err => {
              console.warn(`[SW] Failed to cache ${url}:`, err.message);
              return null;
            })
          )
        );
      })
      .then(() => {
        console.log('[SW] Install complete, skipping waiting');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating version ${APP_VERSION}...`);

  const currentCaches = [CACHE_NAME, RUNTIME_CACHE, IMAGE_CACHE, FONT_CACHE];

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => !currentCaches.includes(cacheName))
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[SW] Claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache or network based on strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip Chrome extensions and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // Skip Firebase Cloud Functions entirely - let browser handle CORS
  // This includes callable functions which use POST with CORS preflight
  if (url.hostname.includes('cloudfunctions.net')) return;

  // Skip non-GET requests (POST, OPTIONS for CORS preflight, etc.)
  if (request.method !== 'GET') return;

  // Skip cross-origin requests that aren't in our strategy list
  const isKnownCrossOrigin = ROUTE_STRATEGIES.some(route =>
    route.pattern.test(url.href) && url.origin !== self.location.origin
  );

  if (url.origin !== self.location.origin && !isKnownCrossOrigin) return;

  // Get strategy for request
  const routeConfig = getRouteConfig(request);
  const strategy = routeConfig?.strategy || CACHE_STRATEGIES.NETWORK_FIRST;
  const cacheName = routeConfig?.cache || RUNTIME_CACHE;
  const timeout = routeConfig?.timeout || 10000;

  switch (strategy) {
    case CACHE_STRATEGIES.CACHE_FIRST:
      event.respondWith(cacheFirst(request, cacheName));
      break;
    case CACHE_STRATEGIES.NETWORK_FIRST:
      event.respondWith(networkFirst(request, cacheName, timeout));
      break;
    case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
      event.respondWith(staleWhileRevalidate(request, cacheName));
      break;
    case CACHE_STRATEGIES.NETWORK_ONLY:
      event.respondWith(fetch(request));
      break;
    case CACHE_STRATEGIES.CACHE_ONLY:
      event.respondWith(caches.match(request));
      break;
    default:
      event.respondWith(networkFirst(request, cacheName, timeout));
  }
});

// Get route configuration for a request
function getRouteConfig(request) {
  const url = new URL(request.url);
  return ROUTE_STRATEGIES.find(route => route.pattern.test(url.href));
}

// Cache First strategy - return cached response, fallback to network
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[SW] Cache-first fetch failed:', error.message);
    return createOfflineResponse();
  }
}

// Network First strategy with timeout - try network, fallback to cache
async function networkFirst(request, cacheName, timeout = 10000) {
  const cache = await caches.open(cacheName);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Network-first falling back to cache:', request.url);
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    // For navigation requests, return the cached index.html for SPA routing
    if (request.mode === 'navigate') {
      const indexCache = await caches.open(CACHE_NAME);
      const indexResponse = await indexCache.match('/index.html');
      if (indexResponse) {
        return indexResponse;
      }
    }

    return createOfflineResponse();
  }
}

// Stale While Revalidate - return cached immediately, update in background
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Fetch fresh copy in background
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch((error) => {
      console.log('[SW] Background fetch failed:', error.message);
      return null;
    });

  // Return cached immediately if available, otherwise wait for network
  return cached || fetchPromise || createOfflineResponse();
}

// Create offline fallback response
function createOfflineResponse() {
  return new Response(
    JSON.stringify({
      error: 'offline',
      message: 'You appear to be offline. Please check your connection.'
    }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
}

// Listen for messages from the client
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      console.log('[SW] Skip waiting requested');
      self.skipWaiting();
      break;

    case 'CLEAR_CACHE':
      console.log('[SW] Clear cache requested');
      event.waitUntil(
        caches.keys().then((cacheNames) =>
          Promise.all(cacheNames.map((name) => caches.delete(name)))
        )
      );
      break;

    case 'GET_VERSION':
      event.ports[0]?.postMessage({ version: APP_VERSION });
      break;

    case 'CACHE_URLS':
      if (payload?.urls) {
        event.waitUntil(
          caches.open(RUNTIME_CACHE).then((cache) =>
            Promise.allSettled(payload.urls.map((url) => cache.add(url)))
          )
        );
      }
      break;
  }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  switch (event.tag) {
    case 'sync-lineups':
      event.waitUntil(syncLineups());
      break;
    case 'sync-scores':
      event.waitUntil(syncScores());
      break;
  }
});

// Placeholder for syncing lineups when back online
async function syncLineups() {
  console.log('[SW] Syncing lineups...');
  // Implementation would sync pending lineup changes from IndexedDB to Firestore
}

// Placeholder for syncing scores when back online
async function syncScores() {
  console.log('[SW] Syncing scores...');
  // Implementation would fetch latest scores and update cache
}

// Push notification handling
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'New update from marching.art',
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'marching.art', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If a window is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});
