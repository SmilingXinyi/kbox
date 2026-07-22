import {useEffect, useState} from 'react';
import type {ApiKeyItem, LockBehavior, PendingSensitiveAction, VaultMetadata, VaultState} from '../types/vault';
import {decryptMasterKey, deriveKeyFromPin, deriveKeyFromWebAuthnSignatureHex} from '../lib/crypto';
import {clearVaultStorage, getEncryptedItemsFromDB, saveEncryptedItemsToDB} from '../lib/indexedDB';
import {STORAGE_KEYS} from '../lib/vaultStorageKeys';
import {
    clearLegacyStorageKeys,
    loadLocalV2Items,
    loadLockBehavior,
    loadCommonTags,
    loadV1CipherPayload,
    loadVaultMetadata,
    saveLockBehavior,
    saveCommonTags,
    saveVaultMetadata
} from '../lib/vaultMigration';
import {decryptDatabase} from '../lib/crypto';
import {decryptItemsInMemory, serializeAndEncryptItems} from '../lib/vaultItems';
import {getWebAuthnAssertion} from '../lib/webauthn';
import {useAutoLock} from './useAutoLock';

export function useVault() {
    const [vaultState, setVaultState] = useState<VaultState>('loading');
    const [metadata, setMetadata] = useState<VaultMetadata | null>(null);
    const [masterKey, setMasterKey] = useState<string | null>(null);
    const [items, setItems] = useState<ApiKeyItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [lockBehavior, setLockBehaviorState] = useState<LockBehavior>('delay-1m');
    const [commonTags, setCommonTagsState] = useState<string[]>([]);
    const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
    const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
    const [pendingAction, setPendingAction] = useState<PendingSensitiveAction | null>(null);
    const [showUnlockModal, setShowUnlockModal] = useState(false);

    useEffect(() => {
        async function loadInitialData() {
            try {
                setLockBehaviorState(loadLockBehavior());
                const initialTags = loadCommonTags();
                setCommonTagsState(initialTags);

                // Ensure tags are persisted if not already present
                if (!localStorage.getItem(STORAGE_KEYS.commonTags)) {
                    saveCommonTags(initialTags);
                }

                const meta = loadVaultMetadata();
                if (!meta) {
                    setVaultState('uninitialized');
                    return;
                }

                setMetadata(meta);

                const dbItems = await getEncryptedItemsFromDB();
                if (dbItems) {
                    setItems(dbItems);
                    setVaultState('unlocked');
                    return;
                }

                const localV2 = loadLocalV2Items();
                if (localV2) {
                    setItems(localV2);
                    await saveEncryptedItemsToDB(localV2);
                    setVaultState('unlocked');
                    return;
                }

                const v1 = loadV1CipherPayload();
                if (v1) {
                    setVaultState('locked');
                    return;
                }

                setItems([]);
                await saveEncryptedItemsToDB([]);
                setVaultState('unlocked');
            } catch (e) {
                console.error('Failed to load vault:', e);
                setError('Failed to load vault data.');
                setVaultState('uninitialized');
            }
        }

        void loadInitialData();
    }, []);

    const clearError = () => setError(null);

    const setLockBehavior = (behavior: LockBehavior) => {
        setLockBehaviorState(behavior);
        saveLockBehavior(behavior);
    };

    const setCommonTags = (tags: string[]) => {
        setCommonTagsState(tags);
        saveCommonTags(tags);
    };

    const persistItems = async (plainItems: ApiKeyItem[], keyHex: string) => {
        const encryptedItems = await serializeAndEncryptItems(plainItems, keyHex);
        await saveEncryptedItemsToDB(encryptedItems);
        setItems(plainItems);
    };

    const completeSetup = async (masterKeyHex: string, meta: VaultMetadata) => {
        saveVaultMetadata(meta);
        clearLegacyStorageKeys();
        setMetadata(meta);
        setMasterKey(masterKeyHex);
        await persistItems([], masterKeyHex);
        setVaultState('unlocked');
        setError(null);
    };

    const lock = async () => {
        setMasterKey(null);
        setRevealedKeys({});
        setCopiedKeyId(null);
        setPendingAction(null);
        setShowUnlockModal(false);

        try {
            const encryptedItems = await getEncryptedItemsFromDB();
            setItems(encryptedItems ?? []);
        } catch (e) {
            console.error('Failed to reload items on lock:', e);
            setItems([]);
        }
    };

    useAutoLock({
        enabled: vaultState === 'unlocked' && !!masterKey,
        lockBehavior,
        onLock: () => {
            void lock();
        }
    });

    const resetVault = async () => {
        await clearVaultStorage();
        clearLegacyStorageKeys();
        setMetadata(null);
        setMasterKey(null);
        setItems([]);
        setVaultState('uninitialized');
        setRevealedKeys({});
        setCopiedKeyId(null);
        setPendingAction(null);
        setShowUnlockModal(false);
        setError(null);
    };

    const applyMasterKey = async (
        keyHex: string,
        options?: {migrateV1?: boolean}
    ): Promise<PendingSensitiveAction | null> => {
        setMasterKey(keyHex);
        setError(null);

        const actionToResume = pendingAction;
        let residualAction: PendingSensitiveAction | null = null;

        if (options?.migrateV1) {
            const v1 = loadV1CipherPayload();
            if (v1) {
                try {
                    const decryptedJson = await decryptDatabase(v1.ciphertext, v1.iv, keyHex);
                    const parsed = JSON.parse(decryptedJson) as {items?: ApiKeyItem[]};
                    const decryptedItems = parsed.items ?? [];
                    await persistItems(decryptedItems, keyHex);
                    setVaultState('unlocked');
                    setShowUnlockModal(false);
                    setPendingAction(null);
                    return null;
                } catch (e) {
                    console.error('V1 migration failed:', e);
                    setMasterKey(null);
                    throw new Error('Decryption failed. The PIN or biometric key may be incorrect.', {
                        cause: e
                    });
                }
            }
        }

        const encryptedItems = await getEncryptedItemsFromDB();
        if (encryptedItems) {
            const plainItems = await decryptItemsInMemory(encryptedItems, keyHex);
            setItems(plainItems);

            if (actionToResume) {
                if (actionToResume.type === 'reveal' || actionToResume.type === 'copy') {
                    await resumePendingAction(plainItems, keyHex, actionToResume);
                } else {
                    residualAction = actionToResume;
                }
            }
        } else {
            setItems([]);
            if (actionToResume && actionToResume.type !== 'reveal' && actionToResume.type !== 'copy') {
                residualAction = actionToResume;
            }
        }

        setVaultState('unlocked');
        setShowUnlockModal(false);
        setPendingAction(null);
        return residualAction;
    };

    const resumePendingAction = async (plainItems: ApiKeyItem[], _keyHex: string, action: PendingSensitiveAction) => {
        if (action.type === 'reveal' && action.keyId) {
            setRevealedKeys(prev => ({...prev, [action.keyId!]: true}));
            return;
        }

        if (action.type === 'copy' && action.itemId && action.keyId) {
            const item = plainItems.find(i => i.id === action.itemId);
            const keyEntry = item?.keys.find(k => k.id === action.keyId);
            if (keyEntry?.value) {
                try {
                    await navigator.clipboard.writeText(keyEntry.value);
                    setCopiedKeyId(action.keyId);
                    window.setTimeout(() => setCopiedKeyId(null), 2000);
                } catch (e) {
                    console.error('Clipboard write failed:', e);
                    setError('Failed to copy to clipboard.');
                }
            }
        }
    };

    const unlockWithPin = async (pin: string): Promise<PendingSensitiveAction | null> => {
        if (!metadata) {
            throw new Error('Vault is not initialized.');
        }

        try {
            const pinKek = await deriveKeyFromPin(pin, metadata.salt);
            const keyHex = await decryptMasterKey(metadata.encryptedMasterKeyWithPin, metadata.pinIv, pinKek);
            return await applyMasterKey(keyHex, {migrateV1: vaultState === 'locked'});
        } catch (e) {
            console.error('PIN unlock failed:', e);
            if (e instanceof Error && e.message.startsWith('Decryption failed')) {
                throw e;
            }
            throw new Error('Incorrect PIN.', {cause: e});
        }
    };

    const unlockWithWebAuthn = async (simulatedSignature?: string): Promise<PendingSensitiveAction | null> => {
        if (!metadata?.hasWebAuthn || !metadata.webauthnCredentialId) {
            throw new Error('Biometrics are not enabled for this vault.');
        }

        if (!metadata.encryptedMasterKeyWithWebAuthn || !metadata.webauthnIv) {
            throw new Error('Biometric key material is missing.');
        }

        let signatureHex = simulatedSignature;

        if (!signatureHex) {
            const assertion = await getWebAuthnAssertion(metadata.webauthnCredentialId);
            if (!assertion.signatureHex) {
                throw new Error(assertion.errorMessage ?? 'Biometric authentication failed.');
            }
            signatureHex = assertion.signatureHex;
        }

        try {
            const kek = await deriveKeyFromWebAuthnSignatureHex(signatureHex);
            const keyHex = await decryptMasterKey(metadata.encryptedMasterKeyWithWebAuthn, metadata.webauthnIv, kek);
            return await applyMasterKey(keyHex, {migrateV1: vaultState === 'locked'});
        } catch (e) {
            console.error('WebAuthn unlock failed:', e);
            if (e instanceof Error && !e.message.includes('Biometric')) {
                throw new Error('Biometric unlock failed. Try your PIN instead.', {cause: e});
            }
            throw e;
        }
    };

    const requireMasterKey = (action: PendingSensitiveAction): boolean => {
        if (masterKey) return true;
        setPendingAction(action);
        setShowUnlockModal(true);
        return false;
    };

    const addItem = async (item: ApiKeyItem) => {
        if (!requireMasterKey({type: 'add'})) return;
        if (!masterKey) return;

        if (items.some(i => i.label.toLowerCase() === item.label.toLowerCase())) {
            throw new Error('An item with this label already exists.');
        }

        await persistItems([...items, item], masterKey);
    };

    const updateItem = async (item: ApiKeyItem) => {
        if (!requireMasterKey({type: 'edit', itemId: item.id})) return;
        if (!masterKey) return;

        if (items.some(i => i.id !== item.id && i.label.toLowerCase() === item.label.toLowerCase())) {
            throw new Error('An item with this label already exists.');
        }

        await persistItems(
            items.map(i => (i.id === item.id ? item : i)),
            masterKey
        );
    };

    const deleteItem = async (id: string) => {
        if (!requireMasterKey({type: 'delete', itemId: id})) return;
        if (!masterKey) return;

        await persistItems(
            items.filter(i => i.id !== id),
            masterKey
        );
    };

    /** Replace the entire vault item list (used by WebRTC device sync). */
    const replaceAllItems = async (plainItems: ApiKeyItem[]) => {
        if (!masterKey) {
            throw new Error('Unlock the vault before syncing.');
        }
        await persistItems(plainItems, masterKey);
        setRevealedKeys({});
        setCopiedKeyId(null);
    };

    const requestReveal = (itemId: string, keyId: string) => {
        if (masterKey) {
            setRevealedKeys(prev => ({...prev, [keyId]: !prev[keyId]}));
            return;
        }
        setPendingAction({type: 'reveal', itemId, keyId});
        setShowUnlockModal(true);
    };

    const requestCopy = async (itemId: string, keyId: string) => {
        if (!masterKey) {
            setPendingAction({type: 'copy', itemId, keyId});
            setShowUnlockModal(true);
            return;
        }

        const item = items.find(i => i.id === itemId);
        const keyEntry = item?.keys.find(k => k.id === keyId);
        if (!keyEntry?.value) return;

        try {
            await navigator.clipboard.writeText(keyEntry.value);
            setCopiedKeyId(keyId);
            window.setTimeout(() => setCopiedKeyId(null), 2000);
        } catch (e) {
            console.error('Clipboard write failed:', e);
            setError('Failed to copy to clipboard.');
        }
    };

    const hideRevealedKey = (keyId: string) => {
        setRevealedKeys(prev => {
            const next = {...prev};
            delete next[keyId];
            return next;
        });
    };

    const cancelUnlockModal = () => {
        setShowUnlockModal(false);
        setPendingAction(null);
    };

    return {
        vaultState,
        metadata,
        items,
        masterKey,
        error,
        isViewOnly: vaultState === 'unlocked' && !masterKey,
        showUnlockModal,
        setShowUnlockModal,
        revealedKeys,
        copiedKeyId,
        lockBehavior,
        setLockBehavior,
        commonTags,
        setCommonTags,
        completeSetup,
        unlockWithPin,
        unlockWithWebAuthn,
        lock,
        resetVault,
        addItem,
        updateItem,
        deleteItem,
        replaceAllItems,
        requestReveal,
        requestCopy,
        hideRevealedKey,
        cancelUnlockModal,
        requireMasterKey,
        clearError
    };
}

export type UseVaultReturn = ReturnType<typeof useVault>;
