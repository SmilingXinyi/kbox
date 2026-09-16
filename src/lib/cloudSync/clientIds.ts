import type {CloudProviderId} from '../../types/cloudSync';

const STORAGE_KEY = 'kbox_cloud_oauth_clients:v1';

/** Public Google OAuth Web client ID shipped with kbox (not a secret). */
export const KBOX_GOOGLE_DRIVE_CLIENT_ID = '144429774833-7s6jocb2d7d9cja73teu0jchihq7hqf6.apps.googleusercontent.com';

const BUILTIN_CLIENT_IDS: Partial<Record<CloudProviderId, string>> = {
    'google-drive': KBOX_GOOGLE_DRIVE_CLIENT_ID
};

type StoredClients = {
    v: 1;
    ids: Partial<Record<CloudProviderId, string>>;
};

const EMPTY: StoredClients = {v: 1, ids: {}};

function loadAll(): StoredClients {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return EMPTY;
        const parsed = JSON.parse(raw) as Partial<StoredClients>;
        if (parsed.v !== 1 || !parsed.ids || typeof parsed.ids !== 'object') return EMPTY;
        const clients: StoredClients = {
            v: 1,
            ids: {
                'google-drive': sanitize(parsed.ids['google-drive']),
                onedrive: sanitize(parsed.ids.onedrive)
            }
        };
        return clients;
    } catch (e) {
        console.error('Failed to read cloud OAuth client IDs:', e);
        return EMPTY;
    }
}

/** Removes credentials left by pre-GIS versions without writing during render. */
export function clearLegacyCloudClientSecrets(): void {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<StoredClients>;
        if (parsed.v !== 1 || !parsed.ids || typeof parsed.ids !== 'object' || !('secrets' in parsed)) return;
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                v: 1,
                ids: {
                    'google-drive': sanitize(parsed.ids['google-drive']),
                    onedrive: sanitize(parsed.ids.onedrive)
                }
            } satisfies StoredClients)
        );
    } catch (e) {
        console.error('Failed to remove legacy cloud OAuth secrets:', e);
    }
}

function sanitize(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

export function loadCloudClientId(provider: CloudProviderId): string {
    return loadAll().ids[provider] ?? BUILTIN_CLIENT_IDS[provider] ?? '';
}

export function saveCloudClientId(provider: CloudProviderId, clientId: string): void {
    const trimmed = clientId.trim();
    const next: StoredClients = {
        ...loadAll(),
        ids: {
            ...loadAll().ids,
            [provider]: trimmed || undefined
        }
    };
    if (!trimmed) {
        delete next.ids[provider];
    }
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
        console.error('Failed to persist cloud OAuth client ID:', e);
        throw new Error('Could not save the OAuth client ID on this device.', {cause: e});
    }
}
