import {useState} from 'react';
import {Check, Cloud, CloudDownload, CloudUpload, Copy, Loader2, Unplug} from 'lucide-react';
import type {CloudProviderId} from '../../types/cloudSync';
import type {UseCloudSyncReturn} from '../../hooks/useCloudSync';
import {PIN_MAX_LENGTH, PIN_MIN_LENGTH} from '../../lib/crypto';
import {cloudOAuthJavaScriptOrigin} from '../../lib/cloudSync/config';
import {KBOX_GOOGLE_DRIVE_CLIENT_ID} from '../../lib/cloudSync/clientIds';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import TextField from '../ui/TextField';

type VaultCloudSyncProps = {
    cloud: UseCloudSyncReturn;
    variant?: 'settings' | 'setup';
    isUnlocked?: boolean;
};

const GOOGLE_DRIVE: CloudProviderId = 'google-drive';

function formatStamp(iso: string | null): string {
    if (!iso) return 'Never';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString();
}

function statusLabel(status: UseCloudSyncReturn['status']): string | null {
    if (status === 'connecting') return 'Waiting for authorization…';
    if (status === 'pulling') return 'Pulling vault…';
    if (status === 'pushing') return 'Pushing vault…';
    return null;
}

function CopyableValue({
    label,
    value,
    copied,
    onCopy
}: {
    label: string;
    value: string;
    copied: boolean;
    onCopy: () => void;
}) {
    return (
        <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-surface-400">{label}</p>
            <div className="flex items-center gap-1.5">
                <code className="flex-1 min-w-0 truncate rounded-md bg-surface-950 px-2 py-1.5 text-[11px] text-surface-300">
                    {value}
                </code>
                <button
                    type="button"
                    onClick={onCopy}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-surface-700 text-surface-300 hover:text-surface-100 hover:border-surface-500 cursor-pointer pressable"
                    aria-label={copied ? `${label} copied` : `Copy ${label}`}
                >
                    {copied ? (
                        <Check className="w-3.5 h-3.5 text-accent" aria-hidden />
                    ) : (
                        <Copy className="w-3.5 h-3.5" aria-hidden />
                    )}
                </button>
            </div>
        </div>
    );
}

