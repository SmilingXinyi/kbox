import {useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {CheckCircle, RefreshCw, Search, Sparkles} from 'lucide-react';
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
import VaultHeader from '../components/vault/VaultHeader';
import VaultEmptyState from '../components/vault/VaultEmptyState';
import VaultMobileDock from '../components/vault/VaultMobileDock';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';

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

    const showDashboard = vault.vaultState === 'unlocked';

    return (
        <div className="min-h-dvh bg-surface-950 text-surface-100 flex flex-col font-sans antialiased relative">
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_color-mix(in_srgb,var(--color-accent)_8%,transparent),_transparent_55%)]" />
                <div
                    className="absolute inset-0 opacity-[0.035]"
                    style={{
                        backgroundImage:
                            'linear-gradient(rgba(245,196,0,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(245,196,0,0.5) 1px, transparent 1px)',
                        backgroundSize: '48px 48px'
                    }}
                />
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
                            <RefreshCw className="w-7 h-7 text-accent animate-spin" aria-hidden />
                            <span className="text-xs text-surface-400 font-mono tracking-wider">Loading vault…</span>
                        </motion.div>
                    )}

                    {vault.vaultState === 'uninitialized' && (
                        <motion.div key="setup" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}>
                            <VaultSetup onInitialized={vault.completeSetup} />
                        </motion.div>
                    )}

                    {showDashboard && (
                        <motion.div
                            key="dashboard"
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            exit={{opacity: 0}}
                            className="flex-1 flex flex-col pb-24 sm:pb-0"
                        >
                            <VaultHeader
                                isUnlocked={!!vault.masterKey}
                                isViewOnly={vault.isViewOnly}
                                syncActive={sync.isActive}
                                onLock={() => void vault.lock()}
                                onUnlock={() => vault.setShowUnlockModal(true)}
                                onOpenSync={() => setIsSyncOpen(true)}
                                onOpenSettings={() => setIsSettingsOpen(true)}
                                onAdd={openAddForm}
                            />

                            <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-5 sm:py-6 space-y-4 sm:space-y-5">
                                {vault.error && (
                                    <Alert
                                        tone="error"
                                        action={
                                            <button
                                                type="button"
                                                onClick={vault.clearError}
                                                className="underline cursor-pointer pressable"
                                            >
                                                Dismiss
                                            </button>
                                        }
                                    >
                                        {vault.error}
                                    </Alert>
                                )}

                                <div className="relative">
                                    <Search
                                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none"
                                        aria-hidden
                                    />
                                    <input
                                        type="search"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Search labels, tags, descriptions…"
                                        aria-label="Search vault"
                                        className="w-full min-h-11 pl-9 pr-3 py-2.5 bg-surface-900 border border-surface-700 rounded-lg text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-accent transition"
                                    />
                                </div>

                                {uniqueTags.length > 1 && (
                                    <div
                                        className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin"
                                        role="tablist"
                                        aria-label="Filter by tag"
                                    >
                                        {uniqueTags.map(tag => {
                                            const selected = selectedTag === tag;
                                            return (
                                                <button
                                                    key={tag}
                                                    type="button"
                                                    role="tab"
                                                    aria-selected={selected}
                                                    onClick={() => setSelectedTag(tag)}
                                                    className={`shrink-0 min-h-9 px-3 py-1.5 text-xs rounded-md border cursor-pointer pressable transition ${
                                                        selected
                                                            ? 'bg-accent text-on-accent border-accent font-medium'
                                                            : 'border-surface-700 text-surface-400 hover:border-surface-600 hover:text-surface-200'
                                                    }`}
                                                >
                                                    {tag}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {vault.items.length === 0 ? (
                                    <VaultEmptyState onAdd={openAddForm} />
                                ) : filteredItems.length === 0 ? (
                                    <div className="py-14 text-center text-sm text-surface-400">
                                        No keys match your search or filter.
                                    </div>
                                ) : (
                                    <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
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

                            <VaultMobileDock
                                syncActive={sync.isActive}
                                onOpenSync={() => setIsSyncOpen(true)}
                                onOpenSettings={() => setIsSettingsOpen(true)}
                                onAdd={openAddForm}
                            />
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
                        initial={{opacity: 0, y: 24, scale: 0.96}}
                        animate={{opacity: 1, y: 0, scale: 1}}
                        exit={{opacity: 0, y: 16, scale: 0.97}}
                        transition={{duration: 0.25, ease: [0.23, 1, 0.32, 1]}}
                        className="fixed bottom-[5.5rem] sm:bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 bg-surface-900 border border-accent/35 p-4 rounded-xl z-50 flex flex-col gap-3 shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
                    >
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-accent-muted border border-accent/25 text-accent rounded-lg shrink-0">
                                <Sparkles className="w-4 h-4" aria-hidden />
                            </div>
                            <div className="space-y-1 text-left">
                                <h4 className="text-xs font-semibold text-surface-100">New version ready</h4>
                                <p className="text-[11px] text-surface-400 leading-relaxed">
                                    Upgrade now for the latest improvements. Your encrypted vault stays on this device.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 pl-11">
                            <Button size="sm" onClick={pwa.upgrade}>
                                <CheckCircle className="w-3.5 h-3.5" aria-hidden />
                                Upgrade
                            </Button>
                            <Button size="sm" variant="ghost" onClick={pwa.dismissUpdate}>
                                Not now
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
