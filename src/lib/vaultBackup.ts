import type {ApiKeyItem} from '../types/vault';
import {
    arrayBufferToHex,
    bufferToString,
    deriveKeyFromPin,
    generateRandomHex,
    hexToArrayBuffer,
    PBKDF2_ITERATIONS,
    stringToBuffer
} from './crypto';

/** Current on-disk / download backup format. */
export const VAULT_BACKUP_VERSION = 1 as const;

export const BACKUP_FILE_EXTENSION = 'kboxbackup';
export const BACKUP_MIME_TYPE = 'application/json';

/** Minimum recovery passphrase length (stronger than unlock PIN). */
export const RECOVERY_PASSPHRASE_MIN_LENGTH = 8;

export type VaultBackupPayload = {
    masterKeyHex: string;
    items: ApiKeyItem[];
    lockBehavior?: string;
    commonTags?: string[];
    exportedAt: string;
};

export type VaultBackupFile = {
    format: 'kbox-vault-backup';
    version: typeof VAULT_BACKUP_VERSION;
    salt: string;
    iv: string;
    ciphertext: string;
    iterations: number;
};

export function validateRecoveryPassphrase(passphrase: string): string | null {
    if (passphrase.length < RECOVERY_PASSPHRASE_MIN_LENGTH) {
        return `Recovery passphrase must be at least ${RECOVERY_PASSPHRASE_MIN_LENGTH} characters.`;
    }
    return null;
}

function isVaultBackupFile(value: unknown): value is VaultBackupFile {
    if (!value || typeof value !== 'object') return false;
    const file = value as Record<string, unknown>;
    return (
        file.format === 'kbox-vault-backup' &&
        file.version === VAULT_BACKUP_VERSION &&
        typeof file.salt === 'string' &&
        typeof file.iv === 'string' &&
        typeof file.ciphertext === 'string' &&
        typeof file.iterations === 'number'
    );
}

function isVaultBackupPayload(value: unknown): value is VaultBackupPayload {
    if (!value || typeof value !== 'object') return false;
    const payload = value as Record<string, unknown>;
    return (
        typeof payload.masterKeyHex === 'string' &&
        Array.isArray(payload.items) &&
        typeof payload.exportedAt === 'string'
    );
}

async function encryptPayloadWithKek(json: string, kek: CryptoKey): Promise<{ciphertext: string; iv: string}> {
    const data = stringToBuffer(json);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt({name: 'AES-GCM', iv}, kek, data);
    return {
        ciphertext: arrayBufferToHex(encrypted),
        iv: arrayBufferToHex(iv.buffer)
    };
}

async function decryptPayloadWithKek(ciphertextHex: string, ivHex: string, kek: CryptoKey): Promise<string> {
    const ciphertext = hexToArrayBuffer(ciphertextHex);
    const iv = hexToArrayBuffer(ivHex);
    const decrypted = await window.crypto.subtle.decrypt({name: 'AES-GCM', iv}, kek, ciphertext);
    return bufferToString(decrypted);
}

/**
 * Encrypt vault secrets into a portable recovery file.
 * Items must be decrypted (plaintext values); the recovery passphrase wraps the payload.
 */
export async function createVaultBackup(
    masterKeyHex: string,
    items: ApiKeyItem[],
    passphrase: string,
    extras?: {lockBehavior?: string; commonTags?: string[]}
): Promise<VaultBackupFile> {
    const passphraseError = validateRecoveryPassphrase(passphrase);
    if (passphraseError) {
        throw new Error(passphraseError);
    }

    const salt = generateRandomHex(16);
    const kek = await deriveKeyFromPin(passphrase, salt, PBKDF2_ITERATIONS);

    const payload: VaultBackupPayload = {
        masterKeyHex,
        items,
        lockBehavior: extras?.lockBehavior,
        commonTags: extras?.commonTags,
        exportedAt: new Date().toISOString()
    };

    const {ciphertext, iv} = await encryptPayloadWithKek(JSON.stringify(payload), kek);

    return {
        format: 'kbox-vault-backup',
        version: VAULT_BACKUP_VERSION,
        salt,
        iv,
        ciphertext,
        iterations: PBKDF2_ITERATIONS
    };
}

/** Parse JSON text from a downloaded backup file. */
export function parseVaultBackupJson(raw: string): VaultBackupFile {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error('Invalid backup file: not valid JSON.');
    }

    if (!isVaultBackupFile(parsed)) {
        throw new Error('Invalid or unsupported backup file format.');
    }

    return parsed;
}

/** Decrypt a backup file with the recovery passphrase. */
export async function decryptVaultBackup(file: VaultBackupFile, passphrase: string): Promise<VaultBackupPayload> {
    try {
        const kek = await deriveKeyFromPin(passphrase, file.salt, file.iterations);
        const json = await decryptPayloadWithKek(file.ciphertext, file.iv, kek);
        const payload = JSON.parse(json) as unknown;
        if (!isVaultBackupPayload(payload)) {
            throw new Error('Backup payload is corrupted.');
        }
        return payload;
    } catch (e) {
        if (e instanceof Error && e.message.includes('corrupted')) {
            throw e;
        }
        if (e instanceof Error && e.message.includes('Invalid or unsupported')) {
            throw e;
        }
        throw new Error('Incorrect recovery passphrase or corrupted backup.', {cause: e});
    }
}

/** Build a downloadable Blob for the backup file. */
export function vaultBackupToBlob(file: VaultBackupFile): Blob {
    return new Blob([JSON.stringify(file, null, 2)], {type: BACKUP_MIME_TYPE});
}

export function defaultBackupFilename(date = new Date()): string {
    const stamp = date.toISOString().slice(0, 10);
    return `kbox-recovery-${stamp}.${BACKUP_FILE_EXTENSION}`;
}

/** Trigger a browser download for the backup blob. */
export function downloadVaultBackup(file: VaultBackupFile, filename = defaultBackupFilename()): void {
    const blob = vaultBackupToBlob(file);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