export default function VaultCloudSync({cloud, variant = 'settings', isUnlocked = false}: VaultCloudSyncProps) {
    const [pin, setPin] = useState('');
    const [draftId, setDraftId] = useState('');
    const [openPanel, setOpenPanel] = useState(false);
    const [restoreOpen, setRestoreOpen] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [copiedField, setCopiedField] = useState<'origin' | null>(null);

    const busy = cloud.isBusy;
    const provider = cloud.providers.find(item => item.id === GOOGLE_DRIVE);
    const connected = cloud.session;
    const needsPin = !isUnlocked;
    const cloudVaultPin = pin.trim();
    const pinReady = cloudVaultPin.length >= PIN_MIN_LENGTH;
    const javascriptOrigin = cloudOAuthJavaScriptOrigin();

    const prepareClientId = (): boolean => {
        if (!provider) return false;
        const typedId = draftId.trim();
        if (provider.configured && !openPanel) return true;

        if (typedId) {
            cloud.saveClientId(GOOGLE_DRIVE, typedId);
            setOpenPanel(false);
            return true;
        }

        cloud.saveClientId(GOOGLE_DRIVE, '');
        setDraftId(KBOX_GOOGLE_DRIVE_CLIENT_ID);
        setOpenPanel(false);
        return true;
    };

    const handlePull = () => {
        setFormError(null);
        if (!prepareClientId()) return;
        void cloud.pull(GOOGLE_DRIVE, needsPin ? {pin: cloudVaultPin} : undefined).catch(() => {
            // Error is surfaced via cloud.error.
        });
    };

    const handleConnect = () => {
        setFormError(null);
        if (!prepareClientId()) return;
        void cloud.connect(GOOGLE_DRIVE).catch(() => {
            // Error is surfaced via cloud.error.
        });
    };

    const handlePush = () => {
        setFormError(null);
        if (!isUnlocked) {
            setFormError('Unlock the vault to push a copy to Google Drive.');
            return;
        }
        if (!prepareClientId()) return;
        void cloud.push().catch(() => {
            // Error is surfaced via cloud.error.
        });
    };

    const handleRestore = () => {
        setFormError(null);
        if (cloudVaultPin.length < PIN_MIN_LENGTH) {
            setFormError(`Enter the ${PIN_MIN_LENGTH}-${PIN_MAX_LENGTH} character cloud vault PIN to continue.`);
            return;
        }
        if (!prepareClientId()) return;
        if (!window.confirm('Restore the cloud vault? This replaces the vault currently stored on this device.'))
            return;

        void cloud
            .pull(GOOGLE_DRIVE, {pin: cloudVaultPin})
            .then(() => {
                setPin('');
                setRestoreOpen(false);
            })
            .catch(() => {
                // Error is surfaced via cloud.error.
            });
    };

    const handleCopyOrigin = async () => {
        try {
            await navigator.clipboard.writeText(javascriptOrigin);
            setCopiedField('origin');
            window.setTimeout(() => setCopiedField(current => (current === 'origin' ? null : current)), 1600);
        } catch (e) {
            console.error('Failed to copy OAuth URI:', e);
            setFormError('Could not copy to the clipboard.');
        }
    };

    return (
        <section className={`space-y-3 ${variant === 'settings' ? 'mb-6 md:mb-0' : 'mb-6'}`}>
            <div className="flex items-center gap-2 text-sm font-medium text-surface-100">
                <Cloud className="w-4 h-4 text-accent" aria-hidden />
                {variant === 'setup' ? (
                    <h1 className="font-display text-xl font-semibold tracking-tight">Pull from Google Drive</h1>
                ) : (
                    <h3>Google Drive</h3>
                )}
            </div>
            <p className="text-[11px] text-surface-400 leading-relaxed">
                {variant === 'setup'
                    ? 'Authorize Google Drive in this browser, then enter the cloud vault PIN to restore it. Recovery files stay local and are never uploaded. Face ID stays on each device — enroll it again after restore.'
                    : 'Optional encrypted backup. Push and pull manually, or turn on automatic sync. Recovery files are separate and never uploaded. Face ID is per device.'}
            </p>

            {(formError || cloud.error) && (
                <Alert
                    tone="error"
                    action={
                        <button
                            type="button"
                            onClick={() => {
                                setFormError(null);
                                cloud.clearError();
                            }}
                            className="underline cursor-pointer pressable"
                        >
                            Dismiss
                        </button>
                    }
                >
                    {formError || cloud.error}
                </Alert>
            )}

            {cloud.lastResult && !cloud.error && !formError && <Alert tone="success">{cloud.lastResult}</Alert>}

            {statusLabel(cloud.status) && (
                <p className="flex items-center gap-2 text-[11px] text-surface-300">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                    {statusLabel(cloud.status)}
                </p>
            )}

            {needsPin && (
                <TextField
                    label="Cloud vault PIN"
                    aria-label="Cloud vault PIN"
                    type="password"
                    inputMode="numeric"
                    autoComplete="current-password"
                    maxLength={PIN_MAX_LENGTH}
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                    placeholder="PIN used on the source device"
                    className="[&_input]:font-mono [&_input]:tracking-widest"
                />
            )}

            {variant === 'settings' && (
                <label className="flex items-start gap-3 p-3 min-h-11 rounded-lg border border-surface-700 cursor-pointer pressable">
                    <input
                        type="checkbox"
                        checked={cloud.autoSync}
                        onChange={e => cloud.setAutoSync(e.target.checked)}
                        className="mt-1 accent-[var(--color-accent)]"
                        aria-label="Automatic Google Drive sync"
                    />
                    <span>
                        <span className="block text-sm text-surface-100">Automatic sync</span>
                        <span className="block text-[11px] text-surface-400 mt-0.5">
                            Off by default. When on, key changes push after a short delay, and this browser pulls once
                            after unlock while Google is still authorized.
                        </span>
                    </span>
                </label>
            )}

            {variant === 'settings' && connected && (
                <div className="p-3 rounded-lg border border-surface-700 bg-surface-950/50 space-y-1.5">
                    <p className="text-xs text-surface-100">
                        Connected to Google Drive
                        {connected.accountLabel ? ` · ${connected.accountLabel}` : ''}
                    </p>
                    <p className="text-[11px] text-surface-400">Last push: {formatStamp(cloud.lastPushAt)}</p>
                    <p className="text-[11px] text-surface-400">Last pull: {formatStamp(cloud.lastPullAt)}</p>
                    <Button variant="ghost" size="sm" onClick={cloud.disconnect} disabled={busy} className="mt-1">
                        <Unplug className="w-3.5 h-3.5" aria-hidden />
                        Disconnect this device
                    </Button>
                </div>
            )}

            <article className="rounded-lg border border-surface-700 bg-surface-900/40 p-3 space-y-3">
                <div className="flex items-start gap-2.5">
                    <span
                        className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-800 text-[11px] font-semibold text-accent"
                        aria-hidden
                    >
                        G
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-medium text-surface-100">Google Drive</h4>
                            {provider?.configured ? (
                                <span className="text-[10px] uppercase tracking-wide text-accent">Ready</span>
                            ) : (
                                <span className="text-[10px] uppercase tracking-wide text-surface-400">Authorize</span>
                            )}
                        </div>
                        <p className="text-[11px] text-surface-400 leading-relaxed mt-0.5">
                            Authorize Google in a popup. Vault file stays in Drive app data.
                        </p>
                    </div>
                </div>

                {openPanel ? (
                    <div className="space-y-2.5">
                        <TextField
                            label="OAuth client ID"
                            aria-label="Google Drive OAuth client ID"
                            value={draftId}
                            onChange={e => setDraftId(e.target.value)}
                            placeholder="123456789-abc.apps.googleusercontent.com"
                            hint="Leave blank to use the kbox Google app, or paste your own Web client ID."
                            className="[&_input]:font-mono [&_input]:text-xs"
                        />
                        <details className="rounded-md border border-surface-700 bg-surface-950/60 px-3 py-2">
                            <summary className="cursor-pointer text-[11px] text-surface-300 pressable">
                                Registration URIs
                            </summary>
                            <div className="mt-2 space-y-2.5">
                                <p className="text-[11px] text-surface-400 leading-relaxed">
                                    Add the JavaScript origin to your{' '}
                                    <a
                                        href="https://console.cloud.google.com/apis/credentials"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-surface-200 underline underline-offset-2"
                                    >
                                        Google Cloud Console
                                    </a>{' '}
                                    Web client (Drive API).
                                </p>
                                <CopyableValue
                                    label="JavaScript origin"
                                    value={javascriptOrigin}
                                    copied={copiedField === 'origin'}
                                    onCopy={() => void handleCopyOrigin()}
                                />
                            </div>
                        </details>
                        <button
                            type="button"
                            onClick={() => {
                                cloud.saveClientId(GOOGLE_DRIVE, '');
                                setDraftId(KBOX_GOOGLE_DRIVE_CLIENT_ID);
                                setOpenPanel(false);
                                setFormError(null);
                            }}
                            className="text-[11px] text-surface-400 hover:text-surface-200 underline underline-offset-2 cursor-pointer pressable"
                        >
                            Use kbox Google app
                        </button>
                    </div>
                ) : provider?.configured ? (
                    <button
                        type="button"
                        onClick={() => {
                            setDraftId(draftId || provider.clientId);
                            setOpenPanel(true);
                        }}
                        className="text-[11px] text-surface-400 hover:text-surface-200 underline underline-offset-2 cursor-pointer pressable"
                    >
                        Change OAuth app
                    </button>
                ) : null}

                <div className={`grid gap-2 ${variant === 'settings' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                    {variant === 'settings' && (
                        <Button variant="secondary" onClick={handleConnect} disabled={busy}>
                            {connected ? 'Reconnect Google Drive' : 'Connect Google Drive'}
                        </Button>
                    )}
                    {variant === 'settings' && (
                        <Button variant="secondary" onClick={handlePush} disabled={busy || !isUnlocked}>
                            <CloudUpload className="w-3.5 h-3.5" aria-hidden />
                            Push to Google Drive
                        </Button>
                    )}
                    <Button
                        variant={variant === 'setup' ? 'primary' : 'secondary'}
                        onClick={handlePull}
                        disabled={busy || (needsPin && !pinReady)}
                        className={variant === 'settings' ? 'sm:col-span-2' : undefined}
                    >
                        <CloudDownload className="w-3.5 h-3.5" aria-hidden />
                        {variant === 'setup' ? 'Pull from Google Drive' : 'Pull updates from Google Drive'}
                    </Button>
                </div>

                {variant === 'settings' && (
                    <div className="border-t border-surface-700 pt-3">
                        {restoreOpen ? (
                            <div className="space-y-3">
                                <Alert tone="warn">
                                    Restoring replaces the vault currently stored on this device. Face ID is not in the
                                    cloud copy — enroll it again on this device after restore.
                                </Alert>
                                <TextField
                                    label="Cloud vault PIN"
                                    aria-label="Cloud vault PIN for Google Drive"
                                    type="password"
                                    inputMode="numeric"
                                    autoComplete="current-password"
                                    maxLength={PIN_MAX_LENGTH}
                                    value={pin}
                                    onChange={e => setPin(e.target.value)}
                                    placeholder="PIN used to unlock the cloud vault"
                                    hint="This is only needed when restoring a vault created on another device."
                                    className="[&_input]:font-mono [&_input]:tracking-widest"
                                />
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <Button variant="danger" onClick={handleRestore} disabled={busy || !pinReady}>
                                        Restore from Google Drive
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={() => {
                                            setPin('');
                                            setRestoreOpen(false);
                                        }}
                                        disabled={busy}
                                    >
                                        Cancel restore
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    setPin('');
                                    setRestoreOpen(true);
                                }}
                                disabled={busy}
                                className="text-[11px] text-surface-400 hover:text-surface-200 disabled:cursor-not-allowed disabled:opacity-50 underline underline-offset-2 cursor-pointer pressable"
                            >
                                Restore a cloud vault from another device
                            </button>
                        )}
                    </div>
                )}
            </article>
        </section>
    );
}
