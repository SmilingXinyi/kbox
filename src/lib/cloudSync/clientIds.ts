import type {CloudProviderId} from '../../types/cloudSync';

const STORAGE_KEY = 'kbox_cloud_oauth_clients:v1';

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
        return {
            v: 1,
            ids: {
                'google-drive': sanitize(parsed.ids['google-drive']),
                onedrive: sanitize(parsed.ids.onedrive)
            }
        };
    } catch (e) {
        console.error('Failed to read cloud OAuth client IDs:', e);
        return EMPTY;
    }
}

function sanitize(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

export function loadCloudClientId(provider: CloudProviderId): string {
    return loadAll().ids[provider] ?? '';
}

export function saveCloudClientId(provider: CloudProviderId, clientId: string): void {
    const trimmed = clientId.trim();
    const next: StoredClients = {
        v: 1,
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
