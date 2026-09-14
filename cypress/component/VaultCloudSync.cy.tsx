import VaultCloudSync from '../../src/components/vault/VaultCloudSync';
import {configuredProvider, createMockCloud} from '../support/mockCloud';

describe('<VaultCloudSync />', () => {
    it('lets the user choose a drive to pull from', () => {
        const cloud = createMockCloud();
        cy.mount(<VaultCloudSync cloud={cloud} />);

        cy.contains('Cloud drive').should('be.visible');
        cy.contains('button', 'Pull from Google Drive').click();
        cy.get('@cloudPull').should('have.been.calledWith', 'google-drive');

        cy.contains('button', 'Pull from OneDrive').click();
        cy.get('@cloudPull').should('have.been.calledWith', 'onedrive');
    });

    it('connects a provider from settings', () => {
        const cloud = createMockCloud();
        cy.mount(<VaultCloudSync cloud={cloud} variant="settings" />);

        cy.contains('button', 'Connect Google Drive').click();
        cy.get('@cloudConnect').should('have.been.calledWith', 'google-drive');
        cy.contains('button', 'Connect OneDrive').click();
        cy.get('@cloudConnect').should('have.been.calledWith', 'onedrive');
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
        cy.mount(<VaultCloudSync cloud={cloud} />);

        cy.contains('Connected to Google Drive').should('be.visible');
        cy.contains('Last push:').should('be.visible');
        cy.contains('button', 'Disconnect this device').click();
        cy.get('@cloudDisconnect').should('have.been.called');
    });

    it('disables providers that are not configured', () => {
        const cloud = createMockCloud({
            providers: [configuredProvider('google-drive', false), configuredProvider('onedrive', false)]
        });
        cy.mount(<VaultCloudSync cloud={cloud} />);

        cy.contains('VITE_GOOGLE_DRIVE_CLIENT_ID').should('be.visible');
        cy.contains('button', 'Pull from Google Drive').should('be.disabled');
        cy.contains('button', 'Pull from OneDrive').should('be.disabled');
    });

    it('setup variant focuses on pull', () => {
        const cloud = createMockCloud();
        cy.mount(<VaultCloudSync cloud={cloud} variant="setup" />);

        cy.contains('Pull from a cloud drive').should('be.visible');
        cy.contains('Connect Google Drive').should('not.exist');
        cy.contains('button', 'Pull from Google Drive').click();
        cy.get('@cloudPull').should('have.been.calledWith', 'google-drive');
    });
});
