import type {CloudProviderId} from '../../types/cloudSync';

const STORAGE_KEY = 'kbox_cloud_sync:v1';

export type CloudSyncStoredState = {
    v: 1;
    session: null;
    /** ISO timestamp of the last local mutation or applied cloud snapshot. */
    localRevision: string | null;
    lastPushAt: string | null;
    lastPullAt: string | null;
    /** When true, persist/unlock may push and pull without an extra click. Default off. */
    autoSync: boolean;
};

const EMPTY_STATE: CloudSyncStoredState = {
    v: 1,
    session: null,
    localRevision: null,
    lastPushAt: null,
    lastPullAt: null,
    autoSync: false
};

function isLegacyProviderId(value: unknown): value is CloudProviderId | 'onedrive' {
    return value === 'google-drive' || value === 'onedrive';
}

export function loadCloudSyncState(): CloudSyncStoredState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return EMPTY_STATE;
        const parsed = JSON.parse(raw) as {
            v?: unknown;
            session?: {provider?: unknown} | null;
            localRevision?: unknown;
            lastPushAt?: unknown;
            lastPullAt?: unknown;
            autoSync?: unknown;
        };
        if (parsed.v !== 1) return EMPTY_STATE;
        const hadLegacySession = parsed.session != null && isLegacyProviderId(parsed.session.provider);
        const state: CloudSyncStoredState = {
            v: 1,
            session: null,
            localRevision: typeof parsed.localRevision === 'string' ? parsed.localRevision : null,
            lastPushAt: typeof parsed.lastPushAt === 'string' ? parsed.lastPushAt : null,
            lastPullAt: typeof parsed.lastPullAt === 'string' ? parsed.lastPullAt : null,
            autoSync: parsed.autoSync === true
        };
        if (hadLegacySession || parsed.session != null || parsed.autoSync == null) {
            saveCloudSyncState(state);
        }
        return state;
    } catch (e) {
        console.error('Failed to read cloud sync state:', e);
        return EMPTY_STATE;
    }
}

export function saveCloudSyncState(state: CloudSyncStoredState): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error('Failed to persist cloud sync state:', e);
        throw new Error('Could not save cloud sync settings on this device.', {cause: e});
    }
}

export function patchCloudSyncState(patch: Partial<Omit<CloudSyncStoredState, 'v' | 'session'>>): CloudSyncStoredState {
    const next: CloudSyncStoredState = {
        ...loadCloudSyncState(),
        ...patch,
        v: 1,
        session: null
    };
    saveCloudSyncState(next);
    return next;
}

/** Wipe drive sync state on this device (Reset). Files on Google Drive are unchanged. */
export function clearCloudSyncState(): CloudSyncStoredState {
    saveCloudSyncState(EMPTY_STATE);
    return {...EMPTY_STATE};
}
