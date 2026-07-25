import {useEffect, useRef, useState} from 'react';

type UsePWAOptions = {
    /** Defaults to production builds only. */
    enabled?: boolean;
};

/**
 * Observes the registered service worker for updates.
 * Registration itself lives in `registerServiceWorker` (entry, production only).
 */
export function usePWA(options: UsePWAOptions = {}) {
    const enabled = options.enabled ?? import.meta.env.PROD;
    const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const waitingForActivationRef = useRef(false);

    useEffect(() => {
        if (!('serviceWorker' in navigator) || !enabled) {
            return;
        }

        const abort = new AbortController();
        const {signal} = abort;
        let refreshing = false;

        const checkForWaiting = (reg: ServiceWorkerRegistration) => {
            if (reg.waiting) {
                setUpdateAvailable(true);
            }
        };

        const bindRegistration = (reg: ServiceWorkerRegistration) => {
            if (signal.aborted) return;
            setSwRegistration(reg);
            checkForWaiting(reg);

            reg.addEventListener(
                'updatefound',
                () => {
                    const installingWorker = reg.installing;
                    if (!installingWorker) return;

                    installingWorker.addEventListener(
                        'statechange',
                        () => {
                            if (signal.aborted) return;
                            // A new worker finished installing while this page is already controlled.
                            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                setUpdateAvailable(true);
                            }
                        },
                        {signal}
                    );
                },
                {signal}
            );

            // Long-lived tabs: re-check when the user returns to the app.
            const requestUpdate = () => {
                if (document.visibilityState !== 'visible') return;
                void reg
                    .update()
                    .then(() => {
                        if (!signal.aborted) checkForWaiting(reg);
                    })
                    .catch(err => {
                        console.warn('PWA Service Worker update check failed:', err);
                    });
            };

            document.addEventListener('visibilitychange', requestUpdate, {signal});
            window.addEventListener('focus', requestUpdate, {signal});
            requestUpdate();
        };

        void navigator.serviceWorker.ready.then(bindRegistration).catch(err => {
            if (!signal.aborted) {
                console.warn('PWA Service Worker ready failed:', err);
            }
        });

        const onControllerChange = () => {
            // Ignore first-control claim; only reload after an explicit Upgrade.
            if (!waitingForActivationRef.current || refreshing) return;
            refreshing = true;
            window.location.reload();
        };
        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange, {signal});

        return () => {
            abort.abort();
        };
    }, [enabled]);

    const upgrade = () => {
        if (swRegistration?.waiting) {
            waitingForActivationRef.current = true;
            swRegistration.waiting.postMessage({type: 'SKIP_WAITING'});
        } else {
            window.location.reload();
        }
    };

    return {
        updateAvailable,
        upgrade,
        dismissUpdate: () => setUpdateAvailable(false)
    };
}
