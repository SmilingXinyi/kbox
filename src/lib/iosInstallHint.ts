/** iOS Safari Home Screen install hint: UA detection + versioned localStorage. */

export const IOS_INSTALL_HINT_STORAGE_KEY = 'kbox:ios-install-hint:v1';

export type DisplayProbe = {
    userAgent: string;
    platform: string;
    maxTouchPoints: number;
    standalone: boolean;
    displayModeStandalone: boolean;
    displayModeFullscreen: boolean;
};

const IOS_BROWSER_UA = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\//i;
const SAFARI_UA = /Version\/[\d.]+/i;
const SAFARI_TOKEN = /Safari\//i;
const CLASSIC_IOS_UA = /iPad|iPhone|iPod/i;

export function readDisplayProbe(): DisplayProbe {
    const nav = window.navigator as Navigator & {standalone?: boolean};
    return {
        userAgent: nav.userAgent,
        platform: nav.platform,
        maxTouchPoints: nav.maxTouchPoints ?? 0,
        standalone: nav.standalone === true,
        displayModeStandalone: window.matchMedia('(display-mode: standalone)').matches,
        displayModeFullscreen: window.matchMedia('(display-mode: fullscreen)').matches
    };
}

export function isIosDevice(probe: DisplayProbe): boolean {
    if (CLASSIC_IOS_UA.test(probe.userAgent)) return true;
    // iPadOS 13+ reports as Macintosh with a touch screen.
    return probe.platform === 'MacIntel' && probe.maxTouchPoints > 1;
}

export function isIpad(probe: DisplayProbe): boolean {
    if (/iPad/i.test(probe.userAgent)) return true;
    return probe.platform === 'MacIntel' && probe.maxTouchPoints > 1;
}

export function isIosSafari(probe: DisplayProbe): boolean {
    if (!isIosDevice(probe)) return false;
    if (IOS_BROWSER_UA.test(probe.userAgent)) return false;
    return SAFARI_UA.test(probe.userAgent) && SAFARI_TOKEN.test(probe.userAgent);
}

export function isStandalonePwa(probe: DisplayProbe): boolean {
    return probe.standalone || probe.displayModeStandalone || probe.displayModeFullscreen;
}

export function shouldShowIosInstallHint(probe: DisplayProbe, neverShow: boolean): boolean {
    if (neverShow) return false;
    if (isStandalonePwa(probe)) return false;
    return isIosSafari(probe);
}

function isNeverShowRecord(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) return false;
    return (value as {neverShow?: unknown}).neverShow === true;
}

export function isIosInstallHintNeverShow(): boolean {
    try {
        const raw = localStorage.getItem(IOS_INSTALL_HINT_STORAGE_KEY);
        if (!raw) return false;
        return isNeverShowRecord(JSON.parse(raw) as unknown);
    } catch {
        return false;
    }
}

export function persistIosInstallHintNeverShow(): void {
    try {
        localStorage.setItem(IOS_INSTALL_HINT_STORAGE_KEY, JSON.stringify({neverShow: true}));
    } catch {
        // Incognito, quota exceeded, or storage disabled.
    }
}
