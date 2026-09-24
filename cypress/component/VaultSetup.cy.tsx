import VaultSetup from '../../src/components/vault/VaultSetup';
import {createMockCloud} from '../support/mockCloud';

describe('<VaultSetup />', () => {
    beforeEach(() => {
        cy.viewport(1280, 900);
    });

    it('starts with create vs existing vault, not the PIN form', () => {
        cy.mount(
            <VaultSetup
                onInitialized={cy.stub().resolves()}
                onRestored={cy.stub().resolves()}
                cloud={createMockCloud()}
            />
        );

        cy.contains('Welcome to kbox').should('be.visible');
        cy.contains('button', 'Create a new vault').should('be.visible');
        cy.contains('button', 'I already have a vault').should('be.visible');
        cy.get('#vault-owner-name').should('not.exist');
        cy.contains('Restore from recovery file').should('not.exist');
    });

    it('asks only for PIN when creating a vault', () => {
        cy.mount(
            <VaultSetup
                onInitialized={cy.stub().resolves()}
                onRestored={cy.stub().resolves()}
                cloud={createMockCloud()}
            />
        );

        cy.contains('button', 'Create a new vault').click();
        cy.contains('Create a new vault').should('be.visible');
        cy.get('#vault-owner-name').should('not.exist');
        cy.contains('Owner name').should('not.exist');
        cy.contains('label', 'PIN').should('be.visible');
        cy.contains('label', 'Confirm PIN').should('be.visible');
        cy.contains('button', 'Restore from recovery file').should('not.exist');
        cy.contains('button', 'Pull from Google Drive').should('not.exist');
    });

    it('offers recovery file and Drive after choosing an existing vault', () => {
        const cloud = createMockCloud();
        cy.mount(<VaultSetup onInitialized={cy.stub().resolves()} onRestored={cy.stub().resolves()} cloud={cloud} />);

        cy.contains('button', 'I already have a vault').click();
        cy.contains('Bring your vault here').should('be.visible');
        cy.contains('button', 'Recovery file').should('be.visible');
        cy.contains('button', 'Google Drive').click();
        cy.contains('Authorize Google Drive in this browser').scrollIntoView().should('be.visible');
        cy.contains('button', 'Pull from Google Drive').should('be.disabled');
        cy.get('input[placeholder="PIN used on the source device"]').type('123456');
        cy.contains('button', 'Pull from Google Drive').click();
        cy.get('@cloudPull').should('have.been.calledWith', 'google-drive');
    });
});
