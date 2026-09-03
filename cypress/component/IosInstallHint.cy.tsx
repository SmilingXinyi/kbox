import IosInstallHint from '../../src/components/pwa/IosInstallHint';
import {IOS_INSTALL_HINT_STORAGE_KEY, type DisplayProbe} from '../../src/lib/iosInstallHint';

const IPHONE_SAFARI: DisplayProbe = {
    userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    platform: 'iPhone',
    maxTouchPoints: 5,
    standalone: false,
    displayModeStandalone: false,
    displayModeFullscreen: false
};

describe('<IosInstallHint />', () => {
    beforeEach(() => {
        localStorage.removeItem(IOS_INSTALL_HINT_STORAGE_KEY);
    });

    it('renders the top banner on iPhone Safari', () => {
        cy.mount(<IosInstallHint probe={IPHONE_SAFARI} />);
        cy.contains('Add KBox to Home Screen').should('be.visible');
        cy.contains('Safari on iPhone').should('be.visible');
    });

    it('opens install steps when the banner is tapped', () => {
        cy.mount(<IosInstallHint probe={IPHONE_SAFARI} />);
        cy.contains('button', 'Add KBox to Home Screen').click();
        cy.contains('Install on this iPhone').should('be.visible');
        cy.contains('Tap Share').should('be.visible');
        cy.contains('Add to Home Screen').should('be.visible');
        cy.contains('button', 'Got it').click();
        cy.contains('Install on this iPhone').should('not.exist');
        cy.contains('Add KBox to Home Screen').should('be.visible');
    });

    it('renders iPad copy for iPadOS Safari', () => {
        const ipad: DisplayProbe = {
            userAgent:
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
            platform: 'MacIntel',
            maxTouchPoints: 5,
            standalone: false,
            displayModeStandalone: false,
            displayModeFullscreen: false
        };
        cy.mount(<IosInstallHint probe={ipad} />);
        cy.contains('Safari on iPad').should('be.visible');
        cy.contains('button', 'Add KBox to Home Screen').click();
        cy.contains('Install on this iPad').should('be.visible');
    });

    it('hides for the session when close is confirmed without never-show', () => {
        cy.mount(<IosInstallHint probe={IPHONE_SAFARI} />);
        cy.get('button[aria-label="Hide install hint"]').click();
        cy.contains('Hide install hint?').should('be.visible');
        cy.contains('button', 'Hide').click();
        cy.contains('Add KBox to Home Screen').should('not.exist');
        cy.then(() => {
            expect(localStorage.getItem(IOS_INSTALL_HINT_STORAGE_KEY)).to.eq(null);
        });
    });

    it('keeps the banner when dismiss is cancelled', () => {
        cy.mount(<IosInstallHint probe={IPHONE_SAFARI} />);
        cy.get('button[aria-label="Hide install hint"]').click();
        cy.contains('button', 'Keep showing').click();
        cy.contains('Add KBox to Home Screen').should('be.visible');
    });

    it('writes never-show to localStorage when the checkbox is checked', () => {
        cy.mount(<IosInstallHint probe={IPHONE_SAFARI} />);
        cy.get('button[aria-label="Hide install hint"]').click();
        cy.contains('Never show again').click();
        cy.contains('button', 'Hide').click();
        cy.contains('Add KBox to Home Screen').should('not.exist');
        cy.then(() => {
            expect(localStorage.getItem(IOS_INSTALL_HINT_STORAGE_KEY)).to.eq(JSON.stringify({neverShow: true}));
        });
    });

    it('does not render when never-show is already stored', () => {
        localStorage.setItem(IOS_INSTALL_HINT_STORAGE_KEY, JSON.stringify({neverShow: true}));
        cy.mount(<IosInstallHint probe={IPHONE_SAFARI} />);
        cy.contains('Add KBox to Home Screen').should('not.exist');
    });
});
