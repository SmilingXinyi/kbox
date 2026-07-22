import {defineConfig} from 'vite';
import react, {reactCompilerPreset} from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
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
