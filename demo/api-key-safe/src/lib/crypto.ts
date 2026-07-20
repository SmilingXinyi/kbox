// Web Crypto API helpers for API Key Safe

// Convert ArrayBuffer to Hex string
export function arrayBufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Convert Hex string to ArrayBuffer
export function hexToArrayBuffer(hex: string): ArrayBuffer {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes.buffer;
}

// Convert string to Uint8Array (UTF-8)
export function stringToBuffer(str: string): Uint8Array {
    return new TextEncoder().encode(str);
}

// Convert ArrayBuffer to string (UTF-8)
export function bufferToString(buffer: ArrayBuffer): string {
    return new TextDecoder().decode(buffer);
}

// Generate a high-entropy random key (256-bit) as a Hex string
export function generateRandomHex(bytesCount: number): string {
    const array = new Uint8Array(bytesCount);
    window.crypto.getRandomValues(array);
    return arrayBufferToHex(array.buffer);
}

// Derive a CryptoKey from PIN using PBKDF2
export async function deriveKeyFromPin(pin: string, saltHex: string): Promise<CryptoKey> {
    const pinBuffer = stringToBuffer(pin);
    const saltBuffer = hexToArrayBuffer(saltHex);

    // Import the raw PIN as a key material
    const baseKey = await window.crypto.subtle.importKey('raw', pinBuffer, 'PBKDF2', false, [
        'deriveKey',
        'deriveBits'
    ]);

    // Derive the AES-GCM Key Encryption Key (KEK)
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

// Derive a CryptoKey from WebAuthn assertion signature using SHA-256 hashing
export async function deriveKeyFromWebAuthnSignature(signatureBuffer: ArrayBuffer): Promise<CryptoKey> {
    const hash = await window.crypto.subtle.digest('SHA-256', signatureBuffer);

    return window.crypto.subtle.importKey('raw', hash, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}

// Encrypt the raw Master Key with a derived Key Encryption Key (derived from PIN or WebAuthn)
export async function encryptMasterKey(
    masterKeyHex: string,
    kek: CryptoKey
): Promise<{ciphertext: string; iv: string}> {
    const masterKeyBytes = hexToArrayBuffer(masterKeyHex);
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 12 bytes standard IV for AES-GCM

    const encrypted = await window.crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        kek,
        masterKeyBytes
    );

    return {
        ciphertext: arrayBufferToHex(encrypted),
        iv: arrayBufferToHex(iv.buffer)
    };
}

// Decrypt the raw Master Key with a derived Key Encryption Key
export async function decryptMasterKey(ciphertextHex: string, ivHex: string, kek: CryptoKey): Promise<string> {
    const ciphertext = hexToArrayBuffer(ciphertextHex);
    const iv = hexToArrayBuffer(ivHex);

    const decrypted = await window.crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        kek,
        ciphertext
    );

    return arrayBufferToHex(decrypted);
}

// Encrypt database payload using the raw Master Key
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

    const encrypted = await window.crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        masterKey,
        dataBuffer
    );

    return {
        ciphertext: arrayBufferToHex(encrypted),
        iv: arrayBufferToHex(iv.buffer)
    };
}

// Decrypt database payload using the raw Master Key
export async function decryptDatabase(ciphertextHex: string, ivHex: string, masterKeyHex: string): Promise<string> {
    const ciphertext = hexToArrayBuffer(ciphertextHex);
    const iv = hexToArrayBuffer(ivHex);
    const rawMasterKey = hexToArrayBuffer(masterKeyHex);

    const masterKey = await window.crypto.subtle.importKey('raw', rawMasterKey, {name: 'AES-GCM', length: 256}, false, [
        'encrypt',
        'decrypt'
    ]);

    const decrypted = await window.crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        masterKey,
        ciphertext
    );

    return bufferToString(decrypted);
}
