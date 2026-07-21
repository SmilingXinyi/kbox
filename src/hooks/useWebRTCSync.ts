import {useEffect, useRef, useState} from 'react';
import type {ApiKeyItem} from '../types/vault';
import type {SyncPeerSummary, SyncRole, SyncSessionState, SyncStrategy} from '../types/sync';
import {parseSyncQrPayload, renderSyncQrDataUrl} from '../lib/syncQr';
import {toSyncPayload, isSyncPayloadValid} from '../lib/syncPayload';
import {WebRtcSyncSession} from '../lib/webrtcSync';

type UseWebRTCSyncOptions = {
    localItems: ApiKeyItem[];
    /** Persist plaintext items (re-encrypted by vault layer). */
    onReplaceItems: (items: ApiKeyItem[]) => Promise<void>;
};

export function useWebRTCSync({localItems, onReplaceItems}: UseWebRTCSyncOptions) {
    const [sessionState, setSessionState] = useState<SyncSessionState>('idle');
    const [role, setRole] = useState<SyncRole | null>(null);
    const [peerId, setPeerId] = useState<string | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [remote, setRemote] = useState<SyncPeerSummary | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [lastSyncedCount, setLastSyncedCount] = useState<number | null>(null);
    const [pendingIncoming, setPendingIncoming] = useState<{
        strategy: SyncStrategy;
        items?: ApiKeyItem[];
    } | null>(null);

    const sessionRef = useRef<WebRtcSyncSession | null>(null);
    const pendingStrategyRef = useRef<SyncStrategy | null>(null);
    const localItemsRef = useRef(localItems);
    const onReplaceItemsRef = useRef(onReplaceItems);

    useEffect(() => {
        localItemsRef.current = localItems;
        onReplaceItemsRef.current = onReplaceItems;
    }, [localItems, onReplaceItems]);

    const clearError = () => setError(null);

    const teardown = () => {
        sessionRef.current?.destroy();
        sessionRef.current = null;
        pendingStrategyRef.current = null;
        setPeerId(null);
        setQrDataUrl(null);
        setRemote(null);
        setPendingIncoming(null);
        setRole(null);
        setLastSyncedCount(null);
        setSessionState('idle');
    };

    useEffect(() => {
        return () => {
            sessionRef.current?.destroy();
            sessionRef.current = null;
        };
    }, []);

    const handleIncomingSyncRequest = async (strategy: SyncStrategy, items: ApiKeyItem[] | undefined) => {
        const session = sessionRef.current;
        if (!session) return;

        // Host A overwrites guest B: guest receives items and applies.
        if (strategy === 'a-overwrites-b') {
            if (!items || !isSyncPayloadValid(items)) {
                session.sendSyncReject('Missing vault payload from host.');
                return;
            }
            setSessionState('syncing');
            try {
                await onReplaceItemsRef.current(items);
                session.sendSyncComplete(items.length);
                setLastSyncedCount(items.length);
                setSessionState('synced');
            } catch (e) {
                console.error('Failed to apply host vault:', e);
                const message = e instanceof Error ? e.message : 'Failed to apply synced vault.';
                session.sendSyncReject(message);
                setError(message);
                setSessionState('connected');
            }
            return;
        }

        // Host requests guest vault (B overwrites A): guest sends local plaintext items.
        if (strategy === 'b-overwrites-a') {
            setSessionState('syncing');
            try {
                session.sendSyncData(toSyncPayload(localItemsRef.current));
            } catch (e) {
                console.error('Failed to send guest vault:', e);
                const message = e instanceof Error ? e.message : 'Failed to send vault data.';
                session.sendSyncReject(message);
                setError(message);
                setSessionState('connected');
            }
        }
    };

    const handleIncomingSyncData = async (items: ApiKeyItem[]) => {
        const session = sessionRef.current;
        if (!session) return;

        if (!isSyncPayloadValid(items)) {
            setError('Received invalid vault payload.');
            session.sendSyncReject('Invalid vault payload.');
            setSessionState('connected');
            pendingStrategyRef.current = null;
            return;
        }

        // Host receives guest data for b-overwrites-a.
        if (pendingStrategyRef.current !== 'b-overwrites-a') {
            setPendingIncoming({strategy: 'b-overwrites-a', items});
            return;
        }

        setSessionState('syncing');
        try {
            await onReplaceItemsRef.current(items);
            session.sendSyncComplete(items.length);
            setLastSyncedCount(items.length);
            setSessionState('synced');
            pendingStrategyRef.current = null;
        } catch (e) {
            console.error('Failed to apply guest vault:', e);
            const message = e instanceof Error ? e.message : 'Failed to apply synced vault.';
            session.sendSyncReject(message);
            setError(message);
            setSessionState('connected');
            pendingStrategyRef.current = null;
        }
    };

    const createSession = (nextRole: SyncRole) => {
        sessionRef.current?.destroy();

        const session = new WebRtcSyncSession(nextRole, {
            onPeerId: id => setPeerId(id),
            onStateChange: state => {
                if (state === 'waiting') setSessionState('waiting');
                else if (state === 'connecting') setSessionState('connecting');
                else if (state === 'connected') setSessionState('connected');
                else if (state === 'starting') setSessionState('starting');
                else if (state === 'error') setSessionState('error');
                else if (state === 'closed') {
                    setSessionState(prev => (prev === 'synced' ? 'synced' : 'closed'));
                }
            },
            onRemoteSummary: summary => setRemote(summary),
            onIncomingSyncRequest: (strategy, items) => {
                void handleIncomingSyncRequest(strategy, items);
            },
            onIncomingSyncData: items => {
                void handleIncomingSyncData(items);
            },
            onSyncComplete: count => {
                setLastSyncedCount(count);
                setRemote(prev => (prev ? {...prev, itemCount: count} : prev));
                setSessionState('synced');
                setPendingIncoming(null);
                pendingStrategyRef.current = null;
            },
            onSyncRejected: reason => {
                setError(reason);
                setSessionState('connected');
                pendingStrategyRef.current = null;
                setPendingIncoming(null);
            },
            onError: message => {
                setError(message);
            }
        });

        sessionRef.current = session;
        return session;
    };

    const startHost = async () => {
        setError(null);
        setRemote(null);
        setPendingIncoming(null);
        setLastSyncedCount(null);
        setRole('host');
        setSessionState('starting');

        try {
            const session = createSession('host');
            const id = await session.startHost(localItemsRef.current.length);
            const dataUrl = await renderSyncQrDataUrl(id);
            setQrDataUrl(dataUrl);
            setSessionState('waiting');
        } catch (e) {
            console.error('Failed to start sync host:', e);
            setError(e instanceof Error ? e.message : 'Failed to start sync service.');
            setSessionState('error');
        }
    };

    const startGuestScan = () => {
        setError(null);
        setRemote(null);
        setPendingIncoming(null);
        setLastSyncedCount(null);
        setQrDataUrl(null);
        setPeerId(null);
        setRole('guest');
        setSessionState('scanning');
    };

    const connectWithQrText = async (raw: string) => {
        const payload = parseSyncQrPayload(raw);
        if (!payload) {
            setError('Invalid sync QR code.');
            return;
        }

        setError(null);
        setRole('guest');
        setSessionState('connecting');

        try {
            const session = createSession('guest');
            await session.connectAsGuest(payload.peerId, localItemsRef.current.length);
        } catch (e) {
            console.error('Failed to connect as guest:', e);
            setError(e instanceof Error ? e.message : 'Failed to connect to peer.');
            setSessionState('error');
        }
    };

    const runStrategy = async (strategy: SyncStrategy) => {
        const session = sessionRef.current;
        if (!session || (sessionState !== 'connected' && sessionState !== 'synced')) {
            setError('Connect to a peer before syncing.');
            return;
        }

        setError(null);
        setSessionState('syncing');
        pendingStrategyRef.current = strategy;

        if (strategy === 'a-overwrites-b') {
            // Host pushes local vault to guest.
            session.sendSyncRequest(strategy, toSyncPayload(localItemsRef.current));
            return;
        }

        // Host asks guest for vault, then applies on sync-data.
        session.sendSyncRequest(strategy);
    };

    const stop = () => {
        teardown();
    };

    return {
        sessionState,
        role,
        peerId,
        qrDataUrl,
        remote,
        error,
        lastSyncedCount,
        pendingIncoming,
        localItemCount: localItems.length,
        isActive: sessionState !== 'idle' && sessionState !== 'closed',
        isConnected: sessionState === 'connected' || sessionState === 'syncing' || sessionState === 'synced',
        clearError,
        startHost,
        startGuestScan,
        connectWithQrText,
        runStrategy,
        stop
    };
}

export type UseWebRTCSyncReturn = ReturnType<typeof useWebRTCSync>;
