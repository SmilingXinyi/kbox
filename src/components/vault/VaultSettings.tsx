import {useState} from 'react';
import {Fingerprint, Tag, Timer, X} from 'lucide-react';
import type {ApiKeyItem, LockBehavior, VaultMetadata} from '../../types/vault';
import {APP_VERSION} from '../../lib/appVersion';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import {VaultBackupExport} from './VaultBackup';

type VaultSettingsProps = {
    isOpen: boolean;
    onClose: () => void;
    lockBehavior: LockBehavior;
    onLockBehaviorChange: (behavior: LockBehavior) => void;
    commonTags: string[];
    onCommonTagsChange: (tags: string[]) => void;
    metadata: VaultMetadata | null;
    masterKey: string | null;
    items: ApiKeyItem[];
    onRequestUnlock: () => void;
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
    masterKey,
    items,
    onRequestUnlock,
    onReset
}: VaultSettingsProps) {
    const [newTag, setNewTag] = useState('');

    const handleReset = async () => {
        const confirmed = window.confirm('This permanently deletes all encrypted keys on this device. Continue?');
        if (!confirmed) return;

        const typed = window.prompt('Type RESET to confirm:');
        if (typed !== 'RESET') return;

        await onReset();
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Settings">
            {masterKey ? (
                <VaultBackupExport
                    masterKeyHex={masterKey}
                    items={items}
                    lockBehavior={lockBehavior}
                    commonTags={commonTags}
                />
            ) : (
                <section className="space-y-3 mb-6">
                    <Alert tone="info">
                        Unlock the vault to export an encrypted recovery file for account recovery.
                    </Alert>
                    <Button variant="secondary" fullWidth onClick={onRequestUnlock}>
                        Unlock to export recovery file
                    </Button>
                </section>
            )}

            <section className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm font-medium text-surface-100">
                    <Timer className="w-4 h-4 text-accent" aria-hidden />
                    <h3>Auto-lock</h3>
                </div>
                <div className="space-y-2" role="radiogroup" aria-label="Auto-lock timing">
                    {LOCK_OPTIONS.map(option => {
                        const selected = lockBehavior === option.value;
                        return (
                            <label
                                key={option.value}
                                className={`flex items-start gap-3 p-3 min-h-11 rounded-lg border cursor-pointer pressable transition ${
                                    selected
                                        ? 'border-accent/45 bg-accent-muted'
                                        : 'border-surface-700 hover:border-surface-600'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="lock-behavior"
                                    value={option.value}
                                    checked={selected}
                                    onChange={() => onLockBehaviorChange(option.value)}
                                    className="mt-1 accent-[var(--color-accent)]"
                                />
                                <span>
                                    <span className="block text-sm text-surface-100">{option.label}</span>
                                    <span className="block text-[11px] text-surface-400 mt-0.5">{option.hint}</span>
                                </span>
                            </label>
                        );
                    })}
                </div>
            </section>

            <section className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm font-medium text-surface-100">
                    <Tag className="w-4 h-4 text-accent" aria-hidden />
                    <h3>Common tags</h3>
                </div>
                <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-surface-700 bg-surface-950/50">
                    {commonTags.map(tag => (
                        <span
                            key={tag}
                            className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 text-xs bg-surface-800 border border-surface-700 text-surface-200 rounded-md"
                        >
                            {tag}
                            <button
                                type="button"
                                onClick={() => onCommonTagsChange(commonTags.filter(t => t !== tag))}
                                className="p-1.5 min-h-8 min-w-8 inline-flex items-center justify-center text-surface-500 hover:text-danger cursor-pointer pressable"
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
                    className="flex flex-col sm:flex-row gap-2"
                >
                    <input
                        type="text"
                        value={newTag}
                        onChange={e => setNewTag(e.target.value)}
                        placeholder="Add new tag…"
                        className="flex-1 min-h-11 px-3 py-2 bg-surface-950 border border-surface-700 rounded-lg text-base text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-accent transition"
                    />
                    <Button
                        type="submit"
                        size="md"
                        disabled={!newTag.trim() || commonTags.includes(newTag.trim())}
                        className="sm:w-auto"
                    >
                        Add
                    </Button>
                </form>
            </section>

            <section className="mb-6 p-3 rounded-lg border border-surface-700 bg-surface-950">
                <div className="flex items-center gap-2 text-xs text-surface-300">
                    <Fingerprint className="w-3.5 h-3.5 text-accent" aria-hidden />
                    <span>Biometrics: {metadata?.hasWebAuthn ? 'Enabled' : 'Not enabled'}</span>
                </div>
            </section>

            <section className="space-y-3 pt-4 border-t border-surface-700">
                <Alert tone="error">
                    <p className="font-medium mb-1">Danger zone</p>
                    <p className="text-danger/90">
                        Reset permanently deletes all encrypted keys on this device. This cannot be undone.
                    </p>
                </Alert>
                <Button variant="danger" fullWidth onClick={() => void handleReset()}>
                    Reset vault…
                </Button>
            </section>

            <p className="mt-6 text-center text-[10px] font-mono tracking-wide text-surface-500">
                Version {APP_VERSION}
            </p>
        </Modal>
    );
}
