import {
    IOS_INSTALL_HINT_STORAGE_KEY,
    isIosDevice,
    isIosInstallHintNeverShow,
    isIosSafari,
    isIpad,
    isStandalonePwa,
    persistIosInstallHintNeverShow,
    shouldShowIosInstallHint,
    type DisplayProbe
} from '../../src/lib/iosInstallHint';

const IPHONE_SAFARI: DisplayProbe = {
    userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    platform: 'iPhone',
    maxTouchPoints: 5,
    standalone: false,
    displayModeStandalone: false,
    displayModeFullscreen: false
};

const IPAD_SAFARI: DisplayProbe = {
    userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    platform: 'MacIntel',
    maxTouchPoints: 5,
    standalone: false,
    displayModeStandalone: false,
    displayModeFullscreen: false
};

const IPHONE_CHROME: DisplayProbe = {
    ...IPHONE_SAFARI,
    userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1'
};

const IPHONE_FIREFOX: DisplayProbe = {
    ...IPHONE_SAFARI,
    userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/123.0 Mobile/15E148 Safari/605.1.15'
};

const DESKTOP_CHROME: DisplayProbe = {
    userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    platform: 'MacIntel',
    maxTouchPoints: 0,
    standalone: false,
    displayModeStandalone: false,
    displayModeFullscreen: false
};

describe('iOS Safari detection', () => {
    it('treats iPhone Safari as eligible', () => {
        expect(isIosDevice(IPHONE_SAFARI)).to.eq(true);
        expect(isIosSafari(IPHONE_SAFARI)).to.eq(true);
        expect(isIpad(IPHONE_SAFARI)).to.eq(false);
        expect(shouldShowIosInstallHint(IPHONE_SAFARI, false)).to.eq(true);
    });

    it('treats iPadOS Safari (Macintosh + touch) as eligible', () => {
        expect(isIosDevice(IPAD_SAFARI)).to.eq(true);
        expect(isIosSafari(IPAD_SAFARI)).to.eq(true);
        expect(isIpad(IPAD_SAFARI)).to.eq(true);
        expect(shouldShowIosInstallHint(IPAD_SAFARI, false)).to.eq(true);
    });

    it('excludes Chrome on iOS', () => {
        expect(isIosDevice(IPHONE_CHROME)).to.eq(true);
        expect(isIosSafari(IPHONE_CHROME)).to.eq(false);
        expect(shouldShowIosInstallHint(IPHONE_CHROME, false)).to.eq(false);
    });

    it('excludes Firefox on iOS', () => {
        expect(isIosSafari(IPHONE_FIREFOX)).to.eq(false);
        expect(shouldShowIosInstallHint(IPHONE_FIREFOX, false)).to.eq(false);
    });

    it('excludes desktop Chrome', () => {
        expect(isIosSafari(DESKTOP_CHROME)).to.eq(false);
        expect(shouldShowIosInstallHint(DESKTOP_CHROME, false)).to.eq(false);
    });

    it('hides in standalone PWA even on iPhone Safari', () => {
        const standalone = {...IPHONE_SAFARI, standalone: true};
        expect(isStandalonePwa(standalone)).to.eq(true);
        expect(shouldShowIosInstallHint(standalone, false)).to.eq(false);
    });

    it('hides when never-show is set', () => {
        expect(shouldShowIosInstallHint(IPHONE_SAFARI, true)).to.eq(false);
    });
});

describe('iOS install hint storage', () => {
    beforeEach(() => {
        localStorage.removeItem(IOS_INSTALL_HINT_STORAGE_KEY);
    });

    it('starts unset', () => {
        expect(isIosInstallHintNeverShow()).to.eq(false);
    });

    it('persists never-show as a versioned record', () => {
        persistIosInstallHintNeverShow();
        expect(isIosInstallHintNeverShow()).to.eq(true);
        expect(localStorage.getItem(IOS_INSTALL_HINT_STORAGE_KEY)).to.eq(JSON.stringify({neverShow: true}));
    });

    it('ignores corrupt storage', () => {
        localStorage.setItem(IOS_INSTALL_HINT_STORAGE_KEY, '{not json');
        expect(isIosInstallHintNeverShow()).to.eq(false);
    });
});
