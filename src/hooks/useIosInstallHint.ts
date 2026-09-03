import {useState} from 'react';
import {
    isIosInstallHintNeverShow,
    isIpad,
    persistIosInstallHintNeverShow,
    readDisplayProbe,
    shouldShowIosInstallHint,
    type DisplayProbe
} from '../lib/iosInstallHint';

type UseIosInstallHintOptions = {
    probe?: DisplayProbe;
};

function isDevForceHint(): boolean {
    if (!import.meta.env.DEV) return false;
    try {
        return new URLSearchParams(window.location.search).get('ios-install-hint') === '1';
    } catch {
        return false;
    }
}

export function useIosInstallHint(options: UseIosInstallHintOptions = {}) {
    const probe = options.probe ?? readDisplayProbe();
    const [neverShow, setNeverShow] = useState(isIosInstallHintNeverShow);
    const [sessionHidden, setSessionHidden] = useState(false);

    const eligible = isDevForceHint()
        ? !neverShow && !probe.standalone && !probe.displayModeStandalone && !probe.displayModeFullscreen
        : shouldShowIosInstallHint(probe, neverShow);
    const visible = eligible && !sessionHidden;

    const dismissForSession = () => {
        setSessionHidden(true);
    };

    const dismissForever = () => {
        persistIosInstallHintNeverShow();
        setNeverShow(true);
        setSessionHidden(true);
    };

    return {
        visible,
        isIpad: isIpad(probe),
        dismissForSession,
        dismissForever
    };
}
