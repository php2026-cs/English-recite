/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

self.skipWaiting();
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/review/today';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        const existing = windowClients.find((client) => 'focus' in client);
        if (existing) {
          return existing.focus();
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title ?? '该复习单词了';
  const options = {
    body: data.body ?? '今天有释义等你复习。',
    tag: 'lightwords-review',
    data: { url: data.url ?? '/review/today' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
