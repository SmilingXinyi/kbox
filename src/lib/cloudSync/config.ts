import {loadCloudClientId} from './clientIds';

export const CLOUD_FILE_NAME = 'kbox-vault.json';

export function googleDriveClientId(): string {
    return loadCloudClientId('google-drive');
}

/** Authorized JavaScript origin for the Google Web client. */
export function cloudOAuthJavaScriptOrigin(): string {
    return window.location.origin;
}
