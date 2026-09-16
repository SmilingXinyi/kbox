import {useEffect, useRef, useState} from 'react';
import type {ApiKeyItem, LockBehavior, VaultMetadata} from '../types/vault';
import type {
    CloudAuthSession,
    CloudProviderId,
    CloudPushContext,
    CloudTransport,
    CloudVaultSnapshot
} from '../types/cloudSync';
import {
    clearCloudSyncAuth,
    loadCloudSyncState,
    patchCloudSyncState,
    type CloudSyncStoredState
} from '../lib/cloudSync/authStorage';
import {loadCloudClientId, saveCloudClientId} from '../lib/cloudSync/clientIds';
import {pullVaultFromCloud, pushVaultToCloud} from '../lib/cloudSync/engine';
import {listCloudTransports} from '../lib/cloudSync/transports';

export type CloudSyncStatus = 'idle' | 'connecting' | 'pushing' | 'pulling';

export type CloudProviderInfo = {
    id: CloudProviderId;
    label: string;
    configured: boolean;
    clientId: string;
};

type UseCloudSyncOptions = {
    vaultUnlocked: boolean;
    masterKeyHex: string | null;
    items: ApiKeyItem[];
    metadata: VaultMetadata | null;
    lockBehavior: LockBehavior;
    commonTags: string[];
    onApplySnapshot: (snapshot: CloudVaultSnapshot) => Promise<void>;
    transports?: CloudTransport[];
};

const PUSH_DEBOUNCE_MS = 600;

function providerList(transports: CloudTransport[]): CloudProviderInfo[] {
    return transports.map(transport => ({
        id: transport.id,
        label: transport.label,
        configured: transport.isConfigured(),
        clientId: loadCloudClientId(transport.id)
    }));
}

function errorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message) return err.message;
    return fallback;
}

