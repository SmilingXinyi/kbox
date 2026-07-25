type RegisterServiceWorkerOptions = {
    /** Defaults to production builds only. */
    enabled?: boolean;
};

/**
 * Register the app service worker once per page load.
 * Safe to call from the entry module; registration is idempotent.
 */
export function registerServiceWorker(options: RegisterServiceWorkerOptions = {}) {
    const enabled = options.enabled ?? import.meta.env.PROD;
    if (!('serviceWorker' in navigator) || !enabled) {
        return;
    }

    const register = () => {
        void navigator.serviceWorker.register('/sw.js').catch(err => {
            console.warn('PWA Service Worker registration failed:', err);
        });
    };

    // Module scripts can finish after `load` in rare cases (bfcache restore / late entry).
    if (document.readyState === 'complete') {
        register();
    } else {
        window.addEventListener('load', register, {once: true});
    }
}
