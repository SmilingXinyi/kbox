/**
 * --safe-bottom is extra bottom inset still inside the box that
 * `position:fixed; bottom:0` actually sits in (the dock's containing block).
 *
 * remaining = max(0, inset − alreadyOutside)
 *
 * - inset: env(safe-area-inset-bottom), phantom Safari chrome (~83px) capped to 34px
 * - alreadyOutside: screenHeight − layoutBottomY, where layoutBottomY is a
 *   0-height `position:fixed; bottom:0` probe (not innerHeight, which can lie)
 *
 * iOS home-screen PWAs often report innerHeight === screen.height while the
 * fixed bottom is already 34px above the home indicator. Padding by env() then
 * stacks a second gap. The probe matches the dock, so that case yields 0.
 */

const HOME_INDICATOR_PX = 34;
const PHANTOM_CHROME_INSET_PX = 50;

export function remainingSafeBottomPx(input: {cssBottom: number; layoutBottomY: number; screenHeight: number}): number {
    const inset = input.cssBottom >= PHANTOM_CHROME_INSET_PX ? HOME_INDICATOR_PX : input.cssBottom;
    if (inset <= 0) return 0;
    const alreadyOutside = Math.max(0, input.screenHeight - input.layoutBottomY);
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

/** Y of `position:fixed; bottom:0` — same containing block as the dock. */
function readFixedLayoutBottomY(): number {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none';
    document.documentElement.appendChild(el);
    const y = el.getBoundingClientRect().top;
    el.remove();
    return y;
}

function syncSafeAreaBottom(): void {
    const remaining = remainingSafeBottomPx({
        cssBottom: readEnvBottomInset(),
        layoutBottomY: readFixedLayoutBottomY(),
        screenHeight: screenHeightCssPx()
    });
    document.documentElement.style.setProperty('--safe-bottom', `${remaining}px`);
}

/** Bind once at app startup. Updates on rotate, URL-bar collapse, and keyboard. */
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
    return () => ac.abort();
}
