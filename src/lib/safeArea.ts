/**
 * iOS with viewport-fit=cover often reports env(safe-area-inset-bottom)
 * against the physical screen, while the layout/visual viewport already
 * excludes that strip ("lying viewport"). Padding by the raw env() value
 * then reserves the home indicator twice.
 *
 * Remaining inset = CSS inset minus the strip already outside this viewport.
 */
export function remainingSafeBottomPx(input: {
    cssTop: number;
    cssBottom: number;
    viewportHeight: number;
    screenHeight: number;
}): number {
    const alreadyOutside = Math.max(0, input.screenHeight - input.viewportHeight - input.cssTop);
    return Math.max(0, input.cssBottom - alreadyOutside);
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
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
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
