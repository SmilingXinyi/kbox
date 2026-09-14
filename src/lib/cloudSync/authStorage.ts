import type {CloudAuthSession, CloudProviderId} from '../../types/cloudSync';

const STORAGE_KEY = 'kbox_cloud_sync:v1';

export type CloudSyncStoredState = {
    v: 1;
    session: CloudAuthSession | null;
    /** ISO timestamp of the last local mutation or applied cloud snapshot. */
    localRevision: string | null;
    lastPushAt: string | null;
    lastPullAt: string | null;
};

const EMPTY_STATE: CloudSyncStoredState = {
    v: 1,
    session: null,
    localRevision: null,
    lastPushAt: null,
    lastPullAt: null
};

function isProviderId(value: unknown): value is CloudProviderId {
    return value === 'google-drive' || value === 'onedrive';
}

function isSession(value: unknown): value is CloudAuthSession {
    if (!value || typeof value !== 'object') return false;
    const session = value as CloudAuthSession;
    return (
        isProviderId(session.provider) &&
        typeof session.accessToken === 'string' &&
        session.accessToken.length > 0 &&
        typeof session.expiresAt === 'number' &&
        (session.refreshToken === undefined || typeof session.refreshToken === 'string') &&
        (session.accountLabel === undefined || typeof session.accountLabel === 'string')
    );
}

export function loadCloudSyncState(): CloudSyncStoredState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return EMPTY_STATE;
        const parsed = JSON.parse(raw) as Partial<CloudSyncStoredState>;
        if (parsed.v !== 1) return EMPTY_STATE;
        return {
            v: 1,
            session: isSession(parsed.session) ? parsed.session : null,
            localRevision: typeof parsed.localRevision === 'string' ? parsed.localRevision : null,
            lastPushAt: typeof parsed.lastPushAt === 'string' ? parsed.lastPushAt : null,
            lastPullAt: typeof parsed.lastPullAt === 'string' ? parsed.lastPullAt : null
        };
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
        throw new Error('Could not save cloud sync authorization on this device.', {cause: e});
    }
}

export function patchCloudSyncState(patch: Partial<Omit<CloudSyncStoredState, 'v'>>): CloudSyncStoredState {
    const next: CloudSyncStoredState = {
        ...loadCloudSyncState(),
        ...patch,
        v: 1
    };
    saveCloudSyncState(next);
    return next;
}

export function clearCloudSyncAuth(): CloudSyncStoredState {
    return patchCloudSyncState({session: null});
}
