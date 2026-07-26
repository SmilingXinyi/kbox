import {defineConfig, mergeConfig} from 'vite';
import baseConfig from './vite.config';

/**
 * GitHub Pages project site build (`https://<user>.github.io/kbox/`).
 * Use via: pnpm build:pages
 */
export default mergeConfig(
    baseConfig,
    defineConfig({
        base: '/kbox/'
    })
);
