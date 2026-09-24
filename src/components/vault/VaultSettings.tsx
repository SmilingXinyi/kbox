import {useState} from 'react';
import {AlertTriangle, Cloud, Fingerprint, Shield, Tag, Timer, X} from 'lucide-react';
import type {ApiKeyItem, LockBehavior, VaultMetadata} from '../../types/vault';
import type {UseCloudSyncReturn} from '../../hooks/useCloudSync';
import {APP_VERSION} from '../../lib/appVersion';
import {isRunningInIframe, isWebAuthnSupported} from '../../lib/webauthn';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import {VaultBackupExport} from './VaultBackup';
import VaultCloudSync from './VaultCloudSync';

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
    onEnrollWebAuthn: () => Promise<void>;
    onReset: () => Promise<void>;
    cloud: UseCloudSyncReturn;
};

type SettingsSectionId = 'recovery' | 'drive' | 'lock' | 'tags' | 'biometrics' | 'danger';

const LOCK_OPTIONS: {value: LockBehavior; label: string; hint: string}[] = [
    {value: 'always', label: 'Always', hint: 'Lock after ~5s of idle'},
    {value: 'delay-30s', label: '30 seconds', hint: 'Lock after 30s idle'},
    {value: 'delay-1m', label: '1 minute', hint: 'Lock after 1 minute idle'},
    {value: 'delay-5m', label: '5 minutes', hint: 'Lock after 5 minutes idle'},
    {value: 'once', label: 'Only manually', hint: 'Never auto-lock from idle'}
];

const SETTINGS_NAV: {id: SettingsSectionId; label: string; icon: typeof Shield; danger?: boolean}[] = [
    {id: 'recovery', label: 'Recovery', icon: Shield},
    {id: 'drive', label: 'Google Drive', icon: Cloud},
    {id: 'lock', label: 'Auto-lock', icon: Timer},
    {id: 'tags', label: 'Tags', icon: Tag},
    {id: 'biometrics', label: 'Face ID', icon: Fingerprint},
    {id: 'danger', label: 'Reset', icon: AlertTriangle, danger: true}
];

