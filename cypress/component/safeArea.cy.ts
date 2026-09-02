import {remainingSafeBottomPx} from '../../src/lib/safeArea';

describe('remainingSafeBottomPx', () => {
    it('keeps the home-indicator inset when the viewport is edge-to-edge', () => {
        // iPhone 14 Pro Max cover: 932 CSS px tall, 59 top / 34 bottom.
        expect(
            remainingSafeBottomPx({
                cssTop: 59,
                cssBottom: 34,
                viewportHeight: 932,
                screenHeight: 932
            })
        ).to.eq(34);
    });

    it('returns 0 when the viewport already excluded both insets (lying viewport)', () => {
        expect(
            remainingSafeBottomPx({
                cssTop: 59,
                cssBottom: 34,
                viewportHeight: 839,
                screenHeight: 932
            })
        ).to.eq(0);
    });

    it('returns 0 in Safari when chrome already sits below the visual viewport', () => {
        expect(
            remainingSafeBottomPx({
                cssTop: 8,
                cssBottom: 83,
                viewportHeight: 700,
                screenHeight: 932
            })
        ).to.eq(0);
    });

    it('keeps a gesture inset on a full-screen Android viewport', () => {
        expect(
            remainingSafeBottomPx({
                cssTop: 0,
                cssBottom: 24,
                viewportHeight: 800,
                screenHeight: 800
            })
        ).to.eq(24);
    });

    it('keeps the landscape home-indicator when the short edge is edge-to-edge', () => {
        expect(
            remainingSafeBottomPx({
                cssTop: 0,
                cssBottom: 21,
                viewportHeight: 430,
                screenHeight: 430
            })
        ).to.eq(21);
    });
});
