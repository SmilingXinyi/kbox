import {useEffect, useState} from 'react';

export function usePWA() {
    const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const [updateAvailable, setUpdateAvailable] = useState(false);

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('/sw.js')
                .then(reg => {
                    setSwRegistration(reg);

                    if (reg.waiting) {
                        setUpdateAvailable(true);
                    }

                    reg.addEventListener('updatefound', () => {
                        const installingWorker = reg.installing;
                        if (installingWorker) {
                            installingWorker.addEventListener('statechange', () => {
                                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    setUpdateAvailable(true);
                                }
                            });
                        }
                    });
                })
                .catch(err => {
                    console.warn('PWA Service Worker registration failed:', err);
                });

            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing) {
                    refreshing = true;
                    window.location.reload();
                }
            });
        }
    }, []);

    const upgrade = () => {
        if (swRegistration && swRegistration.waiting) {
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
