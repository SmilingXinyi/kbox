import type {ApiKeyItem} from '../types/vault';

/** Soft caps to reject abusive or corrupt P2P payloads. */
export const SYNC_MAX_ITEMS = 500;
export const SYNC_MAX_KEYS_PER_ITEM = 32;
export const SYNC_MAX_STRING = 500;
export const SYNC_MAX_SECRET = 16_384;

function isNonEmptyString(value: unknown, maxLen: number): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= maxLen;
}

function isOptionalString(value: unknown, maxLen: number): boolean {
    // Treat null like omitted — PeerJS BinaryPack can turn undefined into null/empty objects
    // on the wire; callers should still omit non-strings in toSyncPayload.
    return value === undefined || value === null || (typeof value === 'string' && value.length <= maxLen);
}

/** Prepare unlocked vault items for P2P transfer (plaintext secrets only). */
export function toSyncPayload(items: ApiKeyItem[]): ApiKeyItem[] {
    return items.map(item => {
        // Omit undefined optionals so PeerJS BinaryPack does not revive them as empty objects
        // (which would fail isOptionalString on the receiving peer).
        const payload: ApiKeyItem = {
            id: item.id,
            label: item.label,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            keys: item.keys.map(key => ({
                id: key.id,
                label: key.label,
                value: key.value || ''
            }))
        };

        if (typeof item.tag === 'string') {
            payload.tag = item.tag;
        }
        if (typeof item.description === 'string') {
            payload.description = item.description;
        }

        return payload;
    });
}

export function isSyncPayloadValid(items: unknown): items is ApiKeyItem[] {
    if (!Array.isArray(items) || items.length > SYNC_MAX_ITEMS) return false;

    return items.every(item => {
        if (!item || typeof item !== 'object') return false;
        const row = item as Partial<ApiKeyItem>;

        if (!isNonEmptyString(row.id, SYNC_MAX_STRING) || !isNonEmptyString(row.label, SYNC_MAX_STRING)) {
            return false;
        }
        if (!isOptionalString(row.tag, SYNC_MAX_STRING) || !isOptionalString(row.description, SYNC_MAX_STRING)) {
            return false;
        }
        if (!isNonEmptyString(row.createdAt, SYNC_MAX_STRING) || !isNonEmptyString(row.updatedAt, SYNC_MAX_STRING)) {
            return false;
        }
        if (!Array.isArray(row.keys) || row.keys.length === 0 || row.keys.length > SYNC_MAX_KEYS_PER_ITEM) {
            return false;
        }

        return row.keys.every(key => {
            if (!key || typeof key !== 'object') return false;
            const entry = key as Partial<ApiKeyItem['keys'][number]>;
            return (
                isNonEmptyString(entry.id, SYNC_MAX_STRING) &&
                isNonEmptyString(entry.label, SYNC_MAX_STRING) &&
                typeof entry.value === 'string' &&
                entry.value.length <= SYNC_MAX_SECRET
            );
        });
    });
}