export function useCloudSync({
    vaultUnlocked,
    masterKeyHex,
    items,
    metadata,
    lockBehavior,
    commonTags,
    onApplySnapshot,
    transports
}: UseCloudSyncOptions) {
    const resolvedTransports = transports ?? listCloudTransports();
    const transportById = new Map(resolvedTransports.map(transport => [transport.id, transport]));

    const [stored, setStored] = useState<CloudSyncStoredState>(() => loadCloudSyncState());
    const [status, setStatus] = useState<CloudSyncStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [lastResult, setLastResult] = useState<string | null>(null);
    const [, setClientIdsEpoch] = useState(0);

    const storedRef = useRef(stored);
    const onApplyRef = useRef(onApplySnapshot);
    const ctxRef = useRef({masterKeyHex, items, metadata, lockBehavior, commonTags});
    const didAutoPullRef = useRef(false);
    const pushTimerRef = useRef<number | null>(null);
    const inFlightRef = useRef(false);

    useEffect(() => {
        storedRef.current = stored;
    }, [stored]);

    useEffect(() => {
        onApplyRef.current = onApplySnapshot;
    }, [onApplySnapshot]);

    useEffect(() => {
        ctxRef.current = {masterKeyHex, items, metadata, lockBehavior, commonTags};
    }, [masterKeyHex, items, metadata, lockBehavior, commonTags]);

    useEffect(() => {
        return () => {
            if (pushTimerRef.current != null) {
                window.clearTimeout(pushTimerRef.current);
            }
        };
    }, []);

    const persist = (next: CloudSyncStoredState) => {
        setStored(next);
        storedRef.current = next;
    };

    const requireTransport = (id: CloudProviderId): CloudTransport => {
        const transport = transportById.get(id);
        if (!transport) {
            throw new Error('Unknown cloud provider.');
        }
        if (!transport.isConfigured()) {
            throw new Error(`Save an OAuth client ID for ${transport.label}, then authorize this page.`);
        }
        return transport;
    };

    const saveClientId = (providerId: CloudProviderId, clientId: string) => {
        saveCloudClientId(providerId, clientId);
        setClientIdsEpoch(value => value + 1);
    };

    const persistSession = (session: CloudAuthSession, extra?: Partial<CloudSyncStoredState>) => {
        persist(patchCloudSyncState({session, ...extra}));
    };

    const pushContext = (): CloudPushContext | null => {
        const ctx = ctxRef.current;
        if (!ctx.masterKeyHex || !ctx.metadata) return null;
        return {
            masterKeyHex: ctx.masterKeyHex,
            metadata: ctx.metadata,
            items: ctx.items,
            lockBehavior: ctx.lockBehavior,
            commonTags: ctx.commonTags
        };
    };

    const decryptSecret = (pin?: string): {masterKeyHex: string} | {pin: string} | null => {
        if (ctxRef.current.masterKeyHex) {
            return {masterKeyHex: ctxRef.current.masterKeyHex};
        }
        if (pin && pin.length > 0) {
            return {pin};
        }
        return null;
    };

    const pullWithSession = async (
        transport: CloudTransport,
        session: CloudAuthSession,
        mode: 'auto' | 'manual',
        pin?: string
    ): Promise<void> => {
        const secret = decryptSecret(pin);
        if (!secret) {
            if (mode === 'manual') {
                throw new Error('Enter your vault PIN to decrypt the cloud copy.');
            }
            setLastResult(`Connected to ${transport.label}. Unlock or enter your PIN to pull.`);
            return;
        }

        const {result, session: fresh} = await pullVaultFromCloud(transport, session, {
            mode,
            localRevision: storedRef.current.localRevision,
            secret
        });

        if (result.status === 'applied') {
            await onApplyRef.current(result.snapshot);
            persistSession(fresh, {
                localRevision: result.snapshot.updatedAt,
                lastPullAt: new Date().toISOString()
            });
            setLastResult(
                mode === 'manual' ? `Pulled vault from ${transport.label}.` : `Updated from ${transport.label}.`
            );
            return;
        }

        persistSession(fresh);

        if (result.status === 'empty') {
            if (mode === 'manual') {
                throw new Error(`No vault found on ${transport.label}.`);
            }
            setLastResult(`Connected to ${transport.label}. Nothing to pull yet.`);
            return;
        }

        setLastResult(`Local vault is already up to date with ${transport.label}.`);
    };

    const connect = async (providerId: CloudProviderId, options?: {pull?: boolean; pin?: string}) => {
        setError(null);
        setLastResult(null);
        setStatus('connecting');
        try {
            const transport = requireTransport(providerId);
            const session = await transport.authorize();
            persistSession(session);
            if (options?.pull !== false) {
                setStatus('pulling');
                await pullWithSession(transport, session, 'auto', options?.pin);
            } else {
                setLastResult(`Connected to ${transport.label}.`);
            }
            setStatus('idle');
        } catch (err) {
            setStatus('idle');
            const message = errorMessage(err, 'Failed to connect the cloud drive.');
            setError(message);
            throw err instanceof Error ? err : new Error(message);
        }
    };

    const disconnect = () => {
        persist(clearCloudSyncAuth());
        setError(null);
        setLastResult('Cloud drive disconnected on this device. Files on the drive are unchanged.');
        setStatus('idle');
    };

    const pull = async (providerId?: CloudProviderId, options?: {pin?: string}) => {
        setError(null);
        setLastResult(null);
        const requested = providerId ?? storedRef.current.session?.provider;
        if (!requested) {
            const message = 'Choose a cloud drive first.';
            setError(message);
            throw new Error(message);
        }

        setStatus('pulling');
        try {
            const transport = requireTransport(requested);
            let session = storedRef.current.session;
            if (!session || session.provider !== requested) {
                setStatus('connecting');
                session = await transport.authorize();
                persistSession(session);
                setStatus('pulling');
            }
            await pullWithSession(transport, session, 'manual', options?.pin);
            setStatus('idle');
        } catch (err) {
            setStatus('idle');
            const message = errorMessage(err, 'Failed to pull the vault from the cloud drive.');
            setError(message);
            throw err instanceof Error ? err : new Error(message);
        }
    };

    const pushNow = async () => {
        const session = storedRef.current.session;
        if (!session || inFlightRef.current) return;

        inFlightRef.current = true;
        setStatus('pushing');
        setError(null);
        try {
            const transport = requireTransport(session.provider);
            const updatedAt = new Date().toISOString();
            persist(patchCloudSyncState({localRevision: updatedAt}));
            const {result, session: fresh} = await pushVaultToCloud(transport, session, pushContext(), updatedAt);
            if (result.status === 'pushed') {
                persistSession(fresh, {lastPushAt: updatedAt, localRevision: updatedAt});
                setLastResult(`Pushed vault to ${transport.label}.`);
            } else {
                persistSession(fresh);
            }
            setStatus('idle');
        } catch (err) {
            setStatus('idle');
            setError(errorMessage(err, 'Failed to push the vault to the cloud drive.'));
        } finally {
            inFlightRef.current = false;
        }
    };

    const schedulePush = () => {
        if (!storedRef.current.session) return;
        if (pushTimerRef.current != null) {
            window.clearTimeout(pushTimerRef.current);
        }
        pushTimerRef.current = window.setTimeout(() => {
            pushTimerRef.current = null;
            void pushNow();
        }, PUSH_DEBOUNCE_MS);
    };

    useEffect(() => {
        if (!vaultUnlocked || didAutoPullRef.current) return;
        didAutoPullRef.current = true;
        const session = storedRef.current.session;
        if (!session) return;

        const transport = transportById.get(session.provider);
        if (!transport?.isConfigured()) return;

        setStatus('pulling');
        void pullWithSession(transport, session, 'auto')
            .catch(err => {
                setError(errorMessage(err, 'Failed to pull the vault from the cloud drive.'));
            })
            .finally(() => {
                setStatus('idle');
            });
        // Run once after this device is unlocked (master key in memory).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vaultUnlocked]);

    const clearError = () => setError(null);

    return {
        providers: providerList(resolvedTransports),
        session: stored.session,
        localRevision: stored.localRevision,
        lastPushAt: stored.lastPushAt,
        lastPullAt: stored.lastPullAt,
        status,
        error,
        lastResult,
        isBusy: status !== 'idle',
        connect,
        disconnect,
        pull,
        saveClientId,
        schedulePush,
        clearError
    };
}

export type UseCloudSyncReturn = ReturnType<typeof useCloudSync>;
