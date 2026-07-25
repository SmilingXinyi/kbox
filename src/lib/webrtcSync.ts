import {Peer, type DataConnection} from 'peerjs';
import type {ApiKeyItem} from '../types/vault';
import type {SyncPeerSummary, SyncRole, SyncStrategy, SyncWireMessage} from '../types/sync';

export type WebRtcSyncEvents = {
    onPeerId?: (peerId: string) => void;
    onStateChange?: (state: 'starting' | 'waiting' | 'connecting' | 'connected' | 'closed' | 'error') => void;
    onRemoteSummary?: (summary: SyncPeerSummary) => void;
    onIncomingSyncRequest?: (strategy: SyncStrategy, items: ApiKeyItem[] | undefined) => void;
    onIncomingSyncData?: (items: ApiKeyItem[]) => void;
    onSyncComplete?: (itemCount: number) => void;
    onSyncRejected?: (reason: string) => void;
    onError?: (message: string) => void;
};

function isWireMessage(value: unknown): value is SyncWireMessage {
    if (!value || typeof value !== 'object') return false;
    const type = (value as {type?: unknown}).type;
    return (
        type === 'hello' ||
        type === 'sync-request' ||
        type === 'sync-data' ||
        type === 'sync-complete' ||
        type === 'sync-reject' ||
        type === 'error'
    );
}

function errorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message) return err.message;
    if (typeof err === 'string' && err) return err;
    return fallback;
}

export class WebRtcSyncSession {
    private peer: Peer | null = null;
    private conn: DataConnection | null = null;
    private destroyed = false;
    private localItemCount = 0;
    private readonly role: SyncRole;
    private readonly events: WebRtcSyncEvents;

    constructor(role: SyncRole, events: WebRtcSyncEvents = {}) {
        this.role = role;
        this.events = events;
    }

    async startHost(localItemCount: number): Promise<string> {
        this.localItemCount = localItemCount;
        this.events.onStateChange?.('starting');

        const peer = await this.createPeer();
        this.peer = peer;

        peer.on('connection', conn => {
            if (this.destroyed) {
                this.safeCloseConnection(conn, 'Rejected connection after session destroyed');
                return;
            }
            if (this.conn) {
                this.safeCloseConnection(conn, 'Rejected extra peer connection');
                return;
            }
            this.attachConnection(conn);
        });

        return new Promise((resolve, reject) => {
            const onOpen = (id: string) => {
                cleanup();
                this.bindPeerLifecycleErrors(peer, 'Host peer error');
                this.events.onPeerId?.(id);
                this.events.onStateChange?.('waiting');
                resolve(id);
            };
            const onError = (err: Error) => {
                cleanup();
                this.reportError(err, 'Failed to start WebRTC host.');
                reject(err);
            };
            const cleanup = () => {
                peer.off('open', onOpen);
                peer.off('error', onError);
            };
            peer.on('open', onOpen);
            peer.on('error', onError);
        });
    }

    async connectAsGuest(hostPeerId: string, localItemCount: number): Promise<void> {
        this.localItemCount = localItemCount;
        this.events.onStateChange?.('starting');

        const peer = await this.createPeer();
        this.peer = peer;

        await new Promise<void>((resolve, reject) => {
            const onOpen = () => {
                cleanup();
                this.bindPeerLifecycleErrors(peer, 'Guest peer error');
                resolve();
            };
            const onError = (err: Error) => {
                cleanup();
                this.reportError(err, 'Failed to start WebRTC guest.');
                reject(err);
            };
            const cleanup = () => {
                peer.off('open', onOpen);
                peer.off('error', onError);
            };
            peer.on('open', onOpen);
            peer.on('error', onError);
        });

        this.events.onStateChange?.('connecting');
        try {
            // JSON avoids BinaryPack turning omitted/undefined optional fields into empty
            // objects on the receiving peer (which breaks sync payload validation).
            const conn = peer.connect(hostPeerId, {reliable: true, serialization: 'json'});
            this.attachConnection(conn);
        } catch (err) {
            this.reportError(err, 'Failed to open data channel to host.');
            throw err instanceof Error ? err : new Error(errorMessage(err, 'Failed to open data channel to host.'));
        }
    }

