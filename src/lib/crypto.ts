// Web Crypto helpers for kbox vault

export function arrayBufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export function hexToArrayBuffer(hex: string): ArrayBuffer {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
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

export async function deriveKeyFromPin(pin: string, saltHex: string): Promise<CryptoKey> {
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
            iterations: 100000,
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

/**
 * Derive KEK from WebAuthn signature hex string.
 * Hashes the UTF-8 bytes of the hex string (matches demo VaultSetup/Unlock behavior)
 * so existing vaults remain decryptable.
 */
export async function deriveKeyFromWebAuthnSignatureHex(signatureHex: string): Promise<CryptoKey> {
    const signatureBytes = stringToBuffer(signatureHex);
    const hash = await window.crypto.subtle.digest('SHA-256', signatureBytes);

    return window.crypto.subtle.importKey('raw', hash, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
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
