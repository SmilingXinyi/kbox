import {useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {AlertTriangle, Fingerprint, Tag, Timer, X} from 'lucide-react';
import type {LockBehavior, VaultMetadata} from '../../types/vault';

type VaultSettingsProps = {
    isOpen: boolean;
    onClose: () => void;
    lockBehavior: LockBehavior;
    onLockBehaviorChange: (behavior: LockBehavior) => void;
    commonTags: string[];
    onCommonTagsChange: (tags: string[]) => void;
    metadata: VaultMetadata | null;
    onReset: () => Promise<void>;
};

const LOCK_OPTIONS: {value: LockBehavior; label: string; hint: string}[] = [
    {value: 'always', label: 'Always', hint: 'Lock after ~5s of idle'},
    {value: 'delay-30s', label: '30 seconds', hint: 'Lock after 30s idle'},
    {value: 'delay-1m', label: '1 minute', hint: 'Lock after 1 minute idle'},
    {value: 'delay-5m', label: '5 minutes', hint: 'Lock after 5 minutes idle'},
    {value: 'once', label: 'Only manually', hint: 'Never auto-lock from idle'}
];

export default function VaultSettings({
    isOpen,
    onClose,
    lockBehavior,
    onLockBehaviorChange,
    commonTags,
    onCommonTagsChange,
    metadata,
    onReset
}: VaultSettingsProps) {
    const [newTag, setNewTag] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    const handleReset = async () => {
        const confirmed = window.confirm('This permanently deletes all encrypted keys on this device. Continue?');
        if (!confirmed) return;

        const typed = window.prompt('Type RESET to confirm:');
        if (typed !== 'RESET') return;

        await onReset();
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <motion.button
                        type="button"
                        aria-label="Close settings backdrop"
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        exit={{opacity: 0}}
                        className="absolute inset-0 bg-surface-950/80 backdrop-blur-sm cursor-pointer"
                        onClick={onClose}
                    />
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="vault-settings-title"
                        initial={{opacity: 0, y: 24}}
                        animate={{opacity: 1, y: 0}}
                        exit={{opacity: 0, y: 16}}
                        className="relative w-full sm:max-w-md max-h-[92dvh] overflow-y-auto bg-surface-900 border border-surface-700 rounded-t-2xl sm:rounded-2xl p-5 sm:p-6"
                    >
                        <div className="flex items-start justify-between mb-5">
                            <h2 id="vault-settings-title" className="text-lg font-semibold text-surface-100">
                                Settings
                            </h2>
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-1.5 text-surface-400 hover:text-surface-100 hover:bg-surface-800 rounded-lg cursor-pointer"
                                aria-label="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <section className="space-y-3 mb-6">
                            <div className="flex items-center gap-2 text-sm font-medium text-surface-100">
                                <Timer className="w-4 h-4 text-accent" />
                                <h3>Auto-lock</h3>
                            </div>
                            <div className="space-y-2">
                                {LOCK_OPTIONS.map(option => (
                                    <label
                                        key={option.value}
                                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                                            lockBehavior === option.value
                                                ? 'border-accent/40 bg-accent-muted'
                                                : 'border-surface-700 hover:border-surface-600'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="lock-behavior"
                                            value={option.value}
                                            checked={lockBehavior === option.value}
                                            onChange={() => onLockBehaviorChange(option.value)}
                                            className="mt-1 accent-[var(--color-accent)]"
                                        />
                                        <span>
                                            <span className="block text-sm text-surface-100">{option.label}</span>
                                            <span className="block text-[11px] text-surface-400 mt-0.5">
                                                {option.hint}
                                            </span>
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </section>

                        <section className="space-y-3 mb-6">
                            <div className="flex items-center gap-2 text-sm font-medium text-surface-100">
                                <Tag className="w-4 h-4 text-accent" />
                                <h3>Common Tags</h3>
                            </div>
                            <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-surface-700 bg-surface-950/50">
                                {commonTags.map(tag => (
                                    <span
                                        key={tag}
                                        className="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-surface-800 border border-surface-700 text-surface-200 rounded-md"
                                    >
                                        {tag}
                                        <button
                                            type="button"
                                            onClick={() => onCommonTagsChange(commonTags.filter(t => t !== tag))}
                                            className="text-surface-500 hover:text-danger cursor-pointer"
                                            aria-label={`Remove ${tag}`}
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                                {commonTags.length === 0 && (
                                    <span className="text-xs text-surface-500">No common tags configured.</span>
                                )}
                            </div>
                            <form
                                onSubmit={e => {
                                    e.preventDefault();
                                    const trimmed = newTag.trim();
                                    if (trimmed && !commonTags.includes(trimmed)) {
                                        onCommonTagsChange([...commonTags, trimmed]);
                                        setNewTag('');
                                    }
                                }}
                                className="flex gap-2"
                            >
                                <input
                                    type="text"
                                    value={newTag}
                                    onChange={e => setNewTag(e.target.value)}
                                    placeholder="Add new tag…"
                                    className="flex-1 px-3 py-1.5 bg-surface-900 border border-surface-700 rounded-lg text-xs text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-accent transition"
                                />
                                <button
                                    type="submit"
                                    disabled={!newTag.trim() || commonTags.includes(newTag.trim())}
                                    className="px-3 py-1.5 bg-accent hover:bg-accent-dim text-surface-950 text-xs font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition"
                                >
                                    Add
                                </button>
                            </form>
                        </section>

                        <section className="space-y-2 mb-6 p-3 rounded-lg border border-surface-700 bg-surface-950">
                            <div className="flex items-center gap-2 text-xs text-surface-300">
                                <Fingerprint className="w-3.5 h-3.5 text-accent" />
                                <span>Biometrics: {metadata?.hasWebAuthn ? 'Enabled' : 'Not enabled'}</span>
                            </div>
                        </section>

                        <section className="space-y-3 pt-4 border-t border-surface-700">
                            <div className="flex items-center gap-2 text-sm font-medium text-danger">
                                <AlertTriangle className="w-4 h-4" />
                                <h3>Danger zone</h3>
                            </div>
                            <p className="text-[11px] text-surface-400 leading-relaxed">
                                Reset permanently deletes all encrypted keys on this device. This cannot be undone.
                            </p>
                            <button
                                type="button"
                                onClick={() => void handleReset()}
                                className="w-full py-2.5 bg-danger-muted border border-danger/30 text-danger rounded-lg text-sm cursor-pointer hover:bg-danger/20 transition"
                            >
                                Reset vault…
                            </button>
                        </section>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
