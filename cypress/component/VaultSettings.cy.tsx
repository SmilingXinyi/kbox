import VaultSettings from '../../src/components/vault/VaultSettings';
import type {ApiKeyItem, VaultMetadata} from '../../src/types/vault';
import {createMockCloud} from '../support/mockCloud';

const metadata: VaultMetadata = {
    isInitialized: true,
    hasWebAuthn: false,
    salt: '00',
    pinIv: '00',
    encryptedMasterKeyWithPin: '00'
};

const defaultProps = {
    isOpen: true,
    lockBehavior: 'once' as const,
    onLockBehaviorChange: () => {},
    commonTags: [] as string[],
    onCommonTagsChange: () => {},
    metadata,
    items: [] as ApiKeyItem[],
    onEnrollWebAuthn: () => Promise.resolve()
};

describe('<VaultSettings />', () => {
    it('asks to unlock before enrolling Face ID on a phone', () => {
        cy.viewport(390, 844);
        cy.mount(
            <VaultSettings
                {...defaultProps}
                onClose={cy.stub()}
                masterKey={null}
                onRequestUnlock={cy.stub().as('requestUnlock')}
                onReset={cy.stub().as('resetVault').resolves()}
                cloud={createMockCloud()}
            />
        );

        cy.get('nav[aria-label="Settings sections"]').should('not.be.visible');
        cy.contains('Face ID / Touch ID').scrollIntoView().should('be.visible');
        cy.contains('Status: Not enabled').should('be.visible');
        cy.contains('button', 'Unlock to enroll Face ID / Touch ID').click();
        cy.get('@requestUnlock').should('have.been.called');
    });

    it('uses a section sidebar on desktop', () => {
        cy.viewport(1280, 900);
        cy.mount(
            <VaultSettings
                {...defaultProps}
                onClose={cy.stub().as('onClose')}
                metadata={{...metadata, hasWebAuthn: true}}
                masterKey={'aa'.repeat(32)}
                onRequestUnlock={cy.stub()}
                onReset={cy.stub().as('resetVault').resolves()}
                cloud={createMockCloud()}
            />
        );

        cy.get('nav[aria-label="Settings sections"]').should('be.visible');
        cy.contains('Account recovery').should('be.visible');
        cy.contains('button', 'Push to Google Drive').should('not.be.visible');

        cy.get('nav[aria-label="Settings sections"]').contains('button', 'Google Drive').click();
        cy.contains('OneDrive').should('not.exist');
        cy.get('input[aria-label="Automatic Google Drive sync"]').should('not.be.checked');
        cy.contains('button', 'Push to Google Drive').should('be.visible');

        cy.get('nav[aria-label="Settings sections"]').contains('button', 'Face ID').click();
        cy.contains('Status: Enabled on this device').should('be.visible');
        cy.contains('Owner name').should('not.exist');

        cy.get('nav[aria-label="Settings sections"]').contains('button', 'Reset').click();
        cy.contains('disconnects Google Drive in this browser').should('be.visible');

        cy.window().then(win => {
            cy.stub(win, 'confirm').as('confirm').returns(true);
            cy.stub(win, 'prompt').as('prompt').returns('RESET');
        });
        cy.contains('button', 'Reset vault…').click();
        cy.get('@confirm').should('have.been.called');
        cy.get('@resetVault').should('have.been.called');
        cy.get('@onClose').should('have.been.called');
    });
});
