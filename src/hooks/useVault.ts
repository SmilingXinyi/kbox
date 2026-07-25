import {useEffect, useState} from 'react';
import type {
    ApiKeyItem,
    LockBehavior,
    PendingSensitiveAction,
    ResidualUnlockResult,
    VaultMetadata,
    VaultState
} from '../types/vault';
import {decryptMasterKey, deriveKeyFromPin, deriveKeyFromWebAuthnPrf, hexToArrayBuffer} from '../lib/crypto';
import {clearVaultStorage, getEncryptedItemsFromDB, saveEncryptedItemsToDB} from '../lib/indexedDB';
import {STORAGE_KEYS} from '../lib/vaultStorageKeys';
import {
    loadLocalV2Items,
    loadLockBehavior,
    loadCommonTags,
    loadVaultMetadata,
    saveLockBehavior,
    saveCommonTags,
    saveVaultMetadata
} from '../lib/vaultMigration';
import {decryptItemsInMemory, serializeAndEncryptItems} from '../lib/vaultItems';
import {getWebAuthnAssertion} from '../lib/webauthn';
import {isBiometricSimulatorEnabled} from '../lib/biometricSimulator';
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

    const applyMasterKey = async (keyHex: string): Promise<ResidualUnlockResult | null> => {
        setMasterKey(keyHex);
        setError(null);

        const actionToResume = pendingAction;

        try {
            const encryptedItems = await getEncryptedItemsFromDB();
            let plainItems: ApiKeyItem[] = [];

            if (encryptedItems) {
                plainItems = await decryptItemsInMemory(encryptedItems, keyHex);
                setItems(plainItems);
            } else {
                setItems([]);
            }

            if (actionToResume) {
                if (actionToResume.type === 'reveal' || actionToResume.type === 'copy') {
                    await resumePendingAction(plainItems, actionToResume);
                } else if (actionToResume.type === 'delete' && actionToResume.itemId) {
                    await persistItems(
                        plainItems.filter(i => i.id !== actionToResume.itemId),
                        keyHex
                    );
                } else if (actionToResume.type === 'add' || actionToResume.type === 'edit') {
                    setVaultState('unlocked');
                    setShowUnlockModal(false);
                    setPendingAction(null);
                    return {action: actionToResume, items: plainItems};
                }
            }

            setVaultState('unlocked');
            setShowUnlockModal(false);
            setPendingAction(null);
            return null;
        } catch (e) {
            setMasterKey(null);
            setRevealedKeys({});
            console.error('Failed to apply master key:', e);
            if (e instanceof Error && e.message.startsWith('Failed to decrypt vault items')) {
                throw e;
            }
            throw new Error('Failed to decrypt vault items. The master key may be incorrect.', {cause: e});
        }
    };

    const resumePendingAction = async (plainItems: ApiKeyItem[], action: PendingSensitiveAction) => {
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

    const unlockWithPin = async (pin: string): Promise<ResidualUnlockResult | null> => {
        if (!metadata) {
            throw new Error('Vault is not initialized.');
        }

        try {
            const pinKek = await deriveKeyFromPin(pin, metadata.salt);
            const keyHex = await decryptMasterKey(metadata.encryptedMasterKeyWithPin, metadata.pinIv, pinKek);
            return await applyMasterKey(keyHex);
        } catch (e) {
            console.error('PIN unlock failed:', e);
            if (e instanceof Error && e.message.startsWith('Failed to decrypt vault items')) {
                throw e;
            }
            throw new Error('Incorrect PIN.', {cause: e});
        }
    };

    const unlockWithWebAuthn = async (simulatedKeyMaterialHex?: string): Promise<ResidualUnlockResult | null> => {
        if (!metadata?.hasWebAuthn || !metadata.webauthnCredentialId) {
            throw new Error('Biometrics are not enabled for this vault.');
        }

        if (!metadata.encryptedMasterKeyWithWebAuthn || !metadata.webauthnIv || !metadata.webauthnKeySource) {
            throw new Error('Biometric key material is missing.');
        }

        const keySource = metadata.webauthnKeySource;
        let prfOutput: BufferSource;

        if (simulatedKeyMaterialHex) {
            if (!isBiometricSimulatorEnabled()) {
                throw new Error('Biometric sandbox is disabled. Use your PIN instead.');
            }
            prfOutput = hexToArrayBuffer(simulatedKeyMaterialHex);
        } else if (keySource === 'simulated') {
            if (!isBiometricSimulatorEnabled()) {
                throw new Error(
                    'This vault was enrolled with the biometric sandbox, which is disabled here. Use your PIN instead.'
                );
            }
            throw new Error('Biometric sandbox required.');
        } else {
            if (!metadata.webauthnPrfSalt) {
                throw new Error('Biometric PRF salt is missing. Use your PIN instead.');
            }

            const assertion = await getWebAuthnAssertion(metadata.webauthnCredentialId, metadata.webauthnPrfSalt);
            if (!assertion.prfOutput) {
                throw new Error(assertion.errorMessage ?? 'Biometric authentication failed.');
            }
            prfOutput = assertion.prfOutput;
        }

        try {
            const kek = await deriveKeyFromWebAuthnPrf(prfOutput);
            const keyHex = await decryptMasterKey(metadata.encryptedMasterKeyWithWebAuthn, metadata.webauthnIv, kek);
            return await applyMasterKey(keyHex);
        } catch (e) {
            console.error('WebAuthn unlock failed:', e);
            if (e instanceof Error && e.message === 'Biometric sandbox required.') {
                throw e;
            }
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
