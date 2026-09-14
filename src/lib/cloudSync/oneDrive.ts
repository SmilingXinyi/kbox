import type {CloudAuthSession, CloudTransport} from '../../types/cloudSync';
import {CLOUD_FILE_NAME, oneDriveClientId} from './config';
import {authorizeWithPkce, refreshOAuthToken, type PkceOAuthConfig} from './oauthPkce';

const GRAPH_ITEM = `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${CLOUD_FILE_NAME}`;

function oneDrivePkceConfig(): PkceOAuthConfig {
    const clientId = oneDriveClientId();
    if (!clientId) {
        throw new Error('OneDrive is not configured. Set VITE_ONEDRIVE_CLIENT_ID.');
    }
    return {
        authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        clientId,
        scopes: ['Files.ReadWrite.AppFolder', 'offline_access'],
        extraAuthParams: {
            prompt: 'select_account'
        },
        extraTokenParams: {
            scope: 'Files.ReadWrite.AppFolder offline_access'
        }
    };
}

async function readGraphError(response: Response): Promise<string> {
    try {
        const body = (await response.json()) as {error?: {message?: string} | string; error_description?: string};
        if (typeof body.error === 'object' && body.error?.message) return body.error.message;
        if (typeof body.error === 'string') return body.error;
        if (body.error_description) return body.error_description;
    } catch {
        // Fall through.
    }
    return `OneDrive request failed (${response.status}).`;
}

async function oneDriveTransportAuthorize(): Promise<CloudAuthSession> {
    const tokens = await authorizeWithPkce(oneDrivePkceConfig());
    return {
        provider: 'onedrive',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        accountLabel: 'OneDrive'
    };
}

async function oneDriveTransportRefresh(session: CloudAuthSession): Promise<CloudAuthSession> {
    if (!session.refreshToken) {
        throw new Error('OneDrive session expired. Reconnect the drive.');
    }
    const tokens = await refreshOAuthToken(oneDrivePkceConfig(), session.refreshToken);
    return {
        ...session,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt
    };
}

async function oneDriveTransportUpload(session: CloudAuthSession, body: string): Promise<void> {
    const response = await fetch(`${GRAPH_ITEM}:/content`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json'
        },
        body
    });
    if (!response.ok) {
        throw new Error(await readGraphError(response));
    }
}

async function oneDriveTransportDownload(session: CloudAuthSession): Promise<string | null> {
    const response = await fetch(`${GRAPH_ITEM}:/content`, {
        headers: {Authorization: `Bearer ${session.accessToken}`}
    });
    if (response.status === 404) return null;
    if (!response.ok) {
        throw new Error(await readGraphError(response));
    }
    return response.text();
}

export const oneDriveTransport: CloudTransport = {
    id: 'onedrive',
    label: 'OneDrive',
    isConfigured: () => oneDriveClientId().length > 0,
    authorize: oneDriveTransportAuthorize,
    refresh: oneDriveTransportRefresh,
    upload: oneDriveTransportUpload,
    download: oneDriveTransportDownload
};
