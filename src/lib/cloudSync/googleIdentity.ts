const GOOGLE_IDENTITY_SCRIPT_ID = 'google-identity-services';
const GOOGLE_IDENTITY_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

type GoogleTokenResponse = {
    access_token?: string;
    error?: string;
    error_description?: string;
    expires_in?: number;
};

type GoogleTokenClient = {
    requestAccessToken: (overrides?: {prompt?: string}) => void;
};

type GoogleIdentityServices = {
    accounts: {
        oauth2: {
            initTokenClient: (config: {
                client_id: string;
                scope: string;
                callback: (response: GoogleTokenResponse) => void;
                error_callback: (error: {message?: string; type?: string}) => void;
            }) => GoogleTokenClient;
        };
    };
};

declare global {
    interface Window {
        google?: GoogleIdentityServices;
    }
}

let googleIdentityPromise: Promise<GoogleIdentityServices> | null = null;

function googleIdentity(): GoogleIdentityServices | null {
    const google = window.google;
    return google?.accounts.oauth2 ? google : null;
}

function loadGoogleIdentity(): Promise<GoogleIdentityServices> {
    const ready = googleIdentity();
    if (ready) return Promise.resolve(ready);
    if (googleIdentityPromise) return googleIdentityPromise;

    googleIdentityPromise = new Promise((resolve, reject) => {
        const existing = document.getElementById(GOOGLE_IDENTITY_SCRIPT_ID) as HTMLScriptElement | null;
        const script = existing ?? document.createElement('script');

        const finish = () => {
            const loaded = googleIdentity();
            if (loaded) {
                resolve(loaded);
            } else {
                googleIdentityPromise = null;
                reject(new Error('Google Identity Services did not load. Try again.'));
            }
        };

        script.addEventListener('load', finish, {once: true});
        script.addEventListener(
            'error',
            () => {
                googleIdentityPromise = null;
                reject(new Error('Could not load Google Identity Services. Check your network and try again.'));
            },
            {once: true}
        );

        if (!existing) {
            script.id = GOOGLE_IDENTITY_SCRIPT_ID;
            script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
            script.async = true;
            document.head.append(script);
        }
    });

    return googleIdentityPromise;
}

export async function requestGoogleAccessToken(
    clientId: string,
    scope: string
): Promise<{accessToken: string; expiresAt: number}> {
    const google = await loadGoogleIdentity();

    return new Promise((resolve, reject) => {
        const tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope,
            callback: response => {
                if (response.error) {
                    reject(new Error(response.error_description || response.error));
                    return;
                }
                if (!response.access_token) {
                    reject(new Error('Google did not return an access token.'));
                    return;
                }
                const expiresIn = typeof response.expires_in === 'number' ? response.expires_in : 3600;
                resolve({accessToken: response.access_token, expiresAt: Date.now() + expiresIn * 1000});
            },
            error_callback: error => {
                reject(new Error(error.message || error.type || 'Google authorization was cancelled.'));
            }
        });

        tokenClient.requestAccessToken();
    });
}
