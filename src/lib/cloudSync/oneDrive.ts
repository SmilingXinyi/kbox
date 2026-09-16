import type {CloudAuthSession, CloudTransport} from '../../types/cloudSync';
import {CLOUD_FILE_NAME, oneDriveClientId} from './config';
import {authorizeWithPkce, refreshOAuthToken, type PkceOAuthConfig} from './oauthPkce';

const GRAPH_ITEM = `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${CLOUD_FILE_NAME}`;

function oneDrivePkceConfig(clientId = oneDriveClientId()): PkceOAuthConfig {
    if (!clientId) {
        throw new Error('Save a OneDrive OAuth client ID, then authorize this page.');
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
    const clientId = oneDriveClientId();
    const tokens = await authorizeWithPkce(oneDrivePkceConfig(clientId));
    return {
        provider: 'onedrive',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        accountLabel: 'OneDrive',
        clientId
    };
}

async function oneDriveTransportRefresh(session: CloudAuthSession): Promise<CloudAuthSession> {
    if (!session.refreshToken) {
        throw new Error('OneDrive session expired. Reconnect the drive.');
    }
    const clientId = session.clientId || oneDriveClientId();
    const tokens = await refreshOAuthToken(oneDrivePkceConfig(clientId), session.refreshToken);
    return {
        ...session,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        clientId
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
