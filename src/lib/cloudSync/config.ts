import type {CloudProviderId} from '../../types/cloudSync';

export const CLOUD_FILE_NAME = 'kbox-vault.json';

export function googleDriveClientId(): string {
    return import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID?.trim() ?? '';
}

export function oneDriveClientId(): string {
    return import.meta.env.VITE_ONEDRIVE_CLIENT_ID?.trim() ?? '';
}

export function isCloudProviderConfigured(id: CloudProviderId): boolean {
    if (id === 'google-drive') return googleDriveClientId().length > 0;
    return oneDriveClientId().length > 0;
}

export function cloudOAuthRedirectUri(): string {
    const base = import.meta.env.BASE_URL || '/';
    const path = base.endsWith('/') ? base : `${base}/`;
    return `${window.location.origin}${path}?kbox_cloud_oauth=1`;
}
