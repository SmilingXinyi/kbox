import VaultSetup from '../../src/components/vault/VaultSetup';

describe('<VaultSetup />', () => {
    it('defaults Owner to an English identifier and accepts Chinese', () => {
        cy.mount(<VaultSetup onInitialized={cy.stub().resolves()} onRestored={cy.stub().resolves()} />);

        cy.get('#vault-owner-name').as('owner');
        cy.get('@owner').should('have.value', 'vault-owner');
        cy.get('@owner').should('have.attr', 'lang', 'en');
        cy.get('@owner').clear().type('张三');
        cy.get('@owner').should('have.value', '张三');
        cy.contains('English keyboard by default. Chinese and other languages are fine.').should('be.visible');
    });
});
