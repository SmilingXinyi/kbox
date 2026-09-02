/**
 * Safari (in-browser) is fine: the toolbar already sits below the page, so
 * screen − viewport cancels env(safe-area-inset-bottom).
 *
 * iOS home-screen PWAs (`navigator.standalone` / display-mode: standalone) use
 * a WKWebView that is already letterboxed above the home indicator, while
 * env(safe-area-inset-bottom) still reports 34px (or ~83px with phantom chrome).
 * Padding by that value stacks a second gap. Skip the bottom inset there.
 *
 * Remaining inset = clamped CSS inset minus the strip already outside this viewport,
 * then forced to 0 on iOS standalone.
 */

/** Typical iPhone home-indicator height (CSS px). */
export const IOS_HOME_INDICATOR_PX = 34;

/** Insets at or above this are treated as indicator + browser chrome. */
const INFLATED_BOTTOM_INSET_PX = 50;

type NavigatorWithStandalone = Navigator & {standalone?: boolean};

export function isIosDevice(): boolean {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

export function isStandaloneDisplay(): boolean {
    const nav = navigator as NavigatorWithStandalone;
    if (nav.standalone === true) return true;
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches
    );
}

export function isIosStandalonePwa(): boolean {
    return isIosDevice() && isStandaloneDisplay();
}

export function clampReportedBottomInset(cssBottom: number): number {
    return cssBottom >= INFLATED_BOTTOM_INSET_PX ? IOS_HOME_INDICATOR_PX : cssBottom;
}

export function remainingSafeBottomPx(input: {
    cssTop: number;
    cssBottom: number;
    viewportHeight: number;
    screenHeight: number;
    iosStandalone?: boolean;
}): number {
    if (input.iosStandalone) return 0;
    const cssBottom = clampReportedBottomInset(input.cssBottom);
    if (cssBottom <= 0) return 0;
    // Screen-minus-viewport is the strip already outside this viewport.
    // Do not subtract cssTop: the status bar sits above the viewport, so
    // subtracting it cancels a real bottom shortfall (34 − (932−898−59) = 34).
    const alreadyOutsideBottom = Math.max(0, input.screenHeight - input.viewportHeight);
    return Math.max(0, cssBottom - alreadyOutsideBottom);
}

export function screenHeightCssPx(): number {
    const {width, height} = window.screen;
    return window.innerWidth > window.innerHeight ? Math.min(width, height) : Math.max(width, height);
}

function readEnvInset(edge: 'top' | 'bottom'): number {
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;padding-${edge}:env(safe-area-inset-${edge},0px)`;
    document.documentElement.appendChild(el);
    void el.offsetHeight;
    const value = parseFloat(getComputedStyle(el).getPropertyValue(`padding-${edge}`)) || 0;
    el.remove();
    return value;
}

export function syncSafeAreaBottom(): void {
    const cssTop = readEnvInset('top');
    const cssBottom = readEnvInset('bottom');
    const vvHeight = window.visualViewport?.height ?? window.innerHeight;
    const viewportHeight = Math.min(window.innerHeight, vvHeight);
    const remaining = remainingSafeBottomPx({
        cssTop,
        cssBottom,
        viewportHeight,
        screenHeight: screenHeightCssPx(),
        iosStandalone: isIosStandalonePwa()
    });
    document.documentElement.style.setProperty('--safe-bottom', `${remaining}px`);
}

/** Bind once at app startup. Updates on rotate, URL-bar collapse, and keyboard. */
export function bindSafeAreaSync(): () => void {
    syncSafeAreaBottom();
    const onChange = () => syncSafeAreaBottom();
    const vv = window.visualViewport;
    const standaloneMq = window.matchMedia('(display-mode: standalone)');
    const fullscreenMq = window.matchMedia('(display-mode: fullscreen)');
    vv?.addEventListener('resize', onChange);
    vv?.addEventListener('scroll', onChange);
    window.addEventListener('resize', onChange);
    window.addEventListener('orientationchange', onChange);
    standaloneMq.addEventListener('change', onChange);
    fullscreenMq.addEventListener('change', onChange);
    return () => {
        vv?.removeEventListener('resize', onChange);
        vv?.removeEventListener('scroll', onChange);
        window.removeEventListener('resize', onChange);
        window.removeEventListener('orientationchange', onChange);
        standaloneMq.removeEventListener('change', onChange);
        fullscreenMq.removeEventListener('change', onChange);
    };
}
