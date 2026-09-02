/**
 * --app-height is the box we paint into. --safe-bottom is extra inset still
 * inside that box.
 *
 * remaining = max(0, inset − (screenHeight − appHeight))
 *
 * iOS PWAs often give a layout viewport shorter than the screen (letterbox
 * under the home indicator). `position:fixed; inset:0` then clips sheets and
 * the dock. If the shortfall looks like a safe-area (≤120px), we expand
 * --app-height to the screen and shift fixed-bottom chrome with --app-bottom-shift.
 */

const HOME_INDICATOR_PX = 34;
const PHANTOM_CHROME_INSET_PX = 50;
/** Status bar + home indicator. Larger gaps are a windowed desktop, not letterbox. */
const LETTERBOX_MAX_PX = 120;

export function remainingSafeBottomPx(input: {cssBottom: number; layoutBottomY: number; screenHeight: number}): number {
    const inset = input.cssBottom >= PHANTOM_CHROME_INSET_PX ? HOME_INDICATOR_PX : input.cssBottom;
    if (inset <= 0) return 0;
    const alreadyOutside = Math.max(0, input.screenHeight - input.layoutBottomY);
    return Math.max(0, inset - alreadyOutside);
}

/** Grow the app box to the screen when iOS letterboxes a small safe-area strip. */
export function resolveAppHeightPx(input: {layoutHeight: number; screenHeight: number}): number {
    const shortfall = input.screenHeight - input.layoutHeight;
    return shortfall > 0 && shortfall <= LETTERBOX_MAX_PX ? input.screenHeight : input.layoutHeight;
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

function readFixedLayoutBottomY(): number {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none';
    document.documentElement.appendChild(el);
    const y = el.getBoundingClientRect().top;
    el.remove();
    return y;
}

function syncViewportBox(): void {
    const screenHeight = screenHeightCssPx();
    const layoutHeight = Math.max(window.innerHeight, window.visualViewport?.height ?? 0, readFixedLayoutBottomY());
    const appHeight = resolveAppHeightPx({layoutHeight, screenHeight});
    document.documentElement.style.setProperty('--app-height', `${appHeight}px`);
    document.documentElement.style.setProperty('--app-bottom-shift', `${Math.max(0, appHeight - layoutHeight)}px`);
    const remaining = remainingSafeBottomPx({
        cssBottom: readEnvBottomInset(),
        layoutBottomY: appHeight,
        screenHeight
    });
    document.documentElement.style.setProperty('--safe-bottom', `${remaining}px`);
}

/** Bind once at app startup. Updates on rotate, URL-bar collapse, and keyboard. */
export function bindSafeAreaSync(): () => void {
    syncViewportBox();
    const onChange = () => syncViewportBox();
    const ac = new AbortController();
    const {signal} = ac;
    const vv = window.visualViewport;
    vv?.addEventListener('resize', onChange, {signal});
    vv?.addEventListener('scroll', onChange, {signal});
    window.addEventListener('resize', onChange, {signal});
    window.addEventListener('orientationchange', onChange, {signal});
    return () => ac.abort();
}
