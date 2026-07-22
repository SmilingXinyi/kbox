import {useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {
    CheckCircle,
    FolderOpen,
    Lock,
    Plus,
    Radio,
    RefreshCw,
    Search,
    Settings,
    ShieldAlert,
    Sparkles,
    Unlock
} from 'lucide-react';
import {useVault} from '../hooks/useVault';
import {usePWA} from '../hooks/usePWA';
import {useWebRTCSync} from '../hooks/useWebRTCSync';
import type {ApiKeyItem, ResidualUnlockResult} from '../types/vault';
import VaultSetup from '../components/vault/VaultSetup';
import VaultUnlock from '../components/vault/VaultUnlock';
import ApiKeyForm from '../components/vault/ApiKeyForm';
import ApiKeyCard from '../components/vault/ApiKeyCard';
import VaultSettings from '../components/vault/VaultSettings';
import VaultSync from '../components/vault/VaultSync';

export default function HomePage() {
    const vault = useVault();
    const pwa = usePWA();
    const sync = useWebRTCSync({
        localItems: vault.masterKey ? vault.items : [],
        onReplaceItems: vault.replaceAllItems
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTag, setSelectedTag] = useState('All');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editItem, setEditItem] = useState<ApiKeyItem | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSyncOpen, setIsSyncOpen] = useState(false);

    const handleResidualAction = (result: ResidualUnlockResult) => {
        const {action, items} = result;
        if (action.type === 'add') {
            setEditItem(null);
            setIsFormOpen(true);
            return;
        }
        if (action.type === 'edit' && action.itemId) {
            // Use the unlock-time decrypted snapshot — React state may still be stale.
            const item = items.find(i => i.id === action.itemId);
            if (item) {
                setEditItem(item);
                setIsFormOpen(true);
            }
        }
    };

    const uniqueTags = ['All', ...Array.from(new Set(vault.items.map(item => item.tag).filter(Boolean) as string[]))];

    const filteredItems = vault.items.filter(item => {
        const matchesTag = selectedTag === 'All' || item.tag === selectedTag;
        const term = searchQuery.toLowerCase().trim();
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

    const openAddForm = () => {
        if (!vault.requireMasterKey({type: 'add'})) return;
        setEditItem(null);
        setIsFormOpen(true);
    };

    const openEditForm = (item: ApiKeyItem) => {
        if (!vault.requireMasterKey({type: 'edit', itemId: item.id})) return;
        setEditItem(item);
        setIsFormOpen(true);
    };

    const handleSaveForm = async (item: ApiKeyItem) => {
        if (editItem) {
            await vault.updateItem(item);
        } else {
            await vault.addItem(item);
        }
    };

    return (
        <div className="min-h-dvh bg-surface-950 text-surface-100 flex flex-col font-sans antialiased relative">
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-40">
                <div className="absolute top-[-15%] left-[-10%] w-[55vw] h-[55vw] bg-accent/8 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[45vw] h-[45vw] bg-surface-600/20 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 flex-1 flex flex-col">
                <AnimatePresence mode="wait">
                    {vault.vaultState === 'loading' && (
                        <motion.div
                            key="loading"
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            exit={{opacity: 0}}
                            className="flex-1 flex flex-col items-center justify-center gap-4"
                        >
                            <RefreshCw className="w-8 h-8 text-accent animate-spin" />
                            <span className="text-xs text-surface-400 font-mono tracking-wider">Loading vault…</span>
                        </motion.div>
                    )}

                    {vault.vaultState === 'uninitialized' && (
                        <motion.div key="setup" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}>
                            <VaultSetup onInitialized={vault.completeSetup} />
                        </motion.div>
                    )}

                    {vault.vaultState === 'unlocked' && (
                        <motion.div
                            key="dashboard"
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            exit={{opacity: 0}}
                            className="flex-1 flex flex-col"
                        >
                            <header className="sticky top-0 z-20 border-b border-surface-800/80 bg-surface-950/85 backdrop-blur-md">
                                <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-xl font-semibold tracking-tight text-accent leading-none">
                                            kbox
                                        </p>
                                        <p className="text-[10px] text-surface-400 mt-1 truncate">
                                            {vault.isViewOnly
                                                ? 'Locked — secrets hidden; labels stay visible'
                                                : 'Vault unlocked'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {vault.masterKey ? (
                                            <button
                                                type="button"
                                                onClick={() => void vault.lock()}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-surface-300 hover:text-surface-100 hover:bg-surface-800 rounded-lg border border-surface-700 cursor-pointer transition"
                                            >
                                                <Lock className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">Lock</span>
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => vault.setShowUnlockModal(true)}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-accent hover:bg-accent-muted rounded-lg border border-accent/30 cursor-pointer transition"
                                            >
                                                <Unlock className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">Unlock</span>
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setIsSyncOpen(true)}
                                            className={`p-2 rounded-lg border cursor-pointer transition ${
                                                sync.isActive
                                                    ? 'text-accent border-accent/40 bg-accent-muted'
                                                    : 'text-surface-300 hover:text-surface-100 hover:bg-surface-800 border-surface-700'
                                            }`}
                                            aria-label="Device sync"
                                            title="Device sync"
                                        >
                                            <Radio className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsSettingsOpen(true)}
                                            className="p-2 text-surface-300 hover:text-surface-100 hover:bg-surface-800 rounded-lg border border-surface-700 cursor-pointer transition"
                                            aria-label="Settings"
                                        >
                                            <Settings className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={openAddForm}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent hover:bg-accent-dim text-surface-950 rounded-lg cursor-pointer transition"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>Add</span>
                                        </button>
                                    </div>
                                </div>
                            </header>

                            <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 space-y-5">
                                {vault.error && (
                                    <div className="flex items-start gap-2 p-3 rounded-lg border border-danger/30 bg-danger-muted text-danger text-xs">
                                        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <p>{vault.error}</p>
                                            <button
                                                type="button"
                                                onClick={vault.clearError}
                                                className="mt-1 underline cursor-pointer"
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-col sm:flex-row gap-3">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                                        <input
                                            type="search"
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            placeholder="Search labels, tags, descriptions…"
                                            className="w-full pl-9 pr-3 py-2 bg-surface-900 border border-surface-700 rounded-lg text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-accent transition"
                                        />
                                    </div>
                                </div>

                                {uniqueTags.length > 1 && (
                                    <div className="flex flex-wrap gap-2">
                                        {uniqueTags.map(tag => (
                                            <button
                                                key={tag}
                                                type="button"
                                                onClick={() => setSelectedTag(tag)}
                                                className={`px-2.5 py-1 text-[11px] rounded-md border cursor-pointer transition ${
                                                    selectedTag === tag
                                                        ? 'bg-accent-muted border-accent/40 text-accent'
                                                        : 'border-surface-700 text-surface-400 hover:border-surface-600'
                                                }`}
                                            >
                                                {tag}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {vault.items.length === 0 ? (
                                    <motion.div
                                        initial={{opacity: 0, y: 8}}
                                        animate={{opacity: 1, y: 0}}
                                        className="flex flex-col items-center justify-center py-20 text-center gap-3"
                                    >
                                        <FolderOpen className="w-10 h-10 text-surface-600" />
                                        <h2 className="text-base font-medium text-surface-100">No API keys yet</h2>
                                        <p className="text-sm text-surface-400 max-w-sm">
                                            Add your first API key to store it encrypted on this device.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={openAddForm}
                                            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-dim text-surface-950 rounded-lg cursor-pointer transition"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Add your first API key
                                        </button>
                                    </motion.div>
                                ) : filteredItems.length === 0 ? (
                                    <div className="py-16 text-center text-sm text-surface-400">
                                        No keys match your search or filter.
                                    </div>
                                ) : (
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <AnimatePresence mode="popLayout">
                                            {filteredItems.map(item => (
                                                <ApiKeyCard
                                                    key={item.id}
                                                    item={item}
                                                    onEdit={openEditForm}
                                                    onDelete={id => void vault.deleteItem(id)}
                                                    isUnlocked={!!vault.masterKey}
                                                    revealedKeys={vault.revealedKeys}
                                                    copiedKeyId={vault.copiedKeyId}
                                                    onToggleReveal={vault.requestReveal}
                                                    onCopyKey={(itemId, keyId) => void vault.requestCopy(itemId, keyId)}
                                                />
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </main>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {vault.showUnlockModal && vault.metadata && (
                <VaultUnlock
                    metadata={vault.metadata}
                    onUnlockWithPin={vault.unlockWithPin}
                    onUnlockWithWebAuthn={vault.unlockWithWebAuthn}
                    onClose={vault.cancelUnlockModal}
                    onResidualAction={handleResidualAction}
                />
            )}

            <ApiKeyForm
                isOpen={isFormOpen}
                onClose={() => {
                    setIsFormOpen(false);
                    setEditItem(null);
                }}
                onSave={handleSaveForm}
                existingItems={vault.items}
                commonTags={vault.commonTags}
                editItem={editItem}
            />

            <VaultSettings
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                lockBehavior={vault.lockBehavior}
                onLockBehaviorChange={vault.setLockBehavior}
                commonTags={vault.commonTags}
                onCommonTagsChange={vault.setCommonTags}
                metadata={vault.metadata}
                onReset={vault.resetVault}
            />

            <VaultSync
                isOpen={isSyncOpen}
                onClose={() => setIsSyncOpen(false)}
                sync={sync}
                isUnlocked={!!vault.masterKey}
                onRequestUnlock={() => vault.setShowUnlockModal(true)}
            />

            <AnimatePresence>
                {pwa.updateAvailable && (
                    <motion.div
                        initial={{opacity: 0, y: 50, scale: 0.9}}
                        animate={{opacity: 1, y: 0, scale: 1}}
                        exit={{opacity: 0, y: 30, scale: 0.95}}
                        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 bg-surface-900 border border-accent/30 p-4 rounded-xl shadow-2xl z-50 flex flex-col gap-3"
                    >
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-accent/10 border border-accent/20 text-accent rounded-lg shrink-0">
                                <Sparkles className="w-4 h-4 text-accent animate-pulse" />
                            </div>
                            <div className="space-y-1 text-left">
                                <h4 className="text-xs font-bold text-surface-100 flex items-center gap-1.5">
                                    <span>New version ready!</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
                                </h4>
                                <p className="text-[10px] text-surface-400 leading-normal">
                                    A system update is available. Upgrade now to get the latest security features and
                                    improvements. <strong>Your encrypted vault remains 100% safe.</strong>
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 pl-11">
                            <button
                                type="button"
                                onClick={pwa.upgrade}
                                className="px-3 py-1.5 bg-accent hover:bg-accent-dim text-surface-950 text-[10px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1 shadow-md shadow-accent/10"
                            >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Upgrade Now</span>
                            </button>
                            <button
                                type="button"
                                onClick={pwa.dismissUpdate}
                                className="px-3 py-1.5 bg-surface-950 hover:bg-surface-800 border border-surface-700 text-surface-400 text-[10px] font-semibold rounded-lg transition cursor-pointer"
                            >
                                Not now
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
