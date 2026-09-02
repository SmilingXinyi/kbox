// Bump this when caching strategy or shell assets change so old caches are dropped.
const CACHE_NAME = 'kbox-v8';
/** Resolve against the SW URL so project-site bases (e.g. /kbox/) work. */
const assetUrl = path => new URL(path, self.location).href;
const STABLE_ASSETS = [
    './',
    './manifest.json',
    './kbox.svg',
    './kbox.webp',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-192.png',
    './icons/icon-maskable-512.png',
    './icons/apple-touch-icon.png'
].map(assetUrl);

async function precacheStableAssets() {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(
        STABLE_ASSETS.map(async url => {
            try {
                const response = await fetch(url, {cache: 'reload'});
                if (response.ok) {
                    await cache.put(url, response);
                } else {
                    console.warn('Service worker precache skipped (non-OK):', url, response.status);
                }
            } catch (err) {
                console.warn('Service worker precache failed:', url, err);
            }
        })
    );
}

self.addEventListener('install', event => {
    // Do not skipWaiting here — the client prompts the user, then posts SKIP_WAITING.
    event.waitUntil(precacheStableAssets());
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches
            .keys()
            .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

function isNavigationRequest(request) {
    return request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
}

function isVersionedAsset(pathname) {
    // Vite hashed bundles under .../assets/ — safe to cache once fetched.
    return pathname.includes('/assets/');
}

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
        return;
    }

    const url = new URL(event.request.url);
    if (url.pathname.includes('/@vite/') || url.pathname.includes('/node_modules/')) {
        return;
    }

    // App shell / HTML: network-first so security fixes ship without a stale document.
    if (isNavigationRequest(event.request) || url.pathname.endsWith('.html')) {
        event.respondWith(
            fetch(event.request)
                .then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                    }
                    return networkResponse;
                })
                .catch(async () => {
                    const cached = await caches.match(event.request);
                    if (cached) return cached;
                    return caches.match(assetUrl('./'));
                })
        );
        return;
    }

    // Hashed static assets: cache-first after first network success.
    if (isVersionedAsset(url.pathname)) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) return cachedResponse;
                return fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                    }
                    return networkResponse;
                });
            })
        );
        return;
    }

    // Icons / manifest: stale-while-revalidate.
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request)
                .then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                    }
                    return networkResponse;
                })
                .catch(err => {
                    console.warn('Network fetch failed for service worker:', err);
                    return cachedResponse;
                });

            return cachedResponse || fetchPromise;
        })
    );
});

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
