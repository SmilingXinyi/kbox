export type KeyEntry = {
    id: string;
    label: string;
    value: string;
    encryptedValue?: string;
    iv?: string;
};

export type ApiKeyItem = {
    id: string;
    label: string;
    tag?: string;
    description?: string;
    keys: KeyEntry[];
    createdAt: string;
    updatedAt: string;
};

export type VaultMetadata = {
    isInitialized: boolean;
    hasWebAuthn: boolean;
    webauthnCredentialId?: string;
    salt: string;
    pinIv: string;
    webauthnIv?: string;
    encryptedMasterKeyWithPin: string;
    encryptedMasterKeyWithWebAuthn?: string;
};

export type EncryptedDatabase = {
    items: ApiKeyItem[];
};

export type LockBehavior = 'always' | 'delay-30s' | 'delay-1m' | 'delay-5m' | 'once';

export type VaultState = 'loading' | 'uninitialized' | 'locked' | 'unlocked';

export type PendingSensitiveAction = {
    type: 'reveal' | 'copy' | 'edit' | 'add' | 'delete';
    itemId?: string;
    keyId?: string;
};
