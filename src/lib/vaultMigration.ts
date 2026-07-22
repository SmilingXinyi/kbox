import type {LockBehavior, VaultMetadata} from '../types/vault';
import type {ApiKeyItem} from '../types/vault';
import {STORAGE_KEYS} from './vaultStorageKeys';

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

export function loadVaultMetadata(): VaultMetadata | null {
    return readJson<VaultMetadata>(STORAGE_KEYS.metadata);
}

export function saveVaultMetadata(metadata: VaultMetadata): void {
    localStorage.setItem(STORAGE_KEYS.metadata, JSON.stringify(metadata));
}

export function loadLockBehavior(): LockBehavior {
    const current = localStorage.getItem(STORAGE_KEYS.lockBehavior);
    return (current as LockBehavior | null) ?? 'delay-1m';
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

export function loadLocalV2Items(): ApiKeyItem[] | null {
    return readJson<ApiKeyItem[]>(STORAGE_KEYS.itemsV2);
}
