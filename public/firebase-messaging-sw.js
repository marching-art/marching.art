/**
 * Firebase Messaging Service Worker
 * Handles background push notifications for marching.art
 *
 * This file must be at the root of the public directory for FCM to work properly.
 */

// Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Firebase configuration - must match the app's config
// Note: These values are public and safe to include in client-side code
const firebaseConfig = {
  apiKey: "AIzaSyBWfqt58P36v-_B0M-D3DpxLFlOoEKXHxY",
  authDomain: "marching-art.firebaseapp.com",
  projectId: "marching-art",
  storageBucket: "marching-art.firebasestorage.app",
  messagingSenderId: "764429988123",
  appId: "1:764429988123:web:54ebad87f4e9f99e3e5c0b",
  measurementId: "G-X8NZ2M72LY"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Messaging
const messaging = firebase.messaging();

/**
 * Handle background messages
 * This runs when the app is in the background or closed
 */
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw] Background message received:', payload);

  const notificationTitle = payload.notification?.title || 'marching.art';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [100, 50, 100],
    data: {
      url: payload.data?.url || '/dashboard',
      ...payload.data,
    },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    tag: payload.data?.pushType || 'default',
    renotify: true,
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

/**
 * Handle notification clicks
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw] Notification click:', event);

  event.notification.close();

  // Handle dismiss action
  if (event.action === 'dismiss') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/dashboard';
  const fullUrl = new URL(urlToOpen, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(fullUrl);
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});

console.log('[firebase-messaging-sw] Service worker initialized');