function paneClass(id: SettingsSectionId, active: SettingsSectionId): string {
    return id === active ? 'block' : 'block md:hidden';
}

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
    onEnrollWebAuthn,
    onReset,
    cloud
}: VaultSettingsProps) {
    const [activeSection, setActiveSection] = useState<SettingsSectionId>('recovery');
    const [newTag, setNewTag] = useState('');
    const [bioError, setBioError] = useState<string | null>(null);
    const [bioLoading, setBioLoading] = useState(false);
    const canEnrollBiometrics = isWebAuthnSupported() && !isRunningInIframe();

    const handleClose = () => {
        setActiveSection('recovery');
        setBioError(null);
        onClose();
    };

    const handleReset = async () => {
        const confirmed = window.confirm(
            'This permanently deletes all encrypted keys on this device and disconnects Google Drive in this browser. Continue?'
        );
        if (!confirmed) return;

        const typed = window.prompt('Type RESET to confirm:');
        if (typed !== 'RESET') return;

        await onReset();
        handleClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Settings"
            description="Vault, backup, and this device."
            size="xl"
            padded={false}
        >
            <div className="flex flex-1 min-h-0 flex-col md:flex-row">
                <nav
                    aria-label="Settings sections"
                    className="hidden md:flex w-52 shrink-0 flex-col gap-1 border-r border-surface-800 bg-surface-950/40 p-3"
                >
                    {SETTINGS_NAV.map(item => {
                        const Icon = item.icon;
                        const selected = activeSection === item.id;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                aria-current={selected ? 'page' : undefined}
                                onClick={() => setActiveSection(item.id)}
                                className={`flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm pressable cursor-pointer ${
                                    selected
                                        ? item.danger
                                            ? 'bg-danger-muted text-danger'
                                            : 'bg-accent-muted text-surface-100'
                                        : item.danger
                                          ? 'text-danger/80 hover:bg-danger-muted hover:text-danger'
                                          : 'text-surface-400 hover:bg-surface-800 hover:text-surface-100'
                                }`}
                            >
                                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                                {item.label}
                            </button>
                        );
                    })}
                    <p className="mt-auto px-3 pt-4 text-[10px] font-mono tracking-wide text-surface-500">
                        Version {APP_VERSION}
                    </p>
                </nav>

                <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain scrollbar-none sheet-scroll">
                    <div className="px-5 sm:px-6 pt-4 sm:pt-5 safe-pb md:max-w-3xl">
                        <div className={paneClass('recovery', activeSection)}>
                            {masterKey ? (
                                <VaultBackupExport
                                    masterKeyHex={masterKey}
                                    items={items}
                                    lockBehavior={lockBehavior}
                                    commonTags={commonTags}
                                />
                            ) : (
                                <section className="space-y-3 mb-6 md:mb-0">
                                    <div className="flex items-center gap-2 text-sm font-medium text-surface-100">
                                        <Shield className="w-4 h-4 text-accent" aria-hidden />
                                        <h3>Account recovery</h3>
                                    </div>
                                    <Alert tone="info">
                                        Unlock the vault to export an encrypted recovery file for account recovery.
                                    </Alert>
                                    <Button
                                        variant="secondary"
                                        fullWidth
                                        className="md:w-auto"
                                        onClick={onRequestUnlock}
                                    >
                                        Unlock to export recovery file
                                    </Button>
                                </section>
                            )}
                        </div>

                        <div className={paneClass('drive', activeSection)}>
                            <VaultCloudSync cloud={cloud} isUnlocked={!!masterKey} />
                        </div>

                        <section className={`space-y-3 mb-6 md:mb-0 ${paneClass('lock', activeSection)}`}>
                            <div className="flex items-center gap-2 text-sm font-medium text-surface-100">
                                <Timer className="w-4 h-4 text-accent" aria-hidden />
                                <h3>Auto-lock</h3>
                            </div>
                            <div
                                className="grid grid-cols-1 md:grid-cols-2 gap-2"
                                role="radiogroup"
                                aria-label="Auto-lock timing"
                            >
                                {LOCK_OPTIONS.map(option => {
                                    const selected = lockBehavior === option.value;
                                    return (
                                        <label
                                            key={option.value}
                                            className={`flex items-start gap-3 p-3 min-h-11 rounded-lg border cursor-pointer pressable transition ${
                                                option.value === 'once' ? 'md:col-span-2' : ''
                                            } ${
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
                                                <span className="block text-[11px] text-surface-400 mt-0.5">
                                                    {option.hint}
                                                </span>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </section>

                        <section className={`space-y-3 mb-6 md:mb-0 ${paneClass('tags', activeSection)}`}>
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
                                className="flex flex-col sm:flex-row gap-2 md:max-w-md"
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

                        <section className={`space-y-3 mb-6 md:mb-0 ${paneClass('biometrics', activeSection)}`}>
                            <div className="flex items-center gap-2 text-sm font-medium text-surface-100">
                                <Fingerprint className="w-4 h-4 text-accent" aria-hidden />
                                <h3>Face ID / Touch ID</h3>
                            </div>
                            <p className="text-[11px] text-surface-400 leading-relaxed max-w-prose">
                                Biometrics stay on this device. A Drive restore or recovery file does not bring Face ID
                                with it — enroll again here after moving the vault.
                            </p>
                            <p className="text-xs text-surface-300">
                                Status: {metadata?.hasWebAuthn ? 'Enabled on this device' : 'Not enabled'}
                            </p>
                            {bioError && (
                                <Alert
                                    tone="error"
                                    action={
                                        <button
                                            type="button"
                                            className="underline cursor-pointer pressable"
                                            onClick={() => setBioError(null)}
                                        >
                                            Dismiss
                                        </button>
                                    }
                                >
                                    {bioError}
                                </Alert>
                            )}
                            {!masterKey ? (
                                <Button variant="secondary" fullWidth className="md:w-auto" onClick={onRequestUnlock}>
                                    Unlock to enroll Face ID / Touch ID
                                </Button>
                            ) : !canEnrollBiometrics ? (
                                <p className="text-[11px] text-surface-400">
                                    Native biometrics are unavailable here. Keep using your PIN on this device.
                                </p>
                            ) : (
                                <div className="md:max-w-md">
                                    <Button
                                        variant="secondary"
                                        fullWidth
                                        className="md:w-auto"
                                        disabled={bioLoading}
                                        onClick={() => {
                                            setBioError(null);
                                            setBioLoading(true);
                                            void onEnrollWebAuthn()
                                                .catch((err: unknown) => {
                                                    setBioError(
                                                        err instanceof Error
                                                            ? err.message
                                                            : 'Biometric enrollment failed.'
                                                    );
                                                })
                                                .finally(() => setBioLoading(false));
                                        }}
                                    >
                                        {bioLoading
                                            ? 'Waiting for authenticator…'
                                            : metadata?.hasWebAuthn
                                              ? 'Replace Face ID / Touch ID on this device'
                                              : 'Enable Face ID / Touch ID on this device'}
                                    </Button>
                                </div>
                            )}
                        </section>

                        <section
                            className={`space-y-3 pt-4 border-t border-surface-700 md:border-t-0 md:pt-0 ${paneClass('danger', activeSection)}`}
                        >
                            <div className="flex items-center gap-2 text-sm font-medium text-surface-100 md:hidden">
                                <AlertTriangle className="w-4 h-4 text-danger" aria-hidden />
                                <h3>Reset</h3>
                            </div>
                            <Alert tone="error">
                                <p className="font-medium mb-1">Danger zone</p>
                                <p className="text-danger/90">
                                    Reset permanently deletes all encrypted keys on this device and disconnects Google
                                    Drive in this browser. Files on Drive are unchanged. This cannot be undone.
                                </p>
                            </Alert>
                            <Button variant="danger" fullWidth className="md:w-auto" onClick={() => void handleReset()}>
                                Reset vault…
                            </Button>
                        </section>

                        <p className="mt-6 text-center text-[10px] font-mono tracking-wide text-surface-500 md:hidden">
                            Version {APP_VERSION}
                        </p>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
