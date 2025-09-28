// Service Worker for marching.art PWA
const CACHE_NAME = 'marching-art-v1.0.0';
const STATIC_CACHE_NAME = 'marching-art-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'marching-art-dynamic-v1.0.0';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('SW: Installing service worker');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('SW: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch((error) => {
        console.error('SW: Failed to cache static assets:', error);
      })
  );
  
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('SW: Activating service worker');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old cache versions
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME &&
                cacheName.startsWith('marching-art-')) {
              console.log('SW: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
  );
  
  // Take control of all clients immediately
  return self.clients.claim();
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip Chrome extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Skip Firebase and external API requests for real-time data
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('googleapis') ||
      url.hostname.includes('google.com')) {
    
    // Network first for Firebase/API requests
    event.respondWith(
      fetch(request)
        .catch(() => {
          // Return offline page for navigation requests
          if (request.mode === 'navigate') {
            return caches.match('/offline.html') || caches.match('/');
          }
        })
    );
    return;
  }
  
  // Handle navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(request)
            .then((response) => {
              // Clone the response before caching
              const responseClone = response.clone();
              
              caches.open(DYNAMIC_CACHE_NAME)
                .then((cache) => {
                  cache.put(request, responseClone);
                });
              
              return response;
            })
            .catch(() => {
              // Return cached homepage or offline page
              return caches.match('/') || caches.match('/offline.html');
            });
        })
    );
    return;
  }
  
  // Handle static assets (CSS, JS, images)
  if (request.destination === 'script' || 
      request.destination === 'style' ||
      request.destination === 'image') {
    
    // Cache first strategy for static assets
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(request)
            .then((response) => {
              // Only cache successful responses
              if (response.status === 200) {
                const responseClone = response.clone();
                
                caches.open(STATIC_CACHE_NAME)
                  .then((cache) => {
                    cache.put(request, responseClone);
                  });
              }
              
              return response;
            })
            .catch(() => {
              // Return placeholder for images if offline
              if (request.destination === 'image') {
                return new Response(
                  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#F7941D"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-family="sans-serif" font-size="16">🎺</text></svg>',
                  { headers: { 'Content-Type': 'image/svg+xml' } }
                );
              }
            });
        })
    );
    return;
  }
  
  // Default: network first, cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        const responseClone = response.clone();
        
        caches.open(DYNAMIC_CACHE_NAME)
          .then((cache) => {
            cache.put(request, responseClone);
          });
        
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('SW: Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle offline actions when back online
      syncOfflineActions()
    );
  }
});

// Push notification handling
self.addEventListener('push', (event) => {
  console.log('SW: Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'New update available!',
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View',
        icon: '/logo192.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/logo192.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('marching.art', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('SW: Notification click received');
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Utility functions
async function syncOfflineActions() {
  try {
    // Implement offline action synchronization here
    console.log('SW: Syncing offline actions');
    
    // Example: sync offline form submissions, votes, etc.
    const offlineActions = await getOfflineActions();
    
    for (const action of offlineActions) {
      try {
        await submitAction(action);
        await removeOfflineAction(action.id);
      } catch (error) {
        console.error('SW: Failed to sync action:', error);
      }
    }
  } catch (error) {
    console.error('SW: Background sync failed:', error);
  }
}

async function getOfflineActions() {
  // Retrieve offline actions from IndexedDB
  return [];
}

async function submitAction(action) {
  // Submit action to server
  return fetch('/api/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(action)
  });
}

async function removeOfflineAction(actionId) {
  // Remove synced action from IndexedDB
  console.log('SW: Removing synced action:', actionId);
}

// Message handling for communication with main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'content-sync') {
    event.waitUntil(
      // Sync latest scores, leaderboards, etc.
      syncLatestContent()
    );
  }
});

async function syncLatestContent() {
  try {
    console.log('SW: Syncing latest content');
    
    // Fetch and cache latest leaderboard data
    const leaderboardResponse = await fetch('/api/leaderboard');
    if (leaderboardResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      await cache.put('/api/leaderboard', leaderboardResponse);
    }
    
    // Fetch and cache latest scores
    const scoresResponse = await fetch('/api/scores/latest');
    if (scoresResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      await cache.put('/api/scores/latest', scoresResponse);
    }
  } catch (error) {
    console.error('SW: Failed to sync latest content:', error);
  }
}