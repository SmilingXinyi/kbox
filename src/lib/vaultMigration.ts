import type {LockBehavior, VaultMetadata} from '../types/vault';
import type {ApiKeyItem} from '../types/vault';
import {LEGACY_STORAGE_KEYS, STORAGE_KEYS} from './vaultStorageKeys';

function readJson<T>(key: string): T | null {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw) as T;
    } catch (e) {
        console.error('Failed to parse localStorage JSON:', key, e);
        return null;
    }
}

/** Read metadata from kbox key, or migrate once from demo legacy keys. */
export function loadVaultMetadata(): VaultMetadata | null {
    const current = readJson<VaultMetadata>(STORAGE_KEYS.metadata);
    if (current) return current;

    const legacy = readJson<VaultMetadata>(LEGACY_STORAGE_KEYS.metadata);
    if (legacy) {
        try {
            localStorage.setItem(STORAGE_KEYS.metadata, JSON.stringify(legacy));
            localStorage.removeItem(LEGACY_STORAGE_KEYS.metadata);
        } catch (e) {
            console.warn('Failed to migrate legacy metadata:', e);
        }
        return legacy;
    }

    return null;
}

export function saveVaultMetadata(metadata: VaultMetadata): void {
    localStorage.setItem(STORAGE_KEYS.metadata, JSON.stringify(metadata));
}

export function loadLockBehavior(): LockBehavior {
    const current = localStorage.getItem(STORAGE_KEYS.lockBehavior);
    if (current) return current as LockBehavior;

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEYS.lockBehavior);
    if (legacy) {
        try {
            localStorage.setItem(STORAGE_KEYS.lockBehavior, legacy);
            localStorage.removeItem(LEGACY_STORAGE_KEYS.lockBehavior);
        } catch (e) {
            console.warn('Failed to migrate legacy lock behavior:', e);
        }
        return legacy as LockBehavior;
    }

    return 'delay-1m';
}

export function saveLockBehavior(behavior: LockBehavior): void {
    localStorage.setItem(STORAGE_KEYS.lockBehavior, behavior);
}

export const DEFAULT_COMMON_TAGS = ['AI', 'Cloud', 'Database', 'SaaS', 'Payments', 'Analytics', 'Dev', 'Prod'];

export function loadCommonTags(): string[] {
    const tags = readJson<string[]>(STORAGE_KEYS.commonTags);
    return tags || DEFAULT_COMMON_TAGS;
}

export function saveCommonTags(tags: string[]): void {
    localStorage.setItem(STORAGE_KEYS.commonTags, JSON.stringify(tags));
}

/** Prefer kbox v2 items in localStorage; migrate legacy demo v2 if needed. */
export function loadLocalV2Items(): ApiKeyItem[] | null {
    const current = readJson<ApiKeyItem[]>(STORAGE_KEYS.itemsV2);
    if (current) return current;

    const legacy = readJson<ApiKeyItem[]>(LEGACY_STORAGE_KEYS.itemsV2);
    if (legacy) {
        try {
            localStorage.setItem(STORAGE_KEYS.itemsV2, JSON.stringify(legacy));
            localStorage.removeItem(LEGACY_STORAGE_KEYS.itemsV2);
        } catch (e) {
            console.warn('Failed to migrate legacy v2 items:', e);
        }
        return legacy;
    }

    return null;
}

export function loadV1CipherPayload(): {iv: string; ciphertext: string} | null {
    const iv = localStorage.getItem(STORAGE_KEYS.v1Iv) ?? localStorage.getItem(LEGACY_STORAGE_KEYS.v1Iv);
    const ciphertext =
        localStorage.getItem(STORAGE_KEYS.v1Ciphertext) ?? localStorage.getItem(LEGACY_STORAGE_KEYS.v1Ciphertext);

    if (!iv || !ciphertext) return null;

    if (!localStorage.getItem(STORAGE_KEYS.v1Iv) && localStorage.getItem(LEGACY_STORAGE_KEYS.v1Iv)) {
        try {
            localStorage.setItem(STORAGE_KEYS.v1Iv, iv);
            localStorage.setItem(STORAGE_KEYS.v1Ciphertext, ciphertext);
            localStorage.removeItem(LEGACY_STORAGE_KEYS.v1Iv);
            localStorage.removeItem(LEGACY_STORAGE_KEYS.v1Ciphertext);
        } catch (e) {
            console.warn('Failed to migrate legacy v1 ciphertext:', e);
        }
    }

    return {iv, ciphertext};
}

export function clearLegacyStorageKeys(): void {
    for (const key of Object.values(LEGACY_STORAGE_KEYS)) {
        try {
            localStorage.removeItem(key);
        } catch {
            // ignore
        }
    }
}
