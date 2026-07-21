import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import {defineConfig, globalIgnores} from 'eslint/config';

export default defineConfig([
    globalIgnores(['dist', 'demo', 'cypress/downloads', 'cypress/videos', 'cypress/screenshots']),
    {
        files: ['**/*.{ts,tsx}'],
        extends: [
            js.configs.recommended,
            tseslint.configs.recommended,
            reactHooks.configs.flat.recommended,
            reactRefresh.configs.vite
        ],
        languageOptions: {
            globals: globals.browser
        }
    },
    {
        files: ['cypress/**/*.{ts,tsx}'],
        rules: {
            'react-refresh/only-export-components': 'off'
        },
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.mocha,
                cy: 'readonly',
                Cypress: 'readonly',
                expect: 'readonly',
                assert: 'readonly'
            }
        }
    }
]);
