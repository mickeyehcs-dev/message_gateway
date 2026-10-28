/**
 * Browser Service Worker script for Web Push Notifications
 */

export function renderServiceWorkerJs() {
  return `/**
 * Universal Notification Gateway - Browser Push Notification Service Worker
 */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: 'Universal Notification Gateway',
        message: event.data.text()
      };
    }
  }

  const title = data.title || 'Alert Notification';
  const options = {
    body: data.message || data.body || '',
    icon: data.icon || '/favicon.ico',
    badge: data.badge || undefined,
    image: data.image || undefined,
    data: {
      url: data.click_url || data.url || '/'
    },
    tag: data.tag || undefined,
    requireInteraction: data.requireInteraction === true,
    silent: data.silent === true,
    vibrate: data.vibrate || [100, 50, 100],
    actions: Array.isArray(data.actions) ? data.actions : []
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
`;
}
