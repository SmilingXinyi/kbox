import type {CloudAuthSession, CloudTransport} from '../../types/cloudSync';
import {CLOUD_FILE_NAME, googleDriveClientId} from './config';
import {authorizeWithPkce, refreshOAuthToken, type PkceOAuthConfig} from './oauthPkce';

const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

function googlePkceConfig(clientId = googleDriveClientId()): PkceOAuthConfig {
    if (!clientId) {
        throw new Error('Save a Google Drive OAuth client ID, then authorize this page.');
    }
    return {
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
        clientId,
        scopes: ['https://www.googleapis.com/auth/drive.appdata'],
        extraAuthParams: {
            access_type: 'offline',
            include_granted_scopes: 'true'
        }
    };
}

async function driveJson<T>(session: CloudAuthSession, url: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${session.accessToken}`);
    const response = await fetch(url, {...init, headers});
    if (!response.ok) {
        throw new Error(await readGoogleError(response));
    }
    if (response.status === 204) {
        return undefined as T;
    }
    return (await response.json()) as T;
}

async function readGoogleError(response: Response): Promise<string> {
    try {
        const body = (await response.json()) as {error?: {message?: string} | string; error_description?: string};
        if (typeof body.error === 'object' && body.error?.message) return body.error.message;
        if (typeof body.error === 'string') return body.error;
        if (body.error_description) return body.error_description;
    } catch {
        // Fall through.
    }
    return `Google Drive request failed (${response.status}).`;
}

async function findVaultFileId(session: CloudAuthSession): Promise<string | null> {
    const query = encodeURIComponent(`name='${CLOUD_FILE_NAME}'`);
    const url = `${DRIVE_FILES}?spaces=appDataFolder&q=${query}&fields=files(id,name)&pageSize=1`;
    const data = await driveJson<{files?: {id?: string}[]}>(session, url);
    const id = data.files?.[0]?.id;
    return typeof id === 'string' && id ? id : null;
}

async function googleDriveTransportAuthorize(): Promise<CloudAuthSession> {
    const clientId = googleDriveClientId();
    const tokens = await authorizeWithPkce(googlePkceConfig(clientId));
    return {
        provider: 'google-drive',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        accountLabel: 'Google Drive',
        clientId
    };
}

async function googleDriveTransportRefresh(session: CloudAuthSession): Promise<CloudAuthSession> {
    if (!session.refreshToken) {
        throw new Error('Google Drive session expired. Reconnect the drive.');
    }
    const clientId = session.clientId || googleDriveClientId();
    const tokens = await refreshOAuthToken(googlePkceConfig(clientId), session.refreshToken);
    return {
        ...session,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        clientId
    };
}

async function googleDriveTransportUpload(session: CloudAuthSession, body: string): Promise<void> {
    const existingId = await findVaultFileId(session);
    if (existingId) {
        const response = await fetch(`${DRIVE_UPLOAD}/${existingId}?uploadType=media`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${session.accessToken}`,
                'Content-Type': 'application/json'
            },
            body
        });
        if (!response.ok) {
            throw new Error(await readGoogleError(response));
        }
        return;
    }

    const metadata = {
        name: CLOUD_FILE_NAME,
        parents: ['appDataFolder'],
        mimeType: 'application/json'
    };
    const boundary = `kbox_${Date.now().toString(16)}`;
    const multipart = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        JSON.stringify(metadata),
        `--${boundary}`,
        'Content-Type: application/json',
        '',
        body,
        `--${boundary}--`
    ].join('\r\n');

    const response = await fetch(`${DRIVE_UPLOAD}?uploadType=multipart`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipart
    });
    if (!response.ok) {
        throw new Error(await readGoogleError(response));
    }
}

async function googleDriveTransportDownload(session: CloudAuthSession): Promise<string | null> {
    const fileId = await findVaultFileId(session);
    if (!fileId) return null;

    const response = await fetch(`${DRIVE_FILES}/${fileId}?alt=media`, {
        headers: {Authorization: `Bearer ${session.accessToken}`}
    });
    if (response.status === 404) return null;
    if (!response.ok) {
        throw new Error(await readGoogleError(response));
    }
    return response.text();
}

export const googleDriveTransport: CloudTransport = {
    id: 'google-drive',
    label: 'Google Drive',
    isConfigured: () => googleDriveClientId().length > 0,
    authorize: googleDriveTransportAuthorize,
    refresh: googleDriveTransportRefresh,
    upload: googleDriveTransportUpload,
    download: googleDriveTransportDownload
};
