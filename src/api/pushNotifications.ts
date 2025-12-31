/**
 * Push Notification Service for marching.art
 * Handles Firebase Cloud Messaging (FCM) for push notifications
 */

import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { app, db } from './client';
import { doc, updateDoc } from 'firebase/firestore';
import { DATA_NAMESPACE } from './client';

// FCM configuration
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Singleton messaging instance
let messaging: Messaging | null = null;

/**
 * Check if push notifications are supported in this browser
 */
export function isPushSupported(): boolean {
  return (
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

/**
 * Get the messaging instance, initializing if needed
 */
function getMessagingInstance(): Messaging | null {
  if (!isPushSupported()) {
    console.warn('Push notifications are not supported in this browser');
    return null;
  }

  if (!messaging) {
    try {
      messaging = getMessaging(app);
    } catch (error) {
      console.error('Failed to initialize Firebase Messaging:', error);
      return null;
    }
  }

  return messaging;
}

/**
 * Request push notification permission and get FCM token
 * @returns The FCM token if successful, null otherwise
 */
export async function requestPushPermission(): Promise<string | null> {
  const messagingInstance = getMessagingInstance();
  if (!messagingInstance) {
    return null;
  }

  try {
    // Check current permission status
    const permission = Notification.permission;

    if (permission === 'denied') {
      console.warn('Push notification permission denied');
      return null;
    }

    // Request permission if not already granted
    if (permission !== 'granted') {
      const result = await Notification.requestPermission();
      if (result !== 'granted') {
        console.warn('Push notification permission not granted');
        return null;
      }
    }

    // Get the service worker registration
    const registration = await navigator.serviceWorker.ready;

    // Get the FCM token
    const token = await getToken(messagingInstance, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      console.log('FCM token obtained');
      return token;
    } else {
      console.warn('No FCM token available');
      return null;
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

/**
 * Save the FCM token to the user's profile
 * @param userId - The user's UID
 * @param token - The FCM token
 */
export async function saveFcmToken(userId: string, token: string): Promise<boolean> {
  try {
    const profileRef = doc(db, `artifacts/${DATA_NAMESPACE}/users/${userId}/profile/data`);
    await updateDoc(profileRef, {
      'settings.fcmToken': token,
      'settings.fcmTokenUpdatedAt': new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error('Error saving FCM token:', error);
    return false;
  }
}

/**
 * Remove the FCM token from the user's profile
 * @param userId - The user's UID
 */
export async function removeFcmToken(userId: string): Promise<boolean> {
  try {
    const profileRef = doc(db, `artifacts/${DATA_NAMESPACE}/users/${userId}/profile/data`);
    await updateDoc(profileRef, {
      'settings.fcmToken': null,
      'settings.fcmTokenUpdatedAt': new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error('Error removing FCM token:', error);
    return false;
  }
}

/**
 * Set up foreground message handler
 * @param callback - Function to call when a message is received
 */
export function onForegroundMessage(
  callback: (payload: {
    title?: string;
    body?: string;
    data?: Record<string, string>;
  }) => void
): (() => void) | null {
  const messagingInstance = getMessagingInstance();
  if (!messagingInstance) {
    return null;
  }

  return onMessage(messagingInstance, (payload) => {
    console.log('Foreground message received:', payload);
    callback({
      title: payload.notification?.title,
      body: payload.notification?.body,
      data: payload.data,
    });
  });
}

/**
 * Initialize push notifications for a user
 * Call this after the user logs in
 * @param userId - The user's UID
 */
export async function initializePushNotifications(userId: string): Promise<boolean> {
  if (!isPushSupported()) {
    return false;
  }

  // Check if we already have permission
  if (Notification.permission !== 'granted') {
    return false;
  }

  const token = await requestPushPermission();
  if (token) {
    return await saveFcmToken(userId, token);
  }

  return false;
}
