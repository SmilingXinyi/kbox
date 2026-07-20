/** Central storage key names for kbox vault (new writes) and demo legacy (read/migrate). */

export const STORAGE_KEYS = {
    metadata: 'kbox_vault_metadata',
    itemsV2: 'kbox_vault_items_v2',
    lockBehavior: 'kbox_vault_lock_behavior',
    commonTags: 'kbox_vault_common_tags',
    v1Iv: 'kbox_vault_db_iv',
    v1Ciphertext: 'kbox_vault_db_ciphertext'
} as const;

export const LEGACY_STORAGE_KEYS = {
    metadata: 'apiKeySafe_metadata',
    itemsV2: 'apiKeySafe_db_items_v2',
    lockBehavior: 'apiKeySafe_lock_behavior',
    v1Iv: 'apiKeySafe_db_iv',
    v1Ciphertext: 'apiKeySafe_db_ciphertext'
} as const;

export const IDB_NAME = 'KboxVaultDB';
export const IDB_VERSION = 1;
export const IDB_STORE = 'secure_store';
