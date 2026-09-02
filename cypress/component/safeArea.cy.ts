import {remainingSafeBottomPx, resolveAppHeightPx} from '../../src/lib/safeArea';

describe('remainingSafeBottomPx', () => {
    it('keeps the home-indicator inset when fixed bottom is on the screen edge', () => {
        expect(
            remainingSafeBottomPx({
                cssBottom: 34,
                layoutBottomY: 932,
                screenHeight: 932
            })
        ).to.eq(34);
    });

    it('caps phantom Safari chrome (~83px) to the home-indicator height', () => {
        expect(
            remainingSafeBottomPx({
                cssBottom: 83,
                layoutBottomY: 932,
                screenHeight: 932
            })
        ).to.eq(34);
    });

    it('returns 0 when fixed bottom is already above the home indicator', () => {
        // innerHeight may still claim 932; the probe sits at 898.
        expect(
            remainingSafeBottomPx({
                cssBottom: 34,
                layoutBottomY: 898,
                screenHeight: 932
            })
        ).to.eq(0);
    });

    it('returns 0 when fixed bottom already excluded both insets', () => {
        expect(
            remainingSafeBottomPx({
                cssBottom: 34,
                layoutBottomY: 839,
                screenHeight: 932
            })
        ).to.eq(0);
    });

    it('returns 0 in Safari when chrome already sits below the page', () => {
        expect(
            remainingSafeBottomPx({
                cssBottom: 83,
                layoutBottomY: 700,
                screenHeight: 932
            })
        ).to.eq(0);
    });

    it('keeps a gesture inset on a full-screen Android viewport', () => {
        expect(
            remainingSafeBottomPx({
                cssBottom: 24,
                layoutBottomY: 800,
                screenHeight: 800
            })
        ).to.eq(24);
    });

    it('keeps the landscape home-indicator when the short edge is edge-to-edge', () => {
        expect(
            remainingSafeBottomPx({
                cssBottom: 21,
                layoutBottomY: 430,
                screenHeight: 430
            })
        ).to.eq(21);
    });
});

describe('resolveAppHeightPx', () => {
    it('expands a home-indicator letterbox to the screen', () => {
        expect(resolveAppHeightPx({layoutHeight: 898, screenHeight: 932})).to.eq(932);
    });

    it('expands a status-bar-sized letterbox to the screen', () => {
        expect(resolveAppHeightPx({layoutHeight: 873, screenHeight: 932})).to.eq(932);
    });

    it('does not expand a windowed desktop shortfall', () => {
        expect(resolveAppHeightPx({layoutHeight: 800, screenHeight: 1440})).to.eq(800);
    });

    it('keeps an already edge-to-edge layout', () => {
        expect(resolveAppHeightPx({layoutHeight: 932, screenHeight: 932})).to.eq(932);
    });
});
