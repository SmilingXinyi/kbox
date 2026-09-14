/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_APP_VERSION: string;
    readonly VITE_ENABLE_BIOMETRIC_SIMULATOR?: string;
    readonly VITE_GOOGLE_DRIVE_CLIENT_ID?: string;
    readonly VITE_ONEDRIVE_CLIENT_ID?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
