import VaultSetup from '../../src/components/vault/VaultSetup';
import {createMockCloud} from '../support/mockCloud';

describe('<VaultSetup />', () => {
    it('defaults Owner to an English identifier and accepts Chinese', () => {
        cy.mount(
            <VaultSetup
                onInitialized={cy.stub().resolves()}
                onRestored={cy.stub().resolves()}
                cloud={createMockCloud()}
            />
        );

        cy.get('#vault-owner-name').as('owner');
        cy.get('@owner').should('have.value', 'vault-owner');
        cy.get('@owner').should('have.attr', 'lang', 'en');
        cy.get('@owner').clear().type('张三');
        cy.get('@owner').should('have.value', '张三');
        cy.contains('English keyboard by default. Chinese and other languages are fine.').should('be.visible');
    });

    it('offers a cloud drive pull entry', () => {
        const cloud = createMockCloud();
        cy.mount(<VaultSetup onInitialized={cy.stub().resolves()} onRestored={cy.stub().resolves()} cloud={cloud} />);

        cy.contains('button', 'Pull from Google Drive or OneDrive').click();
        cy.contains('Pull from a cloud drive').should('be.visible');
        cy.contains('button', 'Pull from Google Drive').click();
        cy.get('@cloudPull').should('have.been.calledWith', 'google-drive');
    });
});
