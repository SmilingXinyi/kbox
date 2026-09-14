import type {
    CloudAuthSession,
    CloudPullMode,
    CloudPullResult,
    CloudPushResult,
    CloudTransport
} from '../../types/cloudSync';
import {
    compareIsoTimestamps,
    parseCloudVaultSnapshot,
    readLocalCloudSnapshot,
    serializeCloudVaultSnapshot
} from './snapshot';

const TOKEN_EXPIRY_SKEW_MS = 60_000;

export async function withFreshSession(
    transport: CloudTransport,
    session: CloudAuthSession
): Promise<CloudAuthSession> {
    if (session.expiresAt > Date.now() + TOKEN_EXPIRY_SKEW_MS) {
        return session;
    }
    return transport.refresh(session);
}

export async function pushVaultToCloud(
    transport: CloudTransport,
    session: CloudAuthSession,
    updatedAt: string
): Promise<{result: CloudPushResult; session: CloudAuthSession}> {
    const snapshot = await readLocalCloudSnapshot(updatedAt);
    if (!snapshot) {
        return {result: {status: 'skipped', reason: 'no-vault'}, session};
    }

    const fresh = await withFreshSession(transport, session);
    await transport.upload(fresh, serializeCloudVaultSnapshot(snapshot));
    return {result: {status: 'pushed', updatedAt}, session: fresh};
}

export async function pullVaultFromCloud(
    transport: CloudTransport,
    session: CloudAuthSession,
    options: {mode: CloudPullMode; localRevision: string | null}
): Promise<{result: CloudPullResult; session: CloudAuthSession}> {
    const fresh = await withFreshSession(transport, session);
    const raw = await transport.download(fresh);
    if (!raw) {
        return {result: {status: 'empty'}, session: fresh};
    }

    const snapshot = parseCloudVaultSnapshot(raw);
    if (options.mode === 'auto' && options.localRevision) {
        const cmp = compareIsoTimestamps(snapshot.updatedAt, options.localRevision);
        if (cmp < 0) {
            return {result: {status: 'skipped', reason: 'local-newer'}, session: fresh};
        }
        if (cmp === 0) {
            return {result: {status: 'skipped', reason: 'same-revision'}, session: fresh};
        }
    }

    return {result: {status: 'applied', snapshot}, session: fresh};
}
