import {remainingSafeBottomPx} from '../../src/lib/safeArea';

describe('remainingSafeBottomPx', () => {
    it('keeps the home-indicator inset when the viewport is edge-to-edge', () => {
        expect(
            remainingSafeBottomPx({
                cssBottom: 34,
                viewportHeight: 932,
                screenHeight: 932
            })
        ).to.eq(34);
    });

    it('caps phantom Safari chrome (~83px) to the home-indicator height', () => {
        expect(
            remainingSafeBottomPx({
                cssBottom: 83,
                viewportHeight: 932,
                screenHeight: 932
            })
        ).to.eq(34);
    });

    it('returns 0 when the viewport already excluded the home indicator', () => {
        expect(
            remainingSafeBottomPx({
                cssBottom: 34,
                viewportHeight: 898,
                screenHeight: 932
            })
        ).to.eq(0);
    });

    it('returns 0 when the viewport already excluded both insets', () => {
        expect(
            remainingSafeBottomPx({
                cssBottom: 34,
                viewportHeight: 839,
                screenHeight: 932
            })
        ).to.eq(0);
    });

    it('returns 0 in Safari when chrome already sits below the visual viewport', () => {
        expect(
            remainingSafeBottomPx({
                cssBottom: 83,
                viewportHeight: 700,
                screenHeight: 932
            })
        ).to.eq(0);
    });

    it('keeps a gesture inset on a full-screen Android viewport', () => {
        expect(
            remainingSafeBottomPx({
                cssBottom: 24,
                viewportHeight: 800,
                screenHeight: 800
            })
        ).to.eq(24);
    });

    it('keeps the landscape home-indicator when the short edge is edge-to-edge', () => {
        expect(
            remainingSafeBottomPx({
                cssBottom: 21,
                viewportHeight: 430,
                screenHeight: 430
            })
        ).to.eq(21);
    });

    it('treats iOS standalone inset as already outside the webview', () => {
        expect(
            remainingSafeBottomPx({
                cssBottom: 34,
                viewportHeight: 932,
                screenHeight: 932,
                iosStandalone: true
            })
        ).to.eq(0);
        expect(
            remainingSafeBottomPx({
                cssBottom: 83,
                viewportHeight: 932,
                screenHeight: 932,
                iosStandalone: true
            })
        ).to.eq(0);
    });
});
