/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_APP_VERSION: string;
    readonly VITE_ENABLE_BIOMETRIC_SIMULATOR?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
