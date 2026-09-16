import type {CloudProviderId} from '../../types/cloudSync';
import {loadCloudClientId} from './clientIds';

export const CLOUD_FILE_NAME = 'kbox-vault.json';

export function googleDriveClientId(): string {
    return loadCloudClientId('google-drive');
}

export function oneDriveClientId(): string {
    return loadCloudClientId('onedrive');
}

export function isCloudProviderConfigured(id: CloudProviderId): boolean {
    if (id === 'google-drive') return googleDriveClientId().length > 0;
    return oneDriveClientId().length > 0;
}

/** Authorized JavaScript origin for Google / Entra SPA registration. */
export function cloudOAuthJavaScriptOrigin(): string {
    return window.location.origin;
}

export function cloudOAuthRedirectUri(): string {
    const base = import.meta.env.BASE_URL || '/';
    const path = base.endsWith('/') ? base : `${base}/`;
    return `${window.location.origin}${path}?kbox_cloud_oauth=1`;
}
