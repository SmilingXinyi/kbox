import type {ApiKeyItem, LockBehavior, VaultMetadata} from '../../types/vault';
import {CLOUD_VAULT_FORMAT, CLOUD_VAULT_VERSION, type CloudVaultSnapshot} from '../../types/cloudSync';
import {getEncryptedItemsFromDB, saveEncryptedItemsToDB} from '../indexedDB';
import {
    loadCommonTags,
    loadLockBehavior,
    loadVaultMetadata,
    saveCommonTags,
    saveLockBehavior,
    saveVaultMetadata
} from '../vaultMigration';

const LOCK_BEHAVIORS: LockBehavior[] = ['always', 'delay-30s', 'delay-1m', 'delay-5m', 'once'];

function isVaultMetadata(value: unknown): value is VaultMetadata {
    if (!value || typeof value !== 'object') return false;
    const meta = value as VaultMetadata;
    return (
        meta.isInitialized === true &&
        typeof meta.salt === 'string' &&
        meta.salt.length > 0 &&
        typeof meta.pinIv === 'string' &&
        meta.pinIv.length > 0 &&
        typeof meta.encryptedMasterKeyWithPin === 'string' &&
        meta.encryptedMasterKeyWithPin.length > 0 &&
        typeof meta.hasWebAuthn === 'boolean'
    );
}

function isEncryptedItem(value: unknown): value is ApiKeyItem {
    if (!value || typeof value !== 'object') return false;
    const item = value as ApiKeyItem;
    if (typeof item.id !== 'string' || typeof item.label !== 'string' || !Array.isArray(item.keys)) {
        return false;
    }
    return item.keys.every(
        key =>
            key &&
            typeof key === 'object' &&
            typeof key.id === 'string' &&
            typeof key.label === 'string' &&
            (key.value === undefined || typeof key.value === 'string') &&
            (key.encryptedValue === undefined || typeof key.encryptedValue === 'string') &&
            (key.iv === undefined || typeof key.iv === 'string')
    );
}

function stripPlaintextValues(items: ApiKeyItem[]): ApiKeyItem[] {
    return items.map(item => ({
        ...item,
        keys: item.keys.map(key => ({
            ...key,
            value: ''
        }))
    }));
}

export function isCloudVaultSnapshot(value: unknown): value is CloudVaultSnapshot {
    if (!value || typeof value !== 'object') return false;
    const snapshot = value as CloudVaultSnapshot;
    return (
        snapshot.format === CLOUD_VAULT_FORMAT &&
        snapshot.version === CLOUD_VAULT_VERSION &&
        typeof snapshot.updatedAt === 'string' &&
        snapshot.updatedAt.length > 0 &&
        isVaultMetadata(snapshot.metadata) &&
        Array.isArray(snapshot.items) &&
        snapshot.items.every(isEncryptedItem) &&
        LOCK_BEHAVIORS.includes(snapshot.lockBehavior) &&
        Array.isArray(snapshot.commonTags) &&
        snapshot.commonTags.every(tag => typeof tag === 'string')
    );
}

export function parseCloudVaultSnapshot(raw: string): CloudVaultSnapshot {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw) as unknown;
    } catch {
        throw new Error('Cloud vault file is not valid JSON.');
    }
    if (!isCloudVaultSnapshot(parsed)) {
        throw new Error('Invalid or unsupported cloud vault format.');
    }
    return {
        ...parsed,
        items: stripPlaintextValues(parsed.items)
    };
}

export function serializeCloudVaultSnapshot(snapshot: CloudVaultSnapshot): string {
    const safe: CloudVaultSnapshot = {
        ...snapshot,
        items: stripPlaintextValues(snapshot.items)
    };
    return JSON.stringify(safe);
}

export async function readLocalCloudSnapshot(updatedAt: string): Promise<CloudVaultSnapshot | null> {
    const metadata = loadVaultMetadata();
    if (!metadata) return null;

    const items = (await getEncryptedItemsFromDB()) ?? [];
    return {
        format: CLOUD_VAULT_FORMAT,
        version: CLOUD_VAULT_VERSION,
        updatedAt,
        metadata,
        items: stripPlaintextValues(items),
        lockBehavior: loadLockBehavior(),
        commonTags: loadCommonTags()
    };
}

export async function writeLocalCloudSnapshot(snapshot: CloudVaultSnapshot): Promise<void> {
    saveVaultMetadata(snapshot.metadata);
    saveLockBehavior(snapshot.lockBehavior);
    saveCommonTags(snapshot.commonTags);
    await saveEncryptedItemsToDB(stripPlaintextValues(snapshot.items));
}

export function compareIsoTimestamps(left: string, right: string): number {
    const leftMs = Date.parse(left);
    const rightMs = Date.parse(right);
    if (Number.isNaN(leftMs) || Number.isNaN(rightMs)) {
        return left === right ? 0 : left < right ? -1 : 1;
    }
    return leftMs - rightMs;
}
