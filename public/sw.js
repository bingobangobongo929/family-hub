// Service Worker for Web Push Notifications
// This file must be at the root of the public directory

self.addEventListener('install', (event) => {
  console.log('[SW] Service worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Service worker activated');
  event.waitUntil(clients.claim());
});

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);

  let data = {
    title: 'Family Hub',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    data: {}
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        data: payload.data || {}
      };
    }
  } catch (e) {
    console.error('[SW] Error parsing push data:', e);
    // Try to get text if JSON fails
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    data: data.data,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    tag: data.data?.type || 'notification',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);

  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = '/';

  // Determine where to navigate based on notification type
  if (data.deep_link) {
    targetUrl = data.deep_link;
  } else if (data.type) {
    switch (data.type) {
      case 'f1_news':
      case 'f1_session_reminder':
      case 'f1_results':
        targetUrl = '/f1';
        break;
      case 'shopping_list_changes':
        targetUrl = '/shopping';
        break;
      case 'bin_reminder_evening':
      case 'bin_reminder_morning':
        targetUrl = '/bindicator';
        break;
      case 'event_reminder':
      case 'event_created':
      case 'event_changed':
      case 'event_deleted':
        targetUrl = '/calendar';
        break;
      case 'routine_reminder':
        targetUrl = '/routines';
        break;
      case 'chore_reminder':
        targetUrl = '/tasks';
        break;
    }
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to focus an existing window
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.navigate(targetUrl);
            return;
          }
        }
        // Open new window if none exists
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event);
});
