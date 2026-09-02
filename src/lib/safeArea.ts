/**
 * --safe-bottom is the extra bottom inset still inside the layout viewport.
 *
 * remaining = max(0, inset − alreadyOutside)
 *
 * - inset: env(safe-area-inset-bottom), with phantom Safari chrome (~83px) capped
 *   to the home-indicator height
 * - alreadyOutside: screen − viewport, i.e. chrome already below the page
 * - iOS home-screen PWA: WKWebView is letterboxed above the home indicator, but
 *   the viewport often still reports full screen, so treat inset as already outside
 *
 * Top inset stays in CSS (env(safe-area-inset-top) on .safe-pt). It is independent.
 */

const HOME_INDICATOR_PX = 34;
/** Values at or above this include browser chrome, not in-page padding. */
const PHANTOM_CHROME_INSET_PX = 50;

type NavigatorWithStandalone = Navigator & {standalone?: boolean};

function isIosStandalonePwa(): boolean {
    const ios =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!ios) return false;
    const nav = navigator as NavigatorWithStandalone;
    return (
        nav.standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches
    );
}

export function remainingSafeBottomPx(input: {
    cssBottom: number;
    viewportHeight: number;
    screenHeight: number;
    iosStandalone?: boolean;
}): number {
    const inset = input.cssBottom >= PHANTOM_CHROME_INSET_PX ? HOME_INDICATOR_PX : input.cssBottom;
    if (inset <= 0) return 0;
    const viewportGap = Math.max(0, input.screenHeight - input.viewportHeight);
    const alreadyOutside = input.iosStandalone ? Math.max(viewportGap, inset) : viewportGap;
    return Math.max(0, inset - alreadyOutside);
}

function screenHeightCssPx(): number {
    const {width, height} = window.screen;
    return window.innerWidth > window.innerHeight ? Math.min(width, height) : Math.max(width, height);
}

function readEnvBottomInset(): number {
    const el = document.createElement('div');
    el.style.cssText =
        'position:absolute;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom,0px)';
    document.documentElement.appendChild(el);
    void el.offsetHeight;
    const value = parseFloat(getComputedStyle(el).paddingBottom) || 0;
    el.remove();
    return value;
}

function syncSafeAreaBottom(): void {
    const vvHeight = window.visualViewport?.height ?? window.innerHeight;
    const remaining = remainingSafeBottomPx({
        cssBottom: readEnvBottomInset(),
        viewportHeight: Math.min(window.innerHeight, vvHeight),
        screenHeight: screenHeightCssPx(),
        iosStandalone: isIosStandalonePwa()
    });
    document.documentElement.style.setProperty('--safe-bottom', `${remaining}px`);
}

/** Bind once at app startup. Updates on rotate, URL-bar collapse, keyboard, and display-mode. */
export function bindSafeAreaSync(): () => void {
    syncSafeAreaBottom();
    const onChange = () => syncSafeAreaBottom();
    const ac = new AbortController();
    const {signal} = ac;
    const vv = window.visualViewport;
    vv?.addEventListener('resize', onChange, {signal});
    vv?.addEventListener('scroll', onChange, {signal});
    window.addEventListener('resize', onChange, {signal});
    window.addEventListener('orientationchange', onChange, {signal});
    window.matchMedia('(display-mode: standalone)').addEventListener('change', onChange, {signal});
    window.matchMedia('(display-mode: fullscreen)').addEventListener('change', onChange, {signal});
    return () => ac.abort();
}
