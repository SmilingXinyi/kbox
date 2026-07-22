import type {ApiKeyItem} from '../types/vault';
import {decryptDatabase, encryptDatabase} from './crypto';

export async function serializeAndEncryptItems(plainItems: ApiKeyItem[], keyHex: string): Promise<ApiKeyItem[]> {
    const encryptedItems: ApiKeyItem[] = [];

    for (const item of plainItems) {
        const encryptedKeys = [];
        for (const keyEntry of item.keys) {
            if (keyEntry.value) {
                const encrypted = await encryptDatabase(keyEntry.value, keyHex);
                encryptedKeys.push({
                    id: keyEntry.id,
                    label: keyEntry.label,
                    value: '',
                    encryptedValue: encrypted.ciphertext,
                    iv: encrypted.iv
                });
            } else {
                encryptedKeys.push({
                    id: keyEntry.id,
                    label: keyEntry.label,
                    value: '',
                    encryptedValue: keyEntry.encryptedValue ?? '',
                    iv: keyEntry.iv ?? ''
                });
            }
        }
        encryptedItems.push({
            ...item,
            keys: encryptedKeys
        });
    }

    return encryptedItems;
}

/**
 * Decrypt all key values. Fail-closed: any ciphertext that cannot be decrypted
 * rejects the whole unlock rather than exposing a fake plaintext placeholder.
 */
export async function decryptItemsInMemory(encryptedItems: ApiKeyItem[], keyHex: string): Promise<ApiKeyItem[]> {
    const decryptedItems: ApiKeyItem[] = [];

    for (const item of encryptedItems) {
        const decryptedKeys = [];
        for (const keyEntry of item.keys) {
            if (keyEntry.encryptedValue && keyEntry.iv) {
                try {
                    const plainValue = await decryptDatabase(keyEntry.encryptedValue, keyEntry.iv, keyHex);
                    decryptedKeys.push({
                        ...keyEntry,
                        value: plainValue
                    });
                } catch (e) {
                    console.error(`Failed to decrypt key ${keyEntry.id}:`, e);
                    throw new Error('Failed to decrypt vault items. The master key may be incorrect.', {
                        cause: e
                    });
                }
            } else {
                decryptedKeys.push({
                    ...keyEntry,
                    value: keyEntry.value || ''
                });
            }
        }
        decryptedItems.push({
            ...item,
            keys: decryptedKeys
        });
    }

    return decryptedItems;
}
