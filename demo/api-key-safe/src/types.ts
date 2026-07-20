export interface KeyEntry {
    id: string;
    label: string; // e.g. "Access Key (AK)", "Secret Key (SK)", "API Key", "Bearer Token"
    value: string;
    encryptedValue?: string; // hex-encoded encrypted value
    iv?: string; // hex-encoded IV used for encryption
}

export interface ApiKeyItem {
    id: string;
    label: string; // Unique label, e.g. "AWS Production", "Google Gemini Dev"
    tag?: string; // Optional, e.g. "Cloud", "AI", "Database"
    description?: string; // Optional description
    keys: KeyEntry[]; // At least 1, supports multiple for AK/SK, etc.
    createdAt: string;
    updatedAt: string;
}

export interface VaultMetadata {
    isInitialized: boolean;
    hasWebAuthn: boolean;
    webauthnCredentialId?: string;
    salt: string; // hex-encoded salt for PIN derivation
    pinIv: string; // hex-encoded IV for master key encrypted with PIN
    webauthnIv?: string; // hex-encoded IV for master key encrypted with WebAuthn
    encryptedMasterKeyWithPin: string; // hex-encoded ciphertext of the master key
    encryptedMasterKeyWithWebAuthn?: string; // hex-encoded ciphertext of the master key
}

export interface EncryptedDatabase {
    items: ApiKeyItem[];
}
