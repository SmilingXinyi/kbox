import type {
    CloudAuthSession,
    CloudPullMode,
    CloudPullResult,
    CloudPushContext,
    CloudPushResult,
    CloudTransport
} from '../../types/cloudSync';
import {
    compareIsoTimestamps,
    createCloudVaultFile,
    decryptCloudVaultFile,
    parseCloudVaultFile,
    serializeCloudVaultFile
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
    context: CloudPushContext | null,
    updatedAt: string
): Promise<{result: CloudPushResult; session: CloudAuthSession}> {
    if (!context) {
        return {result: {status: 'skipped', reason: 'no-vault'}, session};
    }

    const fresh = await withFreshSession(transport, session);
    const file = await createCloudVaultFile(context, updatedAt);
    await transport.upload(fresh, serializeCloudVaultFile(file));
    return {result: {status: 'pushed', updatedAt}, session: fresh};
}

export async function pullVaultFromCloud(
    transport: CloudTransport,
    session: CloudAuthSession,
    options: {
        mode: CloudPullMode;
        localRevision: string | null;
        secret: {masterKeyHex: string} | {pin: string};
    }
): Promise<{result: CloudPullResult; session: CloudAuthSession}> {
    const fresh = await withFreshSession(transport, session);
    const raw = await transport.download(fresh);
    if (!raw) {
        return {result: {status: 'empty'}, session: fresh};
    }

    const file = parseCloudVaultFile(raw);
    if (options.mode === 'auto' && options.localRevision) {
        const cmp = compareIsoTimestamps(file.updatedAt, options.localRevision);
        if (cmp < 0) {
            return {result: {status: 'skipped', reason: 'local-newer'}, session: fresh};
        }
        if (cmp === 0) {
            return {result: {status: 'skipped', reason: 'same-revision'}, session: fresh};
        }
    }

    const snapshot = await decryptCloudVaultFile(file, options.secret);
    return {result: {status: 'applied', snapshot}, session: fresh};
}
