import {ApiKeyItem} from '../types';

const DB_NAME = 'ApiKeySafeDB';
const DB_VERSION = 1;
const STORE_NAME = 'secure_store';
const ITEMS_KEY = 'apiKeySafe_db_items_v2';

/**
 * Check if IndexedDB is supported and accessible in this context.
 */
function isIndexedDBSupported(): boolean {
    try {
        return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
    } catch (e) {
        return false;
    }
}

/**
 * Open or initialize the IndexedDB database.
 */
function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (!isIndexedDBSupported()) {
            reject(new Error('IndexedDB is not supported or blocked in this environment'));
            return;
        }

        try {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = event => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error || new Error('Failed to open IndexedDB'));
            };
        } catch (e) {
            reject(e instanceof Error ? e : new Error('Security exception opening IndexedDB'));
        }
    });
}

/**
 * Save encrypted API Key items to IndexedDB with localStorage as backup.
 */
export async function saveEncryptedItemsToDB(items: ApiKeyItem[]): Promise<void> {
    // Always save to localStorage as a redundant/fallback storage
    try {
        localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
    } catch (e) {
        console.warn('Failed to write to localStorage backup:', e);
    }

    // Try saving to IndexedDB
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(items, ITEMS_KEY);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                // If IndexedDB write fails, we already have localStorage written, so we resolve
                console.warn('IndexedDB write error, relying on localStorage fallback:', request.error);
                resolve();
            };
        });
    } catch (err) {
        console.warn('IndexedDB not available, relying on localStorage fallback:', err);
    }
}

/**
 * Retrieve encrypted API Key items from IndexedDB, falling back to localStorage if empty or fails.
 */
export async function getEncryptedItemsFromDB(): Promise<ApiKeyItem[] | null> {
    // Try reading from IndexedDB first
    try {
        const db = await openDB();
        const dbResult = await new Promise<ApiKeyItem[] | null>((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(ITEMS_KEY);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                reject(request.error || new Error('Failed to read from IndexedDB'));
            };
        });

        if (dbResult) {
            return dbResult;
        }
    } catch (err) {
        console.warn('IndexedDB read failed or unsupported, trying localStorage:', err);
    }

    // Fallback to localStorage
    try {
        const backupData = localStorage.getItem(ITEMS_KEY);
        if (backupData) {
            return JSON.parse(backupData) as ApiKeyItem[];
        }
    } catch (e) {
        console.error('Failed to read from localStorage fallback:', e);
    }

    return null;
}

/**
 * Clear all security store data from both IndexedDB and localStorage.
 */
export async function clearAllIndexedDBData(): Promise<void> {
    // Clear localStorage
    try {
        localStorage.removeItem(ITEMS_KEY);
    } catch (e) {
        console.error('Failed to clear backup from localStorage:', e);
    }

    // Clear IndexedDB
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(ITEMS_KEY);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                console.warn('IndexedDB clear error:', request.error);
                resolve(); // resolve because we cleared localStorage
            };
        });
    } catch (err) {
        console.warn('IndexedDB not available for clear:', err);
    }
}
