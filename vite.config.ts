import {execSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import react, {reactCompilerPreset} from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';

const rootDir = dirname(fileURLToPath(import.meta.url));

function resolveAppVersion(): string {
    const fromEnv = process.env.VITE_APP_VERSION?.trim();
    if (fromEnv) {
        return fromEnv;
    }
    if (process.env.GITHUB_REF_TYPE === 'tag') {
        const tagName = process.env.GITHUB_REF_NAME?.trim();
        if (tagName) {
            return tagName;
        }
    }
    try {
        const described = execSync('git describe --tags --always --dirty', {
            cwd: rootDir,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
        if (described) {
            return described;
        }
    } catch {
        // git unavailable in the build environment
    }
    try {
        const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8')) as {version: string};
        return pkg.version.startsWith('v') ? pkg.version : `v${pkg.version}`;
    } catch {
        return 'dev';
    }
}

const appVersion = resolveAppVersion();

// https://vite.dev/config/
export default defineConfig({
    define: {
        'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion)
    },
    plugins: [react(), babel({presets: [reactCompilerPreset()]}), tailwindcss()],
    // Keep a single React instance so react/compiler-runtime and react-dom share the same dispatcher
    // (avoids "Cannot read properties of null (reading 'useMemoCache')" after dep re-optimize / HMR).
    resolve: {
        dedupe: ['react', 'react-dom']
    },
    optimizeDeps: {
        include: ['react', 'react/compiler-runtime', 'react-dom', 'react-dom/client']
    }
});
