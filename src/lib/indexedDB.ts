import type {ApiKeyItem} from '../types/vault';
import {IDB_NAME, IDB_STORE, IDB_VERSION, STORAGE_KEYS} from './vaultStorageKeys';

function isIndexedDBSupported(): boolean {
    try {
        return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
    } catch {
        return false;
    }
}

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (!isIndexedDBSupported()) {
            reject(new Error('IndexedDB is not supported or blocked in this environment'));
            return;
        }

        try {
            const request = indexedDB.open(IDB_NAME, IDB_VERSION);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(IDB_STORE)) {
                    db.createObjectStore(IDB_STORE);
                }
            };

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error ?? new Error('Failed to open IndexedDB'));
            };
        } catch (e) {
            reject(e instanceof Error ? e : new Error('Security exception opening IndexedDB'));
        }
    });
}

export async function saveEncryptedItemsToDB(items: ApiKeyItem[]): Promise<void> {
    try {
        localStorage.setItem(STORAGE_KEYS.itemsV2, JSON.stringify(items));
    } catch (e) {
        console.warn('Failed to write to localStorage backup:', e);
    }

    try {
        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(IDB_STORE, 'readwrite');
            const store = transaction.objectStore(IDB_STORE);
            const request = store.put(items, STORAGE_KEYS.itemsV2);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                console.warn('IndexedDB write error, relying on localStorage fallback:', request.error);
                resolve();
            };

            transaction.onerror = () => {
                reject(transaction.error ?? new Error('IndexedDB transaction failed'));
            };
        });
    } catch (err) {
        console.warn('IndexedDB not available, relying on localStorage fallback:', err);
    }
}

export async function getEncryptedItemsFromDB(): Promise<ApiKeyItem[] | null> {
    try {
        const db = await openDB();
        const dbResult = await new Promise<ApiKeyItem[] | null>((resolve, reject) => {
            const transaction = db.transaction(IDB_STORE, 'readonly');
            const store = transaction.objectStore(IDB_STORE);
            const request = store.get(STORAGE_KEYS.itemsV2);

            request.onsuccess = () => {
                resolve((request.result as ApiKeyItem[] | undefined) ?? null);
            };

            request.onerror = () => {
                reject(request.error ?? new Error('Failed to read from IndexedDB'));
            };
        });

        if (dbResult) {
            return dbResult;
        }
    } catch (err) {
        console.warn('IndexedDB read failed or unsupported, trying localStorage:', err);
    }

    try {
        const backupData = localStorage.getItem(STORAGE_KEYS.itemsV2);
        if (backupData) {
            return JSON.parse(backupData) as ApiKeyItem[];
        }
    } catch (e) {
        console.error('Failed to read from localStorage fallback:', e);
    }

    return null;
}

export async function clearVaultStorage(): Promise<void> {
    const keys = Object.values(STORAGE_KEYS);
    for (const key of keys) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error('Failed to clear localStorage key:', key, e);
        }
    }

    try {
        const db = await openDB();
        await new Promise<void>(resolve => {
            const transaction = db.transaction(IDB_STORE, 'readwrite');
            const store = transaction.objectStore(IDB_STORE);
            const request = store.delete(STORAGE_KEYS.itemsV2);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                console.warn('IndexedDB clear error:', request.error);
                resolve();
            };
        });
    } catch (err) {
        console.warn('IndexedDB not available for clear:', err);
    }
}
