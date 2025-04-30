import { precacheAndRoute } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST || []); // Soluciona el error en compilacion

self.addEventListener("install", (event) => {
    event.waitUntil(self.skipWaiting()); 
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim()); 
});

self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request);
        })
    );
});

self.addEventListener("message", (event) => {
    if (event.data === "skipWaiting") {
        self.skipWaiting();
    }
});