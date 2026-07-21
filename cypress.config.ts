import {defineConfig} from 'cypress';

export default defineConfig({
    video: false,
    screenshotOnRunFailure: true,
    component: {
        devServer: {
            framework: 'react',
            bundler: 'vite'
        },
        specPattern: 'cypress/component/**/*.cy.{ts,tsx}',
        supportFile: 'cypress/support/component.ts',
        indexHtmlFile: 'cypress/support/component-index.html'
    },
    e2e: {
        baseUrl: 'http://127.0.0.1:4173',
        specPattern: 'cypress/e2e/**/*.cy.{ts,tsx}',
        supportFile: 'cypress/support/e2e.ts'
    }
});
