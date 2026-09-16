import VaultCloudSync from '../../src/components/vault/VaultCloudSync';
import {configuredProvider, createMockCloud} from '../support/mockCloud';

function typeCloudPin(pin = '123456') {
    cy.get('input[placeholder="PIN used on the source device"]').type(pin);
}

describe('<VaultCloudSync />', () => {
    beforeEach(() => {
        cy.viewport(1280, 900);
    });
    it('lets the user choose a drive to pull from', () => {
        const cloud = createMockCloud();
        cy.mount(<VaultCloudSync cloud={cloud} isUnlocked />);

        cy.contains('Cloud drive').should('be.visible');
        cy.contains('AES-GCM blob').should('be.visible');
        cy.contains('button', 'Pull from Google Drive').click();
        cy.get('@cloudPull').should('have.been.calledWith', 'google-drive');

        cy.contains('button', 'Pull from OneDrive').click();
        cy.get('@cloudPull').should('have.been.calledWith', 'onedrive');
    });

    it('connects a provider from settings', () => {
        const cloud = createMockCloud();
        cy.mount(<VaultCloudSync cloud={cloud} variant="settings" isUnlocked />);

        cy.contains('button', 'Connect Google Drive').click();
        cy.get('@cloudConnect').should('have.been.calledWith', 'google-drive');
        cy.contains('button', 'Connect OneDrive').click();
        cy.get('@cloudConnect').should('have.been.calledWith', 'onedrive');
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
        cy.contains('Vault PIN').should('not.exist');
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
                },
                configuredProvider('onedrive', false)
            ]
        });
        cy.mount(<VaultCloudSync cloud={cloud} isUnlocked />);

        cy.contains('button', 'Change OAuth app').click();
        cy.contains('button', 'Use kbox Google app').click();
        cy.get('@cloudSaveClientId').should('have.been.calledWith', 'google-drive', '');
        cy.contains('OAuth client ID').should('not.exist');
    });

    it('asks for an OAuth client ID before authorizing an unconfigured drive', () => {
        const cloud = createMockCloud({
            providers: [configuredProvider('google-drive', true), configuredProvider('onedrive', false)]
        });
        cy.mount(<VaultCloudSync cloud={cloud} isUnlocked />);

        cy.contains('OAuth client ID').should('not.exist');
        cy.contains('button', 'Connect OneDrive').click();
        cy.get('@cloudConnect').should('not.have.been.called');
        cy.get('input[aria-label="OneDrive OAuth client ID"]').should('be.visible');

        cy.contains('button', 'Connect OneDrive').click();
        cy.contains('Enter the OneDrive OAuth client ID').scrollIntoView().should('be.visible');
        cy.get('@cloudConnect').should('not.have.been.called');

        cy.get('input[aria-label="OneDrive OAuth client ID"]').type('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
        cy.contains('summary', 'Registration URIs').click();
        cy.contains('Redirect URI').scrollIntoView().should('be.visible');
        cy.contains('button', 'Connect OneDrive').scrollIntoView().click();
        cy.get('@cloudSaveClientId').should('have.been.calledWith', 'onedrive', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
        cy.get('@cloudConnect').should('have.been.calledWith', 'onedrive');
    });

    it('setup variant focuses on pull', () => {
        const cloud = createMockCloud();
        cy.mount(<VaultCloudSync cloud={cloud} variant="setup" />);

        cy.contains('Pull from a cloud drive').should('be.visible');
        cy.contains('Connect Google Drive').should('not.exist');
        cy.contains('Recovery files stay local').should('be.visible');
        cy.contains('button', 'Pull from Google Drive').should('be.disabled');
        typeCloudPin();
        cy.contains('button', 'Pull from Google Drive').click();
        cy.get('@cloudPull').should('have.been.calledWith', 'google-drive');
    });
});
