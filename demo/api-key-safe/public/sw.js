const CACHE_NAME = 'api-key-safe-v1';
const STABLE_ASSETS = ['/', '/manifest.json', '/icon.svg'];

// Install event - Cache core stable assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(STABLE_ASSETS);
            })
            .then(() => {
                return self.skipWaiting();
            })
    );
});

// Activate event - Clean up old cache versions
self.addEventListener('activate', event => {
    event.waitUntil(
        caches
            .keys()
            .then(keys => {
                return Promise.all(
                    keys.map(key => {
                        if (key !== CACHE_NAME) {
                            return caches.delete(key);
                        }
                    })
                );
            })
            .then(() => {
                return self.clients.claim();
            })
    );
});

// Fetch event - Stale-While-Revalidate caching for seamless offline-first experience
self.addEventListener('fetch', event => {
    // Only intercept local GET requests
    if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
        return;
    }

    // Bypass cache for dev tools and live-server queries (like hot module replacement queries)
    const url = new URL(event.request.url);
    if (url.pathname.includes('/@vite/') || url.pathname.includes('/node_modules/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request)
                .then(networkResponse => {
                    // Validate response before caching
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                })
                .catch(err => {
                    console.warn('Network fetch failed for service worker:', err);
                    return cachedResponse; // fallback to cache on network offline
                });

            return cachedResponse || fetchPromise;
        })
    );
});

// Receive message from parent to activate the waiting service worker immediately
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
