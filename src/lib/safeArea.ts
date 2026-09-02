/**
 * iOS with viewport-fit=cover often reports env(safe-area-inset-bottom)
 * against the physical screen, while the layout/visual viewport already
 * excludes that strip ("lying viewport"). Padding by the raw env() value
 * then reserves the home indicator twice.
 *
 * Safari / iOS 26 can also inflate the bottom inset to ~83px (home indicator
 * + browser chrome) even in a standalone PWA. Cap that to the indicator.
 *
 * Remaining inset = clamped CSS inset minus the strip already outside this viewport.
 */

/** Typical iPhone home-indicator height (CSS px). */
export const IOS_HOME_INDICATOR_PX = 34;

/** Insets at or above this are treated as indicator + browser chrome. */
const INFLATED_BOTTOM_INSET_PX = 50;

export function clampReportedBottomInset(cssBottom: number): number {
    return cssBottom >= INFLATED_BOTTOM_INSET_PX ? IOS_HOME_INDICATOR_PX : cssBottom;
}

export function remainingSafeBottomPx(input: {
    cssTop: number;
    cssBottom: number;
    viewportHeight: number;
    screenHeight: number;
}): number {
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
        screenHeight: screenHeightCssPx()
    });
    document.documentElement.style.setProperty('--safe-bottom', `${remaining}px`);
}

/** Bind once at app startup. Updates on rotate, URL-bar collapse, and keyboard. */
export function bindSafeAreaSync(): () => void {
    syncSafeAreaBottom();
    const onChange = () => syncSafeAreaBottom();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', onChange);
    vv?.addEventListener('scroll', onChange);
    window.addEventListener('resize', onChange);
    window.addEventListener('orientationchange', onChange);
    return () => {
        vv?.removeEventListener('resize', onChange);
        vv?.removeEventListener('scroll', onChange);
        window.removeEventListener('resize', onChange);
        window.removeEventListener('orientationchange', onChange);
    };
}
