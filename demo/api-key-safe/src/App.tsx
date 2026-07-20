import React, {useState, useEffect} from 'react';
import {motion, AnimatePresence} from 'motion/react';
import {
    ShieldAlert,
    Plus,
    Lock,
    Unlock,
    Search,
    Tag,
    Key,
    Database,
    ExternalLink,
    RotateCcw,
    RefreshCw,
    FolderOpen,
    Info,
    Settings,
    Sparkles,
    CheckCircle
} from 'lucide-react';
import {ApiKeyItem, VaultMetadata} from './types';
import {decryptDatabase, encryptDatabase} from './lib/crypto';
import {isRunningInIframe} from './lib/webauthn';
import VaultSetup from './components/VaultSetup';
import VaultUnlock from './components/VaultUnlock';
import ApiKeyForm from './components/ApiKeyForm';
import ApiKeyCard from './components/ApiKeyCard';
import VaultSettings from './components/VaultSettings';
import {saveEncryptedItemsToDB, getEncryptedItemsFromDB, clearAllIndexedDBData} from './lib/indexedDB';

// Helper to serialize and encrypt individual key values for storage
async function serializeAndEncryptItems(plainItems: ApiKeyItem[], keyHex: string): Promise<ApiKeyItem[]> {
    const encryptedItems: ApiKeyItem[] = [];

    for (const item of plainItems) {
        const encryptedKeys = [];
        for (const keyEntry of item.keys) {
            if (keyEntry.value) {
                const encrypted = await encryptDatabase(keyEntry.value, keyHex);
                encryptedKeys.push({
                    id: keyEntry.id,
                    label: keyEntry.label,
                    value: '', // Keep plaintext empty in storage representation
                    encryptedValue: encrypted.ciphertext,
                    iv: encrypted.iv
                });
            } else {
                encryptedKeys.push({
                    id: keyEntry.id,
                    label: keyEntry.label,
                    value: '',
                    encryptedValue: keyEntry.encryptedValue || '',
                    iv: keyEntry.iv || ''
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

// Helper to decrypt all key values in memory from encrypted storage representation
async function decryptItemsInMemory(encryptedItems: ApiKeyItem[], keyHex: string): Promise<ApiKeyItem[]> {
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
                    decryptedKeys.push({
                        ...keyEntry,
                        value: 'Decryption Error'
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

export default function App() {
    const [vaultState, setVaultState] = useState<'loading' | 'uninitialized' | 'locked' | 'unlocked'>('loading');
    const [metadata, setMetadata] = useState<VaultMetadata | null>(null);
    const [masterKey, setMasterKey] = useState<string | null>(null);
    const [items, setItems] = useState<ApiKeyItem[]>([]);

    // Search and filters
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTag, setSelectedTag] = useState<string>('All');

    // Modal and edit states
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editItem, setEditItem] = useState<ApiKeyItem | null>(null);

    // On-demand decryption & session lock states
    const [showUnlockModal, setShowUnlockModal] = useState(false);
    const [pendingAction, setPendingAction] = useState<{type: 'reveal' | 'copy'; itemId: string; keyId: string} | null>(
        null
    );
    const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
    const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

    // Settings & Locking custom state
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [lockBehavior, setLockBehavior] = useState<'always' | 'delay-30s' | 'delay-1m' | 'delay-5m' | 'once'>(
        'delay-1m'
    );

    // PWA & Service Worker state
    const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const [updateAvailable, setUpdateAvailable] = useState(false);

    // Load metadata on mount to see if vault is initialized
    useEffect(() => {
        async function loadInitialData() {
            try {
                const savedBehavior = localStorage.getItem('apiKeySafe_lock_behavior');
                if (savedBehavior) {
                    setLockBehavior(savedBehavior as any);
                }

                const storedMeta = localStorage.getItem('apiKeySafe_metadata');
                if (storedMeta) {
                    const meta = JSON.parse(storedMeta) as VaultMetadata;
                    setMetadata(meta);

                    // Check if IndexedDB has the v2 database
                    const dbItems = await getEncryptedItemsFromDB();
                    if (dbItems) {
                        setItems(dbItems);
                        setVaultState('unlocked');
                    } else {
                        // Check if we have localStorage v2 items to migrate to IndexedDB
                        const v2ItemsStr = localStorage.getItem('apiKeySafe_db_items_v2');
                        if (v2ItemsStr) {
                            const parsedItems = JSON.parse(v2ItemsStr) as ApiKeyItem[];
                            setItems(parsedItems);
                            await saveEncryptedItemsToDB(parsedItems);
                            setVaultState('unlocked');
                        } else {
                            // No v2 database, check if there is an old database to migrate
                            const oldCiphertext = localStorage.getItem('apiKeySafe_db_ciphertext');
                            if (oldCiphertext) {
                                setVaultState('locked'); // Show full-screen unlock to perform migration
                            } else {
                                setItems([]);
                                await saveEncryptedItemsToDB([]);
                                setVaultState('unlocked');
                            }
                        }
                    }
                } else {
                    setVaultState('uninitialized');
                }
            } catch (e) {
                console.error('Failed to load initial metadata/IndexedDB:', e);
                setVaultState('uninitialized');
            }
        }
        loadInitialData();
    }, []);

    // Handle successful vault initialization
    const handleInitialized = async (keyHex: string, meta: VaultMetadata) => {
        setMasterKey(keyHex);
        setMetadata(meta);

        // Create a beautiful starter AK/SK key automatically so they can immediately see the layout!
        const starterItem: ApiKeyItem = {
            id: 'starter-item',
            label: 'Google Gemini Pro Dev',
            tag: 'AI',
            description: 'Used for server-side LLM inference on the developer staging backend.',
            keys: [
                {id: 'sk-1', label: 'Access Key ID (AK)', value: 'AK_AI_STUDIO_STAGE_2026_V1'},
                {
                    id: 'sk-2',
                    label: 'Secret Access Key (SK)',
                    value: 'sk-proj-7a8D9fA0b1C2e3D4e5F6a7B8c9D0e1F2a3B4c5D6e7'
                }
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await saveDatabase([starterItem], keyHex);
        setVaultState('unlocked');
    };

    // Handle successful vault unlock (for migration path)
    const handleUnlock = async (keyHex: string) => {
        setMasterKey(keyHex);
        try {
            const iv = localStorage.getItem('apiKeySafe_db_iv');
            const ciphertext = localStorage.getItem('apiKeySafe_db_ciphertext');

            let decryptedItems: ApiKeyItem[] = [];

            if (iv && ciphertext) {
                // Decrypt the stored database JSON payload
                const decryptedJson = await decryptDatabase(ciphertext, iv, keyHex);
                const parsed = JSON.parse(decryptedJson);
                decryptedItems = parsed.items || [];
            }

            // Migrate to v2 format
            const v2Items = await serializeAndEncryptItems(decryptedItems, keyHex);
            await saveEncryptedItemsToDB(v2Items);

            setItems(decryptedItems);
            setVaultState('unlocked');
        } catch (err) {
            console.error('Decryption failed on unlock:', err);
            alert('Cryptographic decryption of the database failed. The derived key might be wrong.');
        }
    };

    // Handle on-demand authentication completion
    const handleUnlockOnDemand = async (keyHex: string) => {
        setMasterKey(keyHex);
        setShowUnlockModal(false);

        try {
            const encryptedItems = await getEncryptedItemsFromDB();
            if (encryptedItems) {
                const plainItems = await decryptItemsInMemory(encryptedItems, keyHex);
                setItems(plainItems);

                // Auto-resume the pending copy/reveal action
                if (pendingAction) {
                    const {type, itemId, keyId} = pendingAction;
                    if (type === 'reveal') {
                        setRevealedKeys(prev => ({
                            ...prev,
                            [keyId]: true
                        }));
                    } else if (type === 'copy') {
                        const item = plainItems.find(i => i.id === itemId);
                        const keyEntry = item?.keys.find(k => k.id === keyId);
                        if (keyEntry && keyEntry.value) {
                            navigator.clipboard.writeText(keyEntry.value);
                            setCopiedKeyId(keyId);
                            setTimeout(() => {
                                setCopiedKeyId(null);
                            }, 2000);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Failed to decrypt items on-demand:', err);
            alert('Authentication succeeded, but failed to decrypt keys. Database might be corrupt.');
        } finally {
            setPendingAction(null);
        }
    };

    // Lock the vault, erasing the memory-resident keys
    const handleLock = async () => {
        setMasterKey(null);
        setRevealedKeys({});
        setCopiedKeyId(null);

        // Reset memory state to encrypted database items
        try {
            const encryptedItems = await getEncryptedItemsFromDB();
            if (encryptedItems) {
                setItems(encryptedItems);
            } else {
                setItems([]);
            }
        } catch (e) {
            console.error('Failed to reload items on lock:', e);
            setItems([]);
        }
    };

    // Completely wipe storage and reset to clean state
    const handleReset = async () => {
        localStorage.removeItem('apiKeySafe_metadata');
        localStorage.removeItem('apiKeySafe_db_iv');
        localStorage.removeItem('apiKeySafe_db_ciphertext');
        localStorage.removeItem('apiKeySafe_db_items_v2');
        await clearAllIndexedDBData();
        setMetadata(null);
        setMasterKey(null);
        setItems([]);
        setVaultState('uninitialized');
        setRevealedKeys({});
        setCopiedKeyId(null);
    };

    // Register Service Worker for PWA + Update Checks
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('/sw.js')
                .then(reg => {
                    setSwRegistration(reg);

                    // Check if there is an active waiting service worker already
                    if (reg.waiting) {
                        setUpdateAvailable(true);
                    }

                    // Listen for new service workers installing
                    reg.addEventListener('updatefound', () => {
                        const installingWorker = reg.installing;
                        if (installingWorker) {
                            installingWorker.addEventListener('statechange', () => {
                                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    setUpdateAvailable(true);
                                }
                            });
                        }
                    });
                })
                .catch(err => {
                    console.warn('PWA Service Worker registration failed:', err);
                });

            // Reload page when the new Service Worker takes control
            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing) {
                    refreshing = true;
                    window.location.reload();
                }
            });
        }
    }, []);

    // Inactivity & Background Lock Tracker
    useEffect(() => {
        if (vaultState !== 'unlocked' || !masterKey) return;

        let backgroundedAt = 0;
        let inactivityTimer: NodeJS.Timeout | null = null;

        const resetInactivityTimer = () => {
            if (inactivityTimer) clearTimeout(inactivityTimer);

            if (lockBehavior === 'once') return;

            let delay = 0;
            if (lockBehavior === 'always')
                delay = 5000; // 5 seconds inactivity
            else if (lockBehavior === 'delay-30s') delay = 30000;
            else if (lockBehavior === 'delay-1m') delay = 60000;
            else if (lockBehavior === 'delay-5m') delay = 300000;

            if (delay > 0) {
                inactivityTimer = setTimeout(() => {
                    console.log('Locking due to inactivity');
                    handleLock();
                }, delay);
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                backgroundedAt = Date.now();
                if (lockBehavior === 'always') {
                    console.log('Locking immediately on backgrounding');
                    handleLock();
                }
            } else {
                // Returned to foreground
                if (backgroundedAt > 0 && lockBehavior !== 'once') {
                    const bgDuration = Date.now() - backgroundedAt;
                    let maxBgDelay = 0;
                    if (lockBehavior === 'always') maxBgDelay = 0;
                    else if (lockBehavior === 'delay-30s') maxBgDelay = 30000;
                    else if (lockBehavior === 'delay-1m') maxBgDelay = 60000;
                    else if (lockBehavior === 'delay-5m') maxBgDelay = 300000;

                    if (bgDuration >= maxBgDelay) {
                        console.log('Locking due to background duration');
                        handleLock();
                    }
                }
                backgroundedAt = 0;
            }
        };

        // Events that count as user activity
        const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
        activityEvents.forEach(event => {
            window.addEventListener(event, resetInactivityTimer);
        });

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Initial trigger
        resetInactivityTimer();

        return () => {
            if (inactivityTimer) clearTimeout(inactivityTimer);
            activityEvents.forEach(event => {
                window.removeEventListener(event, resetInactivityTimer);
            });
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [vaultState, masterKey, lockBehavior]);

    // Handle manual upgrade trigger
    const handleManualUpgrade = () => {
        if (swRegistration && swRegistration.waiting) {
            swRegistration.waiting.postMessage({type: 'SKIP_WAITING'});
        } else {
            window.location.reload();
        }
    };

    // Handle change in auto-lock behavior
    const handleLockBehaviorChange = (behavior: 'always' | 'delay-30s' | 'delay-1m' | 'delay-5m' | 'once') => {
        setLockBehavior(behavior);
        localStorage.setItem('apiKeySafe_lock_behavior', behavior);
    };

    // Encrypt and save items array to IndexedDB
    const saveDatabase = async (newItems: ApiKeyItem[], keyHex: string) => {
        if (!keyHex) return;
        try {
            const encryptedItems = await serializeAndEncryptItems(newItems, keyHex);
            await saveEncryptedItemsToDB(encryptedItems);
            setItems(newItems);
        } catch (e) {
            console.error('Database encryption failed:', e);
            alert('Security Exception: Failed to encrypt and save data updates.');
        }
    };

    // CRUD Actions
    const handleAddKeyClick = () => {
        if (!masterKey) {
            setPendingAction(null);
            setShowUnlockModal(true);
        } else {
            setEditItem(null);
            setIsFormOpen(true);
        }
    };

    const handleEditClick = (item: ApiKeyItem) => {
        if (!masterKey) {
            setPendingAction(null);
            setShowUnlockModal(true);
        } else {
            setEditItem(item);
            setIsFormOpen(true);
        }
    };

    const handleDeleteItem = (id: string) => {
        if (!masterKey) {
            setPendingAction(null);
            setShowUnlockModal(true);
            return;
        }
        const filtered = items.filter(i => i.id !== id);
        saveDatabase(filtered, masterKey);
    };

    const handleSaveForm = (item: ApiKeyItem) => {
        if (!masterKey) return;
        let updated: ApiKeyItem[];
        if (editItem) {
            updated = items.map(i => (i.id === item.id ? item : i));
        } else {
            updated = [...items, item];
        }
        saveDatabase(updated, masterKey);
        setIsFormOpen(false);
    };

    // Handle Copy / Reveal Actions from Cards
    const handleToggleReveal = (itemId: string, keyId: string) => {
        if (masterKey) {
            setRevealedKeys(prev => ({
                ...prev,
                [keyId]: !prev[keyId]
            }));
        } else {
            setPendingAction({type: 'reveal', itemId, keyId});
            setShowUnlockModal(true);
        }
    };

    const handleCopyKey = (itemId: string, keyId: string) => {
        if (masterKey) {
            const item = items.find(i => i.id === itemId);
            const keyEntry = item?.keys.find(k => k.id === keyId);
            if (keyEntry && keyEntry.value) {
                navigator.clipboard.writeText(keyEntry.value);
                setCopiedKeyId(keyId);
                setTimeout(() => {
                    setCopiedKeyId(null);
                }, 2000);
            }
        } else {
            setPendingAction({type: 'copy', itemId, keyId});
            setShowUnlockModal(true);
        }
    };

    // Derive unique tags from current items list
    const uniqueTags = ['All', ...(Array.from(new Set(items.map(item => item.tag).filter(Boolean))) as string[])];

    // Filtering Logic
    const filteredItems = items.filter(item => {
        const matchesTag = selectedTag === 'All' || item.tag === selectedTag;

        const term = searchQuery.toLowerCase();
        const matchesSearch =
            !term ||
            item.label.toLowerCase().includes(term) ||
            (item.tag && item.tag.toLowerCase().includes(term)) ||
            (item.description && item.description.toLowerCase().includes(term)) ||
            item.keys.some(
                k => k.label.toLowerCase().includes(term) || (k.value && k.value.toLowerCase().includes(term))
            );

        return matchesTag && matchesSearch;
    });

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased">
            {/* Visual background gradient mesh */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-30">
                <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-violet-600/10 rounded-full blur-[100px]" />
            </div>

            <AnimatePresence mode="wait">
                {vaultState === 'loading' && (
                    <motion.div
                        key="loading"
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        exit={{opacity: 0}}
                        className="flex-1 flex flex-col items-center justify-center space-y-4"
                    >
                        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                        <span className="text-xs text-slate-500 font-mono tracking-wider">SECURE LINKING...</span>
                    </motion.div>
                )}

                {vaultState === 'uninitialized' && (
                    <motion.div key="setup" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}>
                        <VaultSetup onInitialized={handleInitialized} />
                    </motion.div>
                )}

                {vaultState === 'locked' && metadata && (
                    <motion.div key="unlock" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}>
                        <VaultUnlock metadata={metadata} onUnlock={handleUnlock} onReset={handleReset} />
                    </motion.div>
                )}

                {vaultState === 'unlocked' && (
                    <motion.div
                        key="dashboard"
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        exit={{opacity: 0}}
                        className="flex-1 flex flex-col z-10"
                    >
                        {/* Header Panel */}
                        <header className="border-b border-slate-900 bg-slate-950/60 backdrop-blur-md sticky top-0 z-30 px-4 py-3 sm:px-6">
                            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                                {/* Logo and Status Badge */}
                                <div className="flex items-center space-x-3 shrink-0">
                                    <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-lg shadow-inner">
                                        <Database className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h1 className="text-sm font-bold tracking-tight text-slate-100 flex items-center space-x-1">
                                            <span>API Key Safe</span>
                                        </h1>
                                        <div className="flex items-center space-x-1.5 mt-0.5">
                                            <span
                                                className={`w-1.5 h-1.5 rounded-full animate-pulse ${masterKey ? 'bg-emerald-400' : 'bg-amber-400'}`}
                                            />
                                            <span className="text-[9px] font-mono font-semibold text-slate-500 tracking-wider uppercase">
                                                <span className="hidden sm:inline">
                                                    {masterKey
                                                        ? 'AES-256 Memory Unlocked'
                                                        : 'AES-256 Memory Locked (View-Only)'}
                                                </span>
                                                <span className="inline sm:hidden">
                                                    {masterKey ? 'Unlocked' : 'Locked'}
                                                </span>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Search Bar & Filter - Fluid and desktop optimized */}
                                <div className="flex-1 max-w-md hidden sm:flex items-center space-x-2">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
                                        <input
                                            id="search-keys-input"
                                            type="text"
                                            placeholder="Search unique labels, tags, secret values..."
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-900 rounded-lg text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                                        />
                                    </div>
                                    {uniqueTags.length > 1 && (
                                        <div className="flex space-x-1">
                                            {uniqueTags.map(tag => (
                                                <button
                                                    id={`tag-filter-${tag}`}
                                                    key={tag}
                                                    onClick={() => setSelectedTag(tag)}
                                                    className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-medium transition cursor-pointer ${
                                                        selectedTag === tag
                                                            ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400'
                                                            : 'bg-slate-950 border-slate-900 text-slate-500 hover:text-slate-300'
                                                    }`}
                                                >
                                                    {tag}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Right Header Actions */}
                                <div className="flex items-center space-x-2 shrink-0">
                                    {/* Standard "Open in New Tab" helpful link if running inside iframe */}
                                    {isRunningInIframe() && (
                                        <a
                                            href={window.location.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 border border-slate-900 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-slate-200 text-xs flex items-center space-x-1 transition hidden md:flex"
                                            title="Run app in a top-level tab to use actual FaceID/TouchID biometrics"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            <span className="font-medium">Open in Tab</span>
                                        </a>
                                    )}

                                    <button
                                        id="add-api-key-header-button"
                                        onClick={handleAddKeyClick}
                                        className="p-2 sm:px-3.5 sm:py-1.5 bg-indigo-500 hover:bg-indigo-600 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center sm:space-x-1.5 transition cursor-pointer shadow-lg shadow-indigo-500/10 shrink-0"
                                        title="Add API Key Entry"
                                    >
                                        <Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5 stroke-[2.5]" />
                                        <span className="hidden sm:inline">Add Key</span>
                                    </button>

                                    <button
                                        id="settings-header-button"
                                        onClick={() => setIsSettingsOpen(true)}
                                        className="p-2 sm:px-3 sm:py-1.5 border border-slate-800 bg-slate-900/60 text-xs rounded-lg text-slate-400 hover:text-indigo-400 hover:border-indigo-500/30 flex items-center justify-center sm:space-x-1.5 transition cursor-pointer shrink-0"
                                        title="安全与系统设置"
                                    >
                                        <Settings className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-indigo-400" />
                                        <span className="hidden sm:inline">系统设置</span>
                                    </button>

                                    {masterKey ? (
                                        <button
                                            id="lock-vault-header-button"
                                            onClick={handleLock}
                                            className="p-2 sm:px-3 sm:py-1.5 border border-slate-800 bg-slate-900/60 text-xs rounded-lg text-slate-400 hover:text-rose-400 flex items-center justify-center sm:space-x-1.5 transition cursor-pointer shrink-0"
                                            title="Lock API Keys (Purge RAM)"
                                        >
                                            <Lock className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-rose-500" />
                                            <span className="hidden sm:inline">Lock Keys</span>
                                        </button>
                                    ) : (
                                        <button
                                            id="unlock-vault-header-button"
                                            onClick={() => {
                                                setPendingAction(null);
                                                setShowUnlockModal(true);
                                            }}
                                            className="p-2 sm:px-3 sm:py-1.5 border border-indigo-500/30 bg-indigo-500/10 text-xs rounded-lg text-indigo-400 hover:text-indigo-300 flex items-center justify-center sm:space-x-1.5 transition cursor-pointer animate-pulse shrink-0"
                                            title="Unlock API Keys with PIN/Biometrics"
                                        >
                                            <Unlock className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-indigo-400" />
                                            <span className="hidden sm:inline">Unlock Keys</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Mobile-only Search and Filters */}
                            <div className="mt-3 space-y-2 sm:hidden max-w-7xl mx-auto">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
                                    <input
                                        id="mobile-search-keys-input"
                                        type="text"
                                        placeholder="Search labels, keys, descriptions..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-900 rounded-lg text-xs text-slate-300 placeholder-slate-600 focus:outline-none"
                                    />
                                </div>
                                {uniqueTags.length > 1 && (
                                    <div className="flex space-x-1 overflow-x-auto pb-1 max-w-full">
                                        {uniqueTags.map(tag => (
                                            <button
                                                id={`mobile-tag-filter-${tag}`}
                                                key={tag}
                                                onClick={() => setSelectedTag(tag)}
                                                className={`px-2.5 py-1 rounded-lg border text-[10px] font-medium shrink-0 cursor-pointer ${
                                                    selectedTag === tag
                                                        ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400'
                                                        : 'bg-slate-950 border-slate-900 text-slate-500'
                                                }`}
                                            >
                                                {tag}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </header>

                        {/* Main Workspace */}
                        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 z-10">
                            {/* Info Tips Banner if biometrics used in simulator */}
                            {metadata?.hasWebAuthn && isRunningInIframe() && (
                                <div className="mb-6 p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-xl flex items-start space-x-2.5">
                                    <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-semibold text-slate-300">
                                            Biometric Authentication Note
                                        </p>
                                        <p className="text-[10px] text-slate-500 leading-relaxed">
                                            You are using the simulated biometrics wallet. Opening this page in a
                                            <a
                                                href={window.location.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-indigo-400 hover:underline inline-flex items-center mx-1 font-semibold"
                                            >
                                                new tab <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                                            </a>
                                            enables native browser WebAuthn support directly tied to your machine's
                                            fingerprint/face sensors.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {filteredItems.length === 0 ? (
                                /* Gorgeous empty state */
                                <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-slate-900 rounded-2xl bg-slate-950/40 px-4">
                                    <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 mb-4 shadow-inner">
                                        <FolderOpen className="w-8 h-8 text-slate-500" />
                                    </div>
                                    <h3 className="text-base font-semibold text-slate-300">
                                        {searchQuery ? 'No results match your search' : 'Your Secure Wallet is Empty'}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1.5 max-w-sm leading-relaxed">
                                        {searchQuery
                                            ? 'Try double-checking your spelling or searching by tag or sub-key values.'
                                            : 'Store and protect key-value combinations. Add a label, optional tags, multi-row secrets, and custom instructions.'}
                                    </p>
                                    {!searchQuery && (
                                        <button
                                            id="empty-state-add-button"
                                            onClick={handleAddKeyClick}
                                            className="mt-5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-slate-950 font-bold rounded-lg text-xs flex items-center space-x-1.5 transition cursor-pointer"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>Add First API Key</span>
                                        </button>
                                    )}
                                </div>
                            ) : (
                                /* Cards Grid */
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {filteredItems.map(item => (
                                        <ApiKeyCard
                                            key={item.id}
                                            item={item}
                                            onEdit={handleEditClick}
                                            onDelete={handleDeleteItem}
                                            isUnlocked={!!masterKey}
                                            revealedKeys={revealedKeys}
                                            copiedKeyId={copiedKeyId}
                                            onToggleReveal={handleToggleReveal}
                                            onCopyKey={handleCopyKey}
                                        />
                                    ))}
                                </div>
                            )}
                        </main>

                        {/* API Key Modal Form Overlay */}
                        <ApiKeyForm
                            isOpen={isFormOpen}
                            onClose={() => setIsFormOpen(false)}
                            onSave={handleSaveForm}
                            existingItems={items}
                            editItem={editItem}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* On-demand authentication modal */}
            {showUnlockModal && metadata && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="relative w-full max-w-md">
                        <VaultUnlock
                            metadata={metadata}
                            onUnlock={handleUnlockOnDemand}
                            onReset={handleReset}
                            isModal={true}
                            onClose={() => {
                                setShowUnlockModal(false);
                                setPendingAction(null);
                            }}
                        />
                    </div>
                </div>
            )}

            {/* System Settings Modal */}
            <AnimatePresence>
                {isSettingsOpen && (
                    <VaultSettings
                        isOpen={isSettingsOpen}
                        onClose={() => setIsSettingsOpen(false)}
                        lockBehavior={lockBehavior}
                        onLockBehaviorChange={handleLockBehaviorChange}
                        swRegistration={swRegistration}
                        updateAvailable={updateAvailable}
                        onManualUpgrade={handleManualUpgrade}
                        onReset={handleReset}
                    />
                )}
            </AnimatePresence>

            {/* Conscious Update Toast Prompt */}
            <AnimatePresence>
                {updateAvailable && (
                    <motion.div
                        id="pwa-update-toast"
                        initial={{opacity: 0, y: 50, scale: 0.9}}
                        animate={{opacity: 1, y: 0, scale: 1}}
                        exit={{opacity: 0, y: 30, scale: 0.95}}
                        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 bg-slate-900 border border-indigo-500/30 p-4 rounded-xl shadow-2xl z-50 flex flex-col space-y-3"
                    >
                        <div className="flex items-start space-x-3">
                            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg shrink-0">
                                <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                            </div>
                            <div className="space-y-1 text-left">
                                <h4 className="text-xs font-bold text-slate-100 flex items-center space-x-1.5">
                                    <span>新版本已就绪！</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                                </h4>
                                <p className="text-[10px] text-slate-400 leading-normal">
                                    系统检测到全新的升级资源。点击升级立即启用，
                                    <strong>您的本地数据库密钥完全不受影响</strong>，100% 安全。
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2 pl-11">
                            <button
                                id="toast-upgrade-button"
                                onClick={handleManualUpgrade}
                                className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-slate-950 text-[10px] font-bold rounded-lg transition cursor-pointer flex items-center space-x-1 shadow-md shadow-indigo-500/10"
                            >
                                <CheckCircle className="w-3.5 h-3.5 text-slate-950" />
                                <span>立即升级</span>
                            </button>
                            <button
                                id="toast-dismiss-button"
                                onClick={() => setUpdateAvailable(false)}
                                className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-850 text-slate-400 text-[10px] font-semibold rounded-lg transition cursor-pointer"
                            >
                                稍后再说
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
