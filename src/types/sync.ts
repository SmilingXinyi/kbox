import type {ApiKeyItem} from './vault';

export type SyncRole = 'host' | 'guest';

/** Merge strategies between paired devices (A = host, B = guest). */
export type SyncStrategy =
    /** A overwrites B — host vault replaces guest vault. */
    | 'a-overwrites-b'
    /** Read B and overwrite A — guest vault replaces host vault. */
    | 'b-overwrites-a';

export type SyncSessionState =
    | 'idle'
    | 'starting'
    | 'waiting'
    | 'scanning'
    | 'connecting'
    | 'connected'
    | 'syncing'
    | 'synced'
    | 'error'
    | 'closed';

export type SyncPeerSummary = {
    role: SyncRole;
    itemCount: number;
};

export type SyncQrPayload = {
    v: 1;
    app: 'kbox';
    peerId: string;
};

export type SyncWireMessage =
    | {type: 'hello'; role: SyncRole; itemCount: number}
    | {type: 'sync-request'; strategy: SyncStrategy; items?: ApiKeyItem[]}
    | {type: 'sync-data'; items: ApiKeyItem[]}
    | {type: 'sync-complete'; itemCount: number}
    | {type: 'sync-reject'; reason: string}
    | {type: 'error'; message: string};

export type SyncApplyResult = {
    strategy: SyncStrategy;
    items: ApiKeyItem[];
    /** True when this device's vault was replaced. */
    localReplaced: boolean;
};
