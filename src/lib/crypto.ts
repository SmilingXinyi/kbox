// Web Crypto helpers for kbox vault

/** PIN KEK derivation strength (PBKDF2-HMAC-SHA-256). */
export const PBKDF2_ITERATIONS = 600_000;

export const PIN_MIN_LENGTH = 6;
export const PIN_MAX_LENGTH = 12;

export function arrayBufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export function hexToArrayBuffer(hex: string): ArrayBuffer {
    const normalized = hex.trim().toLowerCase();
    if (!normalized || normalized.length % 2 !== 0 || /[^0-9a-f]/.test(normalized)) {
        throw new Error('Invalid hex string.');
    }

    const bytes = new Uint8Array(normalized.length / 2);
    for (let i = 0; i < normalized.length; i += 2) {
        bytes[i / 2] = parseInt(normalized.substring(i, i + 2), 16);
    }
    return bytes.buffer as ArrayBuffer;
}

export function stringToBuffer(str: string): Uint8Array<ArrayBuffer> {
    return new TextEncoder().encode(str) as Uint8Array<ArrayBuffer>;
}

export function bufferToString(buffer: ArrayBuffer): string {
    return new TextDecoder().decode(buffer);
}

export function generateRandomHex(bytesCount: number): string {
    const array = new Uint8Array(bytesCount);
    window.crypto.getRandomValues(array);
    return arrayBufferToHex(array.buffer);
}

/** Validate PIN strength for new vaults. */
export function validatePinStrength(pin: string): string | null {
    if (pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH) {
        return `Security PIN must be ${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} characters.`;
    }
    if (/^\d+$/.test(pin) && new Set(pin).size === 1) {
        return 'PIN cannot be a repeated digit (e.g. 000000).';
    }
    return null;
}

export async function deriveKeyFromPin(
    pin: string,
    saltHex: string,
    iterations: number = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
    if (!Number.isFinite(iterations) || iterations < 1) {
        throw new Error('Invalid PBKDF2 iteration count.');
    }

    const pinBuffer = stringToBuffer(pin);
    const saltBuffer = hexToArrayBuffer(saltHex);

    const baseKey = await window.crypto.subtle.importKey('raw', pinBuffer, 'PBKDF2', false, [
        'deriveKey',
        'deriveBits'
    ]);

    return window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: saltBuffer,
            iterations,
            hash: 'SHA-256'
        },
        baseKey,
        {
            name: 'AES-GCM',
            length: 256
        },
        false,
        ['encrypt', 'decrypt']
    );
}

/** HKDF info binds the PRF output to kbox vault KEK derivation. */
const WEBAUTHN_KEK_HKDF_INFO = stringToBuffer('kbox-webauthn-kek-v1');

/**
 * Derive an AES-GCM KEK from WebAuthn PRF output (or simulator key material).
 * Uses HKDF-SHA-256 so the raw PRF bits are purpose-bound, not used as a key directly.
 */
export async function deriveKeyFromWebAuthnPrf(prfOutput: BufferSource): Promise<CryptoKey> {
    const ikm = await window.crypto.subtle.importKey('raw', prfOutput, 'HKDF', false, ['deriveKey']);

    return window.crypto.subtle.deriveKey(
        {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: new Uint8Array(),
            info: WEBAUTHN_KEK_HKDF_INFO
        },
        ikm,
        {name: 'AES-GCM', length: 256},
        false,
        ['encrypt', 'decrypt']
    );
}

export async function encryptMasterKey(
    masterKeyHex: string,
    kek: CryptoKey
): Promise<{ciphertext: string; iv: string}> {
    const masterKeyBytes = hexToArrayBuffer(masterKeyHex);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await window.crypto.subtle.encrypt({name: 'AES-GCM', iv}, kek, masterKeyBytes);

    return {
        ciphertext: arrayBufferToHex(encrypted),
        iv: arrayBufferToHex(iv.buffer)
    };
}

export async function decryptMasterKey(ciphertextHex: string, ivHex: string, kek: CryptoKey): Promise<string> {
    const ciphertext = hexToArrayBuffer(ciphertextHex);
    const iv = hexToArrayBuffer(ivHex);

    const decrypted = await window.crypto.subtle.decrypt({name: 'AES-GCM', iv}, kek, ciphertext);

    return arrayBufferToHex(decrypted);
}

export async function encryptDatabase(
    databaseJson: string,
    masterKeyHex: string
): Promise<{ciphertext: string; iv: string}> {
    const dataBuffer = stringToBuffer(databaseJson);
    const rawMasterKey = hexToArrayBuffer(masterKeyHex);

    const masterKey = await window.crypto.subtle.importKey('raw', rawMasterKey, {name: 'AES-GCM', length: 256}, false, [
        'encrypt',
        'decrypt'
    ]);

    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await window.crypto.subtle.encrypt({name: 'AES-GCM', iv}, masterKey, dataBuffer);

    return {
        ciphertext: arrayBufferToHex(encrypted),
        iv: arrayBufferToHex(iv.buffer)
    };
}

export async function decryptDatabase(ciphertextHex: string, ivHex: string, masterKeyHex: string): Promise<string> {
    const ciphertext = hexToArrayBuffer(ciphertextHex);
    const iv = hexToArrayBuffer(ivHex);
    const rawMasterKey = hexToArrayBuffer(masterKeyHex);

    const masterKey = await window.crypto.subtle.importKey('raw', rawMasterKey, {name: 'AES-GCM', length: 256}, false, [
        'encrypt',
        'decrypt'
    ]);

    const decrypted = await window.crypto.subtle.decrypt({name: 'AES-GCM', iv}, masterKey, ciphertext);

    return bufferToString(decrypted);
}
