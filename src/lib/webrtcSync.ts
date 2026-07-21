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
            if (this.conn) {
                conn.close();
                return;
            }
            this.attachConnection(conn);
        });

        return new Promise((resolve, reject) => {
            const onOpen = (id: string) => {
                cleanup();
                this.events.onPeerId?.(id);
                this.events.onStateChange?.('waiting');
                resolve(id);
            };
            const onError = (err: Error) => {
                cleanup();
                this.events.onStateChange?.('error');
                this.events.onError?.(err.message || 'Failed to start WebRTC host.');
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
                resolve();
            };
            const onError = (err: Error) => {
                cleanup();
                this.events.onStateChange?.('error');
                this.events.onError?.(err.message || 'Failed to start WebRTC guest.');
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
        const conn = peer.connect(hostPeerId, {reliable: true});
        this.attachConnection(conn);
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

        try {
            this.conn?.close();
        } catch {
            // ignore
        }
        this.conn = null;

        try {
            this.peer?.destroy();
        } catch {
            // ignore
        }
        this.peer = null;
        this.events.onStateChange?.('closed');
    }

    private async createPeer(): Promise<Peer> {
        // PeerJS public cloud signaling; STUN is configured by PeerJS defaults.
        return new Peer({
            debug: 0
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
            if (!isWireMessage(raw)) {
                this.events.onError?.('Received invalid sync payload.');
                return;
            }
            this.handleMessage(raw);
        });

        conn.on('close', () => {
            if (this.destroyed) return;
            this.events.onStateChange?.('closed');
            this.events.onError?.('Peer disconnected.');
        });

        conn.on('error', err => {
            this.events.onStateChange?.('error');
            this.events.onError?.(err.message || 'Data channel error.');
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
        this.conn.send(message);
    }
}
