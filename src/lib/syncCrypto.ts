import type {ApiKeyItem} from '../types/vault';
import {arrayBufferToHex, bufferToString, generateRandomHex, hexToArrayBuffer, stringToBuffer} from './crypto';
import type {SyncEncryptedEnvelope} from '../types/sync';
import {isSyncPayloadValid} from './syncPayload';

/** HKDF/info binder so sync session keys are purpose-bound. */
const SYNC_KEY_CONFIRM_INFO = 'kbox-sync-key-confirm-v2';

/** 32-byte session key for AES-GCM vault envelopes. */
export function generateSyncSessionKeyHex(): string {
    return generateRandomHex(32);
}

export async function importSyncSessionKey(sessionKeyHex: string): Promise<CryptoKey> {
    const raw = hexToArrayBuffer(sessionKeyHex);
    if (raw.byteLength !== 32) {
        throw new Error('Invalid sync session key length.');
    }

    return window.crypto.subtle.importKey('raw', raw, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}

/**
 * Short fingerprint both peers display after connect.
 * Derived from the QR session key so a MitM with only the PeerJS id cannot match.
 */
export async function syncKeyConfirmFingerprint(sessionKeyHex: string): Promise<string> {
    const digest = await window.crypto.subtle.digest(
        'SHA-256',
        stringToBuffer(`${SYNC_KEY_CONFIRM_INFO}:${sessionKeyHex.toLowerCase()}`)
    );
    return arrayBufferToHex(digest).slice(0, 8);
}

/** Encrypt vault items for the DataChannel (app-layer, above DTLS). */
export async function encryptSyncItems(items: ApiKeyItem[], sessionKey: CryptoKey): Promise<SyncEncryptedEnvelope> {
    const json = JSON.stringify(items);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt({name: 'AES-GCM', iv}, sessionKey, stringToBuffer(json));

    return {
        iv: arrayBufferToHex(iv.buffer),
        ciphertext: arrayBufferToHex(encrypted)
    };
}

/** Decrypt and validate a vault envelope from the peer. */
export async function decryptSyncItems(envelope: SyncEncryptedEnvelope, sessionKey: CryptoKey): Promise<ApiKeyItem[]> {
    if (
        !envelope ||
        typeof envelope.iv !== 'string' ||
        typeof envelope.ciphertext !== 'string' ||
        envelope.iv.length === 0 ||
        envelope.ciphertext.length === 0
    ) {
        throw new Error('Missing encrypted sync envelope.');
    }

    try {
        const iv = hexToArrayBuffer(envelope.iv);
        const ciphertext = hexToArrayBuffer(envelope.ciphertext);
        const decrypted = await window.crypto.subtle.decrypt({name: 'AES-GCM', iv}, sessionKey, ciphertext);
        const parsed: unknown = JSON.parse(bufferToString(decrypted));
        if (!isSyncPayloadValid(parsed)) {
            throw new Error('Decrypted sync payload failed validation.');
        }
        return parsed;
    } catch (e) {
        if (e instanceof Error && e.message.includes('validation')) {
            throw e;
        }
        throw new Error('Failed to decrypt sync payload. Pairing key may be wrong.', {cause: e});
    }
}

export function isSyncEncryptedEnvelope(value: unknown): value is SyncEncryptedEnvelope {
    if (!value || typeof value !== 'object') return false;
    const envelope = value as Record<string, unknown>;
    return typeof envelope.iv === 'string' && typeof envelope.ciphertext === 'string';
}
