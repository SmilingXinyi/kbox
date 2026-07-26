import {useEffect, useRef, useState} from 'react';
import type {ApiKeyItem} from '../types/vault';
import type {SyncEncryptedEnvelope, SyncPeerSummary, SyncRole, SyncSessionState, SyncStrategy} from '../types/sync';
import {encodeSyncQrPayload, parseSyncQrPayload, renderSyncQrDataUrl} from '../lib/syncQr';
import {toSyncPayload} from '../lib/syncPayload';
import {
    decryptSyncItems,
    encryptSyncItems,
    generateSyncSessionKeyHex,
    importSyncSessionKey,
    syncKeyConfirmFingerprint
} from '../lib/syncCrypto';
import {WebRtcSyncSession} from '../lib/webrtcSync';

type UseWebRTCSyncOptions = {
    localItems: ApiKeyItem[];
    /** Persist plaintext items (re-encrypted by vault layer). */
    onReplaceItems: (items: ApiKeyItem[]) => Promise<void>;
};

export type PendingIncomingSync =
    | {strategy: 'a-overwrites-b'; items: ApiKeyItem[]}
    | {strategy: 'b-overwrites-a'; items?: undefined};

export function useWebRTCSync({localItems, onReplaceItems}: UseWebRTCSyncOptions) {
    const [sessionState, setSessionState] = useState<SyncSessionState>('idle');
    const [role, setRole] = useState<SyncRole | null>(null);
    const [peerId, setPeerId] = useState<string | null>(null);
    const [inviteText, setInviteText] = useState<string | null>(null);
    const [pairingCode, setPairingCode] = useState<string | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [remote, setRemote] = useState<SyncPeerSummary | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [lastSyncedCount, setLastSyncedCount] = useState<number | null>(null);
    const [pendingIncoming, setPendingIncoming] = useState<PendingIncomingSync | null>(null);

    const sessionRef = useRef<WebRtcSyncSession | null>(null);
    const pendingStrategyRef = useRef<SyncStrategy | null>(null);
    const sessionKeyRef = useRef<CryptoKey | null>(null);
    const keyConfirmRef = useRef<string | null>(null);

    /**
     * PeerJS / data-channel handlers are registered once when the session starts.
     * Props like `localItems` and `onReplaceItems` change on later renders; reading
     * them from a render closure would freeze stale values (classic stale-closure bug).
     * Keep refs in sync so async WebRTC callbacks always see the latest vault state.
     */
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
        sessionKeyRef.current = null;
        keyConfirmRef.current = null;
        setPeerId(null);
        setInviteText(null);
        setPairingCode(null);
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

    const requireSessionKey = (): CryptoKey => {
        const key = sessionKeyRef.current;
        if (!key) {
            throw new Error('Missing sync session key. Restart pairing from the host QR.');
        }
        return key;
    };

    const handleIncomingSyncRequest = async (strategy: SyncStrategy, envelope: SyncEncryptedEnvelope | undefined) => {
        const session = sessionRef.current;
        if (!session) return;

        // Never auto-apply or auto-send — guest must confirm in the UI.
        if (strategy === 'a-overwrites-b') {
            if (!envelope) {
                session.sendSyncReject('Missing encrypted vault payload from host.');
                return;
            }
            try {
                const items = await decryptSyncItems(envelope, requireSessionKey());
                setPendingIncoming({strategy: 'a-overwrites-b', items});
                setSessionState('connected');
            } catch (e) {
                const message = e instanceof Error ? e.message : 'Failed to decrypt host vault.';
                session.sendSyncReject(message);
                setError(message);
                setSessionState('connected');
            }
            return;
        }

        if (strategy === 'b-overwrites-a') {
            setPendingIncoming({strategy: 'b-overwrites-a'});
            setSessionState('connected');
        }
    };

    const handleIncomingSyncData = async (envelope: SyncEncryptedEnvelope) => {
        const session = sessionRef.current;
        if (!session) return;

        let items: ApiKeyItem[];
        try {
            items = await decryptSyncItems(envelope, requireSessionKey());
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to decrypt guest vault.';
            setError(message);
            session.sendSyncReject(message);
            setSessionState('connected');
            pendingStrategyRef.current = null;
            return;
        }

        // Host receives guest data for b-overwrites-a (host already confirmed the strategy).
        if (pendingStrategyRef.current !== 'b-overwrites-a') {
            setError('Received unexpected vault payload.');
            session.sendSyncReject('Unexpected vault payload.');
            setSessionState('connected');
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

    const acceptIncomingSync = async () => {
        const session = sessionRef.current;
        const pending = pendingIncoming;
        if (!session || !pending) return;

        setError(null);
        setSessionState('syncing');

        if (pending.strategy === 'a-overwrites-b') {
            try {
                await onReplaceItemsRef.current(pending.items);
                session.sendSyncComplete(pending.items.length);
                setLastSyncedCount(pending.items.length);
                setPendingIncoming(null);
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

        // Guest confirmed sending local vault to host (b-overwrites-a).
        try {
            const envelope = await encryptSyncItems(toSyncPayload(localItemsRef.current), requireSessionKey());
            session.sendSyncData(envelope);
            setPendingIncoming(null);
            // Stay in syncing until host replies with sync-complete.
        } catch (e) {
            console.error('Failed to send guest vault:', e);
            const message = e instanceof Error ? e.message : 'Failed to send vault data.';
            session.sendSyncReject(message);
            setError(message);
            setSessionState('connected');
        }
    };

    const rejectIncomingSync = (reason = 'Rejected by peer.') => {
        const session = sessionRef.current;
        session?.sendSyncReject(reason);
        setPendingIncoming(null);
        setSessionState('connected');
    };

    const createSession = (nextRole: SyncRole, keyConfirm: string) => {
        sessionRef.current?.destroy();

        const session = new WebRtcSyncSession(nextRole, keyConfirm, {
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
            onIncomingSyncRequest: (strategy, envelope) => {
                void handleIncomingSyncRequest(strategy, envelope);
            },
            onIncomingSyncData: envelope => {
                void handleIncomingSyncData(envelope);
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
            },
            onKeyMismatch: () => {
                setError('Pairing key mismatch. Rescan the host QR or paste the full invite.');
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
        setInviteText(null);
        setPairingCode(null);
        setRole('host');
        setSessionState('starting');

        try {
            const sessionKeyHex = generateSyncSessionKeyHex();
            const cryptoKey = await importSyncSessionKey(sessionKeyHex);
            const keyConfirm = await syncKeyConfirmFingerprint(sessionKeyHex);
            sessionKeyRef.current = cryptoKey;
            keyConfirmRef.current = keyConfirm;
            setPairingCode(keyConfirm);

            const session = createSession('host', keyConfirm);
            const id = await session.startHost(localItemsRef.current.length);
            const invite = encodeSyncQrPayload(id, sessionKeyHex);
            const dataUrl = await renderSyncQrDataUrl(id, sessionKeyHex);
            setInviteText(invite);
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
        setInviteText(null);
        setPairingCode(null);
        sessionKeyRef.current = null;
        keyConfirmRef.current = null;
        setRole('guest');
        setSessionState('scanning');
    };

    const connectWithQrText = async (raw: string) => {
        const payload = parseSyncQrPayload(raw);
        if (!payload) {
            setError('Invalid sync invite. Paste the full invite from the host (not only the peer ID).');
            return;
        }

        setError(null);
        setRole('guest');
        setSessionState('connecting');

        try {
            const cryptoKey = await importSyncSessionKey(payload.sk);
            const keyConfirm = await syncKeyConfirmFingerprint(payload.sk);
            sessionKeyRef.current = cryptoKey;
            keyConfirmRef.current = keyConfirm;
            setPairingCode(keyConfirm);
            setPeerId(payload.peerId);
            setInviteText(encodeSyncQrPayload(payload.peerId, payload.sk));

            const session = createSession('guest', keyConfirm);
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

        try {
            if (strategy === 'a-overwrites-b') {
                const envelope = await encryptSyncItems(toSyncPayload(localItemsRef.current), requireSessionKey());
                session.sendSyncRequest(strategy, envelope);
                return;
            }

            // Host asks guest for vault; guest confirms before sending; host applies on sync-data.
            session.sendSyncRequest(strategy);
        } catch (e) {
            console.error('Failed to start sync strategy:', e);
            const message = e instanceof Error ? e.message : 'Failed to encrypt vault for sync.';
            setError(message);
            setSessionState('connected');
            pendingStrategyRef.current = null;
        }
    };

    const stop = () => {
        teardown();
    };

    return {
        sessionState,
        role,
        peerId,
        inviteText,
        pairingCode,
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
        acceptIncomingSync,
        rejectIncomingSync,
        stop
    };
}

export type UseWebRTCSyncReturn = ReturnType<typeof useWebRTCSync>;
