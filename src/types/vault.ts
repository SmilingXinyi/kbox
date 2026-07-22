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

/**
 * How the WebAuthn-wrapped master key was derived.
 * - `prf`: WebAuthn PRF extension → HKDF → AES-GCM KEK
 * - `simulated`: BiometricSimulator stable key material (dev / iframe sandbox)
 */
export type WebAuthnKeySource = 'prf' | 'simulated';

export type VaultMetadata = {
    isInitialized: boolean;
    hasWebAuthn: boolean;
    webauthnCredentialId?: string;
    /** Required when `webauthnKeySource` is `prf`. */
    webauthnPrfSalt?: string;
    webauthnKeySource?: WebAuthnKeySource;
    salt: string;
    pinIv: string;
    webauthnIv?: string;
    encryptedMasterKeyWithPin: string;
    encryptedMasterKeyWithWebAuthn?: string;
};

export type LockBehavior = 'always' | 'delay-30s' | 'delay-1m' | 'delay-5m' | 'once';

export type VaultState = 'loading' | 'uninitialized' | 'unlocked';

export type PendingSensitiveAction = {
    type: 'reveal' | 'copy' | 'edit' | 'add' | 'delete';
    itemId?: string;
    keyId?: string;
};

/** Returned after unlock when a UI action must resume with a fresh decrypted snapshot. */
export type ResidualUnlockResult = {
    action: PendingSensitiveAction;
    items: ApiKeyItem[];
};
