import {generateRandomHex} from '../crypto';
import {cloudOAuthRedirectUri} from './config';

const OAUTH_MESSAGE_TYPE = 'kbox-cloud-oauth';
const VERIFIER_STORAGE_KEY = 'kbox_cloud_oauth_pkce:v1';

export type OAuthTokenSet = {
    accessToken: string;
    refreshToken?: string;
    expiresAt: number;
};

type PkcePending = {
    state: string;
    verifier: string;
};

type OAuthMessage = {
    type: typeof OAUTH_MESSAGE_TYPE;
    state?: string;
    code?: string;
    error?: string;
};

export type PkceOAuthConfig = {
    authorizationEndpoint: string;
    tokenEndpoint: string;
    clientId: string;
    scopes: string[];
    extraAuthParams?: Record<string, string>;
    extraTokenParams?: Record<string, string>;
};

function toBase64Url(bytes: ArrayBuffer): string {
    const bin = String.fromCharCode(...new Uint8Array(bytes));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Base64Url(input: string): Promise<string> {
    const data = new TextEncoder().encode(input);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return toBase64Url(digest);
}

function readPending(): PkcePending | null {
    try {
        const raw = sessionStorage.getItem(VERIFIER_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<PkcePending>;
        if (typeof parsed.state === 'string' && typeof parsed.verifier === 'string') {
            return {state: parsed.state, verifier: parsed.verifier};
        }
    } catch (e) {
        console.error('Failed to read OAuth PKCE state:', e);
    }
    return null;
}

function writePending(pending: PkcePending): void {
    sessionStorage.setItem(VERIFIER_STORAGE_KEY, JSON.stringify(pending));
}

function clearPending(): void {
    sessionStorage.removeItem(VERIFIER_STORAGE_KEY);
}

export function completeCloudOAuthIfPopup(): boolean {
    const params = new URLSearchParams(window.location.search);
    if (params.get('kbox_cloud_oauth') !== '1') return false;

    const payload: OAuthMessage = {
        type: OAUTH_MESSAGE_TYPE,
        state: params.get('state') ?? undefined,
        code: params.get('code') ?? undefined,
        error: params.get('error_description') || params.get('error') || undefined
    };

    if (window.opener && !window.opener.closed) {
        window.opener.postMessage(payload, window.location.origin);
    }

    document.documentElement.innerHTML =
        '<body style="background:#0a0a0a;color:#f2f2f2;font:14px/1.4 system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><p>You can close this window.</p></body>';
    window.close();
    return true;
}

async function exchangeCode(config: PkceOAuthConfig, code: string, verifier: string): Promise<OAuthTokenSet> {
    const body = new URLSearchParams({
        client_id: config.clientId,
        code,
        code_verifier: verifier,
        grant_type: 'authorization_code',
        redirect_uri: cloudOAuthRedirectUri(),
        ...config.extraTokenParams
    });

    const response = await fetch(config.tokenEndpoint, {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body
    });

    const json = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
        const description =
            typeof json.error_description === 'string'
                ? json.error_description
                : `Token exchange failed (${response.status}).`;
        throw new Error(description);
    }

    const accessToken = json.access_token;
    if (typeof accessToken !== 'string' || !accessToken) {
        throw new Error('Authorization server did not return an access token.');
    }

    const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : 3600;
    const refreshToken = typeof json.refresh_token === 'string' && json.refresh_token ? json.refresh_token : undefined;

    return {
        accessToken,
        refreshToken,
        expiresAt: Date.now() + expiresIn * 1000
    };
}

export async function refreshOAuthToken(
    config: Pick<PkceOAuthConfig, 'tokenEndpoint' | 'clientId' | 'extraTokenParams'>,
    refreshToken: string
): Promise<OAuthTokenSet> {
    const body = new URLSearchParams({
        client_id: config.clientId,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        ...config.extraTokenParams
    });

    const response = await fetch(config.tokenEndpoint, {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body
    });

    const json = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
        const description =
            typeof json.error_description === 'string'
                ? json.error_description
                : `Token refresh failed (${response.status}).`;
        throw new Error(description);
    }

    const accessToken = json.access_token;
    if (typeof accessToken !== 'string' || !accessToken) {
        throw new Error('Authorization server did not return a refreshed access token.');
    }

    const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : 3600;
    const nextRefresh =
        typeof json.refresh_token === 'string' && json.refresh_token ? json.refresh_token : refreshToken;

    return {
        accessToken,
        refreshToken: nextRefresh,
        expiresAt: Date.now() + expiresIn * 1000
    };
}

export async function authorizeWithPkce(config: PkceOAuthConfig): Promise<OAuthTokenSet> {
    const pending: PkcePending = {
        state: generateRandomHex(16),
        verifier: generateRandomHex(32)
    };
    writePending(pending);

    const challenge = await sha256Base64Url(pending.verifier);
    const redirectUri = cloudOAuthRedirectUri();
    const authUrl = new URL(config.authorizationEndpoint);
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', config.scopes.join(' '));
    authUrl.searchParams.set('state', pending.state);
    authUrl.searchParams.set('code_challenge', challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    for (const [key, value] of Object.entries(config.extraAuthParams ?? {})) {
        authUrl.searchParams.set(key, value);
    }

    const popup = window.open(authUrl.toString(), 'kbox-cloud-oauth', 'width=480,height=720');
    if (!popup) {
        clearPending();
        throw new Error('Pop-up blocked. Allow pop-ups to connect a cloud drive.');
    }

    return new Promise<OAuthTokenSet>((resolve, reject) => {
        let settled = false;
        let inFlight = false;

        const finish = (fn: () => void) => {
            if (settled) return;
            settled = true;
            window.clearInterval(pollTimer);
            window.removeEventListener('message', onMessage);
            clearPending();
            fn();
        };

        const onMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            const data = event.data as OAuthMessage | null;
            if (!data || data.type !== OAUTH_MESSAGE_TYPE) return;
            void handleCallback(data);
        };

        const handleCallback = async (data: OAuthMessage) => {
            if (settled || inFlight) return;
            inFlight = true;
            const stored = readPending();
            if (!stored || data.state !== stored.state) {
                finish(() => reject(new Error('OAuth state mismatch. Try connecting again.')));
                return;
            }
            if (data.error) {
                finish(() => reject(new Error(data.error)));
                return;
            }
            if (!data.code) {
                finish(() => reject(new Error('Authorization did not return a code.')));
                return;
            }
            try {
                const tokens = await exchangeCode(config, data.code, stored.verifier);
                try {
                    popup.close();
                } catch {
                    // Ignore close failures.
                }
                finish(() => resolve(tokens));
            } catch (e) {
                finish(() => reject(e instanceof Error ? e : new Error('Token exchange failed.')));
            }
        };

        const pollTimer = window.setInterval(() => {
            if (settled || inFlight) return;
            if (popup.closed) {
                finish(() => reject(new Error('Authorization cancelled.')));
                return;
            }
            try {
                const href = popup.location.href;
                const url = new URL(href);
                if (url.searchParams.get('kbox_cloud_oauth') === '1') {
                    void handleCallback({
                        type: OAUTH_MESSAGE_TYPE,
                        state: url.searchParams.get('state') ?? undefined,
                        code: url.searchParams.get('code') ?? undefined,
                        error: url.searchParams.get('error_description') || url.searchParams.get('error') || undefined
                    });
                }
            } catch {
                // Still on the identity provider origin.
            }
        }, 400);

        window.addEventListener('message', onMessage);
    });
}
