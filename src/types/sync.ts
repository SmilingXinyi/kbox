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

/**
 * QR / invite payload (v2).
 * `sk` is a one-time AES-GCM session key — possession authenticates the pair and encrypts vault data.
 */
export type SyncQrPayload = {
    v: 2;
    app: 'kbox';
    peerId: string;
    /** 32-byte hex session key for app-layer vault encryption. */
    sk: string;
};

/** AES-GCM envelope for vault items on the wire (never plaintext secrets). */
export type SyncEncryptedEnvelope = {
    iv: string;
    ciphertext: string;
};

export type SyncWireMessage =
    | {type: 'hello'; role: SyncRole; itemCount: number; keyConfirm: string}
    | {type: 'sync-request'; strategy: SyncStrategy; envelope?: SyncEncryptedEnvelope}
    | {type: 'sync-data'; envelope: SyncEncryptedEnvelope}
    | {type: 'sync-complete'; itemCount: number}
    | {type: 'sync-reject'; reason: string}
    | {type: 'error'; message: string};

export type SyncApplyResult = {
    strategy: SyncStrategy;
    items: ApiKeyItem[];
    /** True when this device's vault was replaced. */
    localReplaced: boolean;
};
