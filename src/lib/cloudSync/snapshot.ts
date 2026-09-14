import type {ApiKeyItem, LockBehavior, VaultMetadata} from '../../types/vault';
import {
    CLOUD_VAULT_FORMAT,
    CLOUD_VAULT_VERSION,
    type CloudPushContext,
    type CloudVaultFile,
    type CloudVaultSnapshot
} from '../../types/cloudSync';
import {decryptDatabase, decryptMasterKey, deriveKeyFromPin, encryptDatabase} from '../crypto';
import {isSyncPayloadValid, toSyncPayload} from '../syncPayload';

const LOCK_BEHAVIORS: LockBehavior[] = ['always', 'delay-30s', 'delay-1m', 'delay-5m', 'once'];

type CloudVaultPayload = {
    items: ApiKeyItem[];
    lockBehavior: LockBehavior;
    commonTags: string[];
};

export function portablePinMetadata(metadata: VaultMetadata): VaultMetadata {
    return {
        isInitialized: true,
        hasWebAuthn: false,
        salt: metadata.salt,
        pinIv: metadata.pinIv,
        encryptedMasterKeyWithPin: metadata.encryptedMasterKeyWithPin
    };
}

export function isCloudVaultFile(value: unknown): value is CloudVaultFile {
    if (!value || typeof value !== 'object') return false;
    const file = value as CloudVaultFile;
    return (
        file.format === CLOUD_VAULT_FORMAT &&
        file.version === CLOUD_VAULT_VERSION &&
        typeof file.updatedAt === 'string' &&
        file.updatedAt.length > 0 &&
        typeof file.salt === 'string' &&
        file.salt.length > 0 &&
        typeof file.pinIv === 'string' &&
        file.pinIv.length > 0 &&
        typeof file.encryptedMasterKeyWithPin === 'string' &&
        file.encryptedMasterKeyWithPin.length > 0 &&
        typeof file.iv === 'string' &&
        file.iv.length > 0 &&
        typeof file.ciphertext === 'string' &&
        file.ciphertext.length > 0
    );
}

export function parseCloudVaultFile(raw: string): CloudVaultFile {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw) as unknown;
    } catch {
        throw new Error('Cloud vault file is not valid JSON.');
    }
    if (!isCloudVaultFile(parsed)) {
        throw new Error('Invalid or unsupported cloud vault format.');
    }
    return parsed;
}

export function serializeCloudVaultFile(file: CloudVaultFile): string {
    return JSON.stringify(file);
}

function isCloudVaultPayload(value: unknown): value is CloudVaultPayload {
    if (!value || typeof value !== 'object') return false;
    const payload = value as CloudVaultPayload;
    return (
        isSyncPayloadValid(payload.items) &&
        LOCK_BEHAVIORS.includes(payload.lockBehavior) &&
        Array.isArray(payload.commonTags) &&
        payload.commonTags.every(tag => typeof tag === 'string')
    );
}

export async function createCloudVaultFile(context: CloudPushContext, updatedAt: string): Promise<CloudVaultFile> {
    const metadata = portablePinMetadata(context.metadata);
    const payload: CloudVaultPayload = {
        items: toSyncPayload(context.items),
        lockBehavior: context.lockBehavior,
        commonTags: context.commonTags
    };
    const encrypted = await encryptDatabase(JSON.stringify(payload), context.masterKeyHex);

    return {
        format: CLOUD_VAULT_FORMAT,
        version: CLOUD_VAULT_VERSION,
        updatedAt,
        salt: metadata.salt,
        pinIv: metadata.pinIv,
        encryptedMasterKeyWithPin: metadata.encryptedMasterKeyWithPin,
        iv: encrypted.iv,
        ciphertext: encrypted.ciphertext
    };
}

async function decryptPayload(file: CloudVaultFile, masterKeyHex: string): Promise<CloudVaultPayload> {
    try {
        const json = await decryptDatabase(file.ciphertext, file.iv, masterKeyHex);
        const parsed: unknown = JSON.parse(json);
        if (!isCloudVaultPayload(parsed)) {
            throw new Error('Cloud vault payload is corrupted.');
        }
        return parsed;
    } catch (e) {
        if (e instanceof Error && e.message.includes('corrupted')) {
            throw e;
        }
        throw new Error('Failed to decrypt cloud vault. PIN or key may be wrong.', {cause: e});
    }
}

export async function decryptCloudVaultFile(
    file: CloudVaultFile,
    secret: {masterKeyHex: string} | {pin: string}
): Promise<CloudVaultSnapshot> {
    let masterKeyHex: string;
    if ('pin' in secret) {
        try {
            const kek = await deriveKeyFromPin(secret.pin, file.salt);
            masterKeyHex = await decryptMasterKey(file.encryptedMasterKeyWithPin, file.pinIv, kek);
        } catch (e) {
            throw new Error('Incorrect PIN for this cloud vault.', {cause: e});
        }
    } else {
        masterKeyHex = secret.masterKeyHex;
    }

    const payload = await decryptPayload(file, masterKeyHex);
    return {
        updatedAt: file.updatedAt,
        masterKeyHex,
        metadata: portablePinMetadata({
            isInitialized: true,
            hasWebAuthn: false,
            salt: file.salt,
            pinIv: file.pinIv,
            encryptedMasterKeyWithPin: file.encryptedMasterKeyWithPin
        }),
        items: payload.items,
        lockBehavior: payload.lockBehavior,
        commonTags: payload.commonTags
    };
}

export function compareIsoTimestamps(left: string, right: string): number {
    const leftMs = Date.parse(left);
    const rightMs = Date.parse(right);
    if (Number.isNaN(leftMs) || Number.isNaN(rightMs)) {
        return left === right ? 0 : left < right ? -1 : 1;
    }
    return leftMs - rightMs;
}
