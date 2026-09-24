import VaultCloudSync from '../../src/components/vault/VaultCloudSync';
import {configuredProvider, createMockCloud} from '../support/mockCloud';

function typeCloudPin(pin = '123456') {
    cy.get('input[placeholder="PIN used on the source device"]').type(pin);
}

describe('<VaultCloudSync />', () => {
    beforeEach(() => {
        cy.viewport(1280, 900);
    });

    it('lets the user pull and push Google Drive from settings', () => {
        const cloud = createMockCloud();
        cy.mount(<VaultCloudSync cloud={cloud} variant="settings" isUnlocked />);

        cy.contains('Google Drive').should('be.visible');
        cy.contains('AES-GCM').should('not.exist');
        cy.get('input[aria-label="Automatic Google Drive sync"]').should('not.be.checked');
        cy.contains('button', 'Pull updates from Google Drive').click();
        cy.get('@cloudPull').should('have.been.calledWith', 'google-drive');
        cy.contains('button', 'Push to Google Drive').click();
        cy.get('@cloudPush').should('have.been.called');
        cy.get('input[aria-label="Automatic Google Drive sync"]').check();
        cy.get('@cloudSetAutoSync').should('have.been.calledWith', true);
    });

    it('connects Google Drive from settings', () => {
        const cloud = createMockCloud();
        cy.mount(<VaultCloudSync cloud={cloud} variant="settings" isUnlocked />);

        cy.contains('button', 'Connect Google Drive').click();
        cy.get('@cloudConnect').should('have.been.calledWith', 'google-drive');
        cy.contains('Change OAuth app').should('be.visible');
    });

    it('shows connected status and disconnect', () => {
        const cloud = createMockCloud({
            session: {
                provider: 'google-drive',
                accessToken: 't',
                expiresAt: Date.now() + 60_000,
                accountLabel: 'Google Drive'
            },
            lastPushAt: '2026-09-14T10:00:00.000Z',
            lastPullAt: '2026-09-14T09:00:00.000Z'
        });
        cy.mount(<VaultCloudSync cloud={cloud} isUnlocked />);

        cy.contains('Connected to Google Drive').should('be.visible');
        cy.contains('Cloud vault PIN').should('not.exist');
        cy.contains('Last push:').should('be.visible');
        cy.contains('button', 'Disconnect this device').click();
        cy.get('@cloudDisconnect').should('have.been.called');
    });

    it('restores the shipped Google Drive app', () => {
        const cloud = createMockCloud({
            providers: [
                {
                    id: 'google-drive',
                    label: 'Google Drive',
                    configured: true,
                    clientId: '123.apps.googleusercontent.com'
                }
            ]
        });
        cy.mount(<VaultCloudSync cloud={cloud} isUnlocked />);

        cy.contains('button', 'Change OAuth app').click();
        cy.contains('button', 'Use kbox Google app').click();
        cy.get('@cloudSaveClientId').should('have.been.calledWith', 'google-drive', '');
        cy.contains('OAuth client ID').should('not.exist');
    });

    it('does not mention OneDrive', () => {
        const cloud = createMockCloud({
            providers: [configuredProvider('google-drive', true)]
        });
        cy.mount(<VaultCloudSync cloud={cloud} isUnlocked />);
        cy.contains('OneDrive').should('not.exist');
    });

    it('setup variant focuses on pull', () => {
        const cloud = createMockCloud();
        cy.mount(<VaultCloudSync cloud={cloud} variant="setup" />);

        cy.contains('Pull from Google Drive').should('be.visible');
        cy.contains('Connect Google Drive').should('not.exist');
        cy.contains('Automatic sync').should('not.exist');
        cy.contains('Recovery files stay local').should('be.visible');
        cy.contains('button', 'Pull from Google Drive').should('be.disabled');
        typeCloudPin();
        cy.contains('button', 'Pull from Google Drive').click();
        cy.get('@cloudPull').should('have.been.calledWith', 'google-drive');
    });

    it('uses a cloud vault PIN only for an explicit restore from settings', () => {
        const cloud = createMockCloud();
        cy.mount(<VaultCloudSync cloud={cloud} variant="settings" isUnlocked />);

        cy.contains('button', 'Pull updates from Google Drive').click();
        cy.get('@cloudPull').should('have.been.calledWith', 'google-drive');

        cy.contains('button', 'Restore a cloud vault from another device').first().click();
        cy.get('input[placeholder="PIN used to unlock the cloud vault"]').type('654321');
        cy.on('window:confirm', () => true);
        cy.contains('button', 'Restore from Google Drive').click();
        cy.get('@cloudPull').should('have.been.calledWith', 'google-drive', {pin: '654321'});
    });
});