    sendSyncRequest(strategy: SyncStrategy, items?: ApiKeyItem[]): void {
        this.send({type: 'sync-request', strategy, items});
    }

    sendSyncData(items: ApiKeyItem[]): void {
        this.send({type: 'sync-data', items});
    }

    sendSyncComplete(itemCount: number): void {
        this.send({type: 'sync-complete', itemCount});
    }

    sendSyncReject(reason: string): void {
        this.send({type: 'sync-reject', reason});
    }

    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;

        this.safeCloseConnection(this.conn, 'Failed to close data connection during teardown');
        this.conn = null;

        try {
            this.peer?.destroy();
        } catch (err) {
            // Teardown should still finish; surface the failure without leaving the session hanging.
            console.warn('Failed to destroy PeerJS peer:', err);
            this.events.onError?.(errorMessage(err, 'Failed to destroy WebRTC peer.'));
        }
        this.peer = null;
        this.events.onStateChange?.('closed');
    }

    private async createPeer(): Promise<Peer> {
        try {
            // PeerJS public cloud signaling; STUN is configured by PeerJS defaults.
            return new Peer({
                debug: 0
            });
        } catch (err) {
            this.reportError(err, 'Failed to create WebRTC peer.');
            throw err instanceof Error ? err : new Error(errorMessage(err, 'Failed to create WebRTC peer.'));
        }
    }

    private bindPeerLifecycleErrors(peer: Peer, fallback: string): void {
        peer.on('error', err => {
            if (this.destroyed) return;
            this.reportError(err, fallback);
        });
    }

    private attachConnection(conn: DataConnection): void {
        this.conn = conn;
        this.events.onStateChange?.('connecting');

        const markConnectedAndHello = () => {
            if (this.destroyed) return;
            this.events.onStateChange?.('connected');
            this.send({
                type: 'hello',
                role: this.role,
                itemCount: this.localItemCount
            });
        };

        if (conn.open) {
            markConnectedAndHello();
        } else {
            conn.on('open', markConnectedAndHello);
        }

        conn.on('data', raw => {
            try {
                if (!isWireMessage(raw)) {
                    this.events.onError?.('Received invalid sync payload.');
                    return;
                }
                this.handleMessage(raw);
            } catch (err) {
                this.reportError(err, 'Failed while handling sync message.');
            }
        });

        conn.on('close', () => {
            if (this.destroyed) return;
            this.events.onStateChange?.('closed');
            this.events.onError?.('Peer disconnected.');
        });

        conn.on('error', err => {
            if (this.destroyed) return;
            this.reportError(err, 'Data channel error.');
        });
    }

    private handleMessage(message: SyncWireMessage): void {
        switch (message.type) {
            case 'hello':
                this.events.onRemoteSummary?.({role: message.role, itemCount: message.itemCount});
                break;
            case 'sync-request':
                this.events.onIncomingSyncRequest?.(message.strategy, message.items);
                break;
            case 'sync-data':
                this.events.onIncomingSyncData?.(message.items);
                break;
            case 'sync-complete':
                this.events.onSyncComplete?.(message.itemCount);
                break;
            case 'sync-reject':
                this.events.onSyncRejected?.(message.reason);
                break;
            case 'error':
                this.events.onError?.(message.message);
                break;
        }
    }

    private send(message: SyncWireMessage): void {
        if (!this.conn || !this.conn.open) {
            this.events.onError?.('Peer is not connected.');
            return;
        }
        try {
            this.conn.send(message);
        } catch (err) {
            this.reportError(err, 'Failed to send sync message.');
        }
    }

    private safeCloseConnection(conn: DataConnection | null, fallback: string): void {
        if (!conn) return;
        try {
            conn.close();
        } catch (err) {
            console.warn(fallback, err);
            if (!this.destroyed) {
                this.events.onError?.(errorMessage(err, fallback));
            }
        }
    }

    private reportError(err: unknown, fallback: string): void {
        const message = errorMessage(err, fallback);
        console.error('[webrtcSync]', message, err);
        this.events.onStateChange?.('error');
        this.events.onError?.(message);
    }
}
