/** Central storage key names for the kbox vault. */

export const STORAGE_KEYS = {
    metadata: 'kbox_vault_metadata',
    itemsV2: 'kbox_vault_items_v2',
    lockBehavior: 'kbox_vault_lock_behavior',
    commonTags: 'kbox_vault_common_tags'
} as const;

export const IDB_NAME = 'KboxVaultDB';
export const IDB_VERSION = 1;
export const IDB_STORE = 'secure_store';
