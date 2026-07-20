import {useEffect, useRef} from 'react';
import type {LockBehavior} from '../types/vault';

type UseAutoLockOptions = {
    enabled: boolean;
    lockBehavior: LockBehavior;
    onLock: () => void;
};

function delayForBehavior(behavior: LockBehavior): number | null {
    switch (behavior) {
        case 'once':
            return null;
        case 'always':
            return 5000;
        case 'delay-30s':
            return 30000;
        case 'delay-1m':
            return 60000;
        case 'delay-5m':
            return 300000;
        default:
            return null;
    }
}

export function useAutoLock({enabled, lockBehavior, onLock}: UseAutoLockOptions): void {
    const onLockRef = useRef(onLock);

    useEffect(() => {
        onLockRef.current = onLock;
    }, [onLock]);

    useEffect(() => {
        if (!enabled) return;

        let backgroundedAt = 0;
        let inactivityTimer: ReturnType<typeof setTimeout> | null = null;

        const triggerLock = () => {
            onLockRef.current();
        };

        const resetInactivityTimer = () => {
            if (inactivityTimer) clearTimeout(inactivityTimer);

            const delay = delayForBehavior(lockBehavior);
            if (delay === null) return;

            inactivityTimer = setTimeout(() => {
                triggerLock();
            }, delay);
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                backgroundedAt = Date.now();
                if (lockBehavior === 'always') {
                    triggerLock();
                }
            } else if (backgroundedAt > 0 && lockBehavior !== 'once') {
                const bgDuration = Date.now() - backgroundedAt;
                const maxBgDelay = delayForBehavior(lockBehavior) ?? 0;
                if (lockBehavior === 'always' || bgDuration >= maxBgDelay) {
                    triggerLock();
                }
                backgroundedAt = 0;
            }
        };

        const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const;
        for (const event of activityEvents) {
            window.addEventListener(event, resetInactivityTimer);
        }
        document.addEventListener('visibilitychange', handleVisibilityChange);
        resetInactivityTimer();

        return () => {
            if (inactivityTimer) clearTimeout(inactivityTimer);
            for (const event of activityEvents) {
                window.removeEventListener(event, resetInactivityTimer);
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [enabled, lockBehavior]);
}
