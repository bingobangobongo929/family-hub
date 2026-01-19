// Web Push Notification utilities for browser-based push notifications

// Convert VAPID public key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Check if browser supports web push
export function isWebPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// Get current notification permission status
export function getWebPushPermission(): NotificationPermission | 'unsupported' {
  if (!isWebPushSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
}

// Request notification permission
export async function requestWebPushPermission(): Promise<NotificationPermission> {
  if (!isWebPushSupported()) {
    throw new Error('Web push not supported in this browser');
  }

  const permission = await Notification.requestPermission();
  return permission;
}

// Register service worker and subscribe to push
export async function subscribeToWebPush(vapidPublicKey: string): Promise<PushSubscription | null> {
  if (!isWebPushSupported()) {
    console.log('[WebPush] Not supported');
    return null;
  }

  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    console.log('[WebPush] Service worker registered:', registration.scope);

    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;
    console.log('[WebPush] Service worker ready');

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      console.log('[WebPush] Already subscribed:', subscription.endpoint.substring(0, 50));
      return subscription;
    }

    // Request permission if not granted
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('[WebPush] Permission denied');
        return null;
      }
    }

    // Subscribe to push
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    console.log('[WebPush] Subscribed:', subscription.endpoint.substring(0, 50));
    return subscription;

  } catch (error) {
    console.error('[WebPush] Subscription error:', error);
    throw error;
  }
}

// Unsubscribe from push
export async function unsubscribeFromWebPush(): Promise<boolean> {
  if (!isWebPushSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      console.log('[WebPush] Unsubscribed');
      return true;
    }

    return false;
  } catch (error) {
    console.error('[WebPush] Unsubscribe error:', error);
    return false;
  }
}

// Get current subscription
export async function getWebPushSubscription(): Promise<PushSubscription | null> {
  if (!isWebPushSupported()) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error('[WebPush] Error getting subscription:', error);
    return null;
  }
}

// Convert subscription to JSON for storage
export function subscriptionToJson(subscription: PushSubscription): {
  endpoint: string;
  keys: { p256dh: string; auth: string };
} {
  const json = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: json.keys?.p256dh || '',
      auth: json.keys?.auth || '',
    },
  };
}

// Show a local notification (for testing)
export async function showLocalNotification(title: string, options?: NotificationOptions): Promise<void> {
  if (!isWebPushSupported()) {
    throw new Error('Notifications not supported');
  }

  if (Notification.permission !== 'granted') {
    throw new Error('Notification permission not granted');
  }

  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(title, {
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    ...options,
  });
}
