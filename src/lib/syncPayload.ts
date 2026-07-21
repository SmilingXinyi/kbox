import type {ApiKeyItem} from '../types/vault';

/** Prepare unlocked vault items for P2P transfer (plaintext secrets only). */
export function toSyncPayload(items: ApiKeyItem[]): ApiKeyItem[] {
    return items.map(item => ({
        id: item.id,
        label: item.label,
        tag: item.tag,
        description: item.description,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        keys: item.keys.map(key => ({
            id: key.id,
            label: key.label,
            value: key.value || ''
        }))
    }));
}

export function isSyncPayloadValid(items: unknown): items is ApiKeyItem[] {
    if (!Array.isArray(items)) return false;
    return items.every(item => {
        if (!item || typeof item !== 'object') return false;
        const row = item as Partial<ApiKeyItem>;
        return typeof row.id === 'string' && typeof row.label === 'string' && Array.isArray(row.keys);
    });
}
