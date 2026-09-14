import {useEffect, useRef, useState} from 'react';
import type {CloudAuthSession, CloudProviderId, CloudTransport, CloudVaultSnapshot} from '../types/cloudSync';
import {
    clearCloudSyncAuth,
    loadCloudSyncState,
    patchCloudSyncState,
    type CloudSyncStoredState
} from '../lib/cloudSync/authStorage';
import {pullVaultFromCloud, pushVaultToCloud} from '../lib/cloudSync/engine';
import {listCloudTransports} from '../lib/cloudSync/transports';

export type CloudSyncStatus = 'idle' | 'connecting' | 'pushing' | 'pulling';

export type CloudProviderInfo = {
    id: CloudProviderId;
    label: string;
    configured: boolean;
};

type UseCloudSyncOptions = {
    /** True once the local vault has finished loading (initialized dashboard). */
    vaultReady: boolean;
    onApplySnapshot: (snapshot: CloudVaultSnapshot) => Promise<void>;
    transports?: CloudTransport[];
};

const PUSH_DEBOUNCE_MS = 600;

function providerList(transports: CloudTransport[]): CloudProviderInfo[] {
    return transports.map(transport => ({
        id: transport.id,
        label: transport.label,
        configured: transport.isConfigured()
    }));
}

function errorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message) return err.message;
    return fallback;
}

export function useCloudSync({vaultReady, onApplySnapshot, transports}: UseCloudSyncOptions) {
    const resolvedTransports = transports ?? listCloudTransports();
    const transportById = new Map(resolvedTransports.map(transport => [transport.id, transport]));

    const [stored, setStored] = useState<CloudSyncStoredState>(() => loadCloudSyncState());
    const [status, setStatus] = useState<CloudSyncStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [lastResult, setLastResult] = useState<string | null>(null);

    const storedRef = useRef(stored);
    const onApplyRef = useRef(onApplySnapshot);
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
            throw new Error(`${transport.label} is not configured. Add its OAuth client ID to the environment.`);
        }
        return transport;
    };

    const persistSession = (session: CloudAuthSession, extra?: Partial<CloudSyncStoredState>) => {
        persist(patchCloudSyncState({session, ...extra}));
    };

    const pullWithSession = async (
        transport: CloudTransport,
        session: CloudAuthSession,
        mode: 'auto' | 'manual'
    ): Promise<void> => {
        const {result, session: fresh} = await pullVaultFromCloud(transport, session, {
            mode,
            localRevision: storedRef.current.localRevision
        });

        if (result.status === 'applied') {
            await onApplyRef.current(result.snapshot);
            persistSession(fresh, {
                localRevision: result.snapshot.updatedAt,
                lastPullAt: new Date().toISOString()
            });
            setLastResult(
                mode === 'manual'
                    ? `Pulled vault from ${transport.label}. Unlock with your PIN if this is a new device.`
                    : `Updated from ${transport.label}.`
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

    const connect = async (providerId: CloudProviderId, options?: {pull?: boolean}) => {
        setError(null);
        setLastResult(null);
        setStatus('connecting');
        try {
            const transport = requireTransport(providerId);
            const session = await transport.authorize();
            persistSession(session);
            if (options?.pull !== false) {
                setStatus('pulling');
                await pullWithSession(transport, session, 'auto');
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

    const pull = async (providerId?: CloudProviderId) => {
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
            await pullWithSession(transport, session, 'manual');
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
            const {result, session: fresh} = await pushVaultToCloud(transport, session, updatedAt);
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
        if (!vaultReady || didAutoPullRef.current) return;
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
        // Run once when the vault finishes loading.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vaultReady]);

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
        schedulePush,
        clearError
    };
}

export type UseCloudSyncReturn = ReturnType<typeof useCloudSync>;
