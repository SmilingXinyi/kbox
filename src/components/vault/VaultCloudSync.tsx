import {useState} from 'react';
import {Check, Cloud, CloudDownload, Copy, Loader2, Unplug} from 'lucide-react';
import type {CloudProviderId} from '../../types/cloudSync';
import type {UseCloudSyncReturn} from '../../hooks/useCloudSync';
import {PIN_MAX_LENGTH, PIN_MIN_LENGTH} from '../../lib/crypto';
import {cloudOAuthJavaScriptOrigin, cloudOAuthRedirectUri} from '../../lib/cloudSync/config';
import {KBOX_GOOGLE_DRIVE_CLIENT_ID} from '../../lib/cloudSync/clientIds';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import TextField from '../ui/TextField';

type VaultCloudSyncProps = {
    cloud: UseCloudSyncReturn;
    variant?: 'settings' | 'setup';
    isUnlocked?: boolean;
};

type ProviderCopy = {
    mark: string;
    registerHint: string;
    registerHref: string;
    registerLabel: string;
};

const PROVIDER_COPY: Record<CloudProviderId, ProviderCopy> = {
    'google-drive': {
        mark: 'G',
        registerHint: 'Authorize Google in a popup. Vault file stays in Drive app data.',
        registerHref: 'https://console.cloud.google.com/apis/credentials',
        registerLabel: 'Google Cloud Console'
    },
    onedrive: {
        mark: 'M',
        registerHint: 'Authorize Microsoft in a popup. Vault file stays in the OneDrive app folder.',
        registerHref: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
        registerLabel: 'Microsoft Entra'
    }
};

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
    const [draftIds, setDraftIds] = useState<Record<CloudProviderId, string>>({
        'google-drive': '',
        onedrive: ''
    });
    const [openPanel, setOpenPanel] = useState<CloudProviderId | null>(null);
    const [restoreProviderId, setRestoreProviderId] = useState<CloudProviderId | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [copiedField, setCopiedField] = useState<'origin' | 'redirect' | null>(null);

    const busy = cloud.isBusy;
    const connected = cloud.session;
    const connectedProvider = cloud.providers.find(provider => provider.id === connected?.provider);
    const needsPin = !isUnlocked;
    const cloudVaultPin = pin.trim();
    const pinReady = cloudVaultPin.length >= PIN_MIN_LENGTH;
    const redirectUri = cloudOAuthRedirectUri();
    const javascriptOrigin = cloudOAuthJavaScriptOrigin();

    const showAppFields = (id: CloudProviderId) => openPanel === id;

    const prepareClientId = (id: CloudProviderId): boolean => {
        const provider = cloud.providers.find(item => item.id === id);
        if (!provider) return false;
        const typedId = draftIds[id].trim();
        if (provider.configured && openPanel !== id) return true;

        if (typedId) {
            cloud.saveClientId(id, typedId);
            setOpenPanel(null);
            return true;
        }

        if (id === 'google-drive') {
            cloud.saveClientId(id, '');
            setDraftIds(current => ({...current, 'google-drive': KBOX_GOOGLE_DRIVE_CLIENT_ID}));
            setOpenPanel(null);
            return true;
        }

        const existing = provider.clientId.trim();
        if (existing) {
            setOpenPanel(null);
            return true;
        }

        setOpenPanel(id);
        setFormError(`Enter the ${provider.label} OAuth client ID, then continue.`);
        return false;
    };

    const handlePull = (id: CloudProviderId) => {
        setFormError(null);
        const provider = cloud.providers.find(item => item.id === id);
        if (provider && !provider.configured && openPanel !== id) {
            setOpenPanel(id);
            return;
        }
        if (!prepareClientId(id)) return;
        void cloud.pull(id, needsPin ? {pin: cloudVaultPin} : undefined).catch(() => {
            // Error is surfaced via cloud.error.
        });
    };

    const handleConnect = (id: CloudProviderId) => {
        setFormError(null);
        const provider = cloud.providers.find(item => item.id === id);
        if (provider && !provider.configured && openPanel !== id) {
            setOpenPanel(id);
            return;
        }
        if (!prepareClientId(id)) return;
        void cloud.connect(id, {pull: false}).catch(() => {
            // Error is surfaced via cloud.error.
        });
    };

    const handleRestore = (id: CloudProviderId) => {
        setFormError(null);
        if (cloudVaultPin.length < PIN_MIN_LENGTH) {
            setFormError(`Enter the ${PIN_MIN_LENGTH}-${PIN_MAX_LENGTH} character cloud vault PIN to continue.`);
            return;
        }
        if (!prepareClientId(id)) return;
        if (!window.confirm('Restore the cloud vault? This replaces the vault currently stored on this device.'))
            return;

        void cloud
            .pull(id, {pin: cloudVaultPin})
            .then(() => {
                setPin('');
                setRestoreProviderId(null);
            })
            .catch(() => {
                // Error is surfaced via cloud.error.
            });
    };

    const handleCopy = async (field: 'origin' | 'redirect', value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopiedField(field);
            window.setTimeout(() => setCopiedField(current => (current === field ? null : current)), 1600);
        } catch (e) {
            console.error('Failed to copy OAuth URI:', e);
            setFormError('Could not copy to the clipboard.');
        }
    };

    return (
        <section className="space-y-3 mb-6">
            <div className="flex items-center gap-2 text-sm font-medium text-surface-100">
                <Cloud className="w-4 h-4 text-accent" aria-hidden />
                {variant === 'setup' ? (
                    <h1 className="font-display text-xl font-semibold tracking-tight">Pull from a cloud drive</h1>
                ) : (
                    <h3>Cloud drive</h3>
                )}
            </div>
            <p className="text-[11px] text-surface-400 leading-relaxed">
                {variant === 'setup'
                    ? 'Authorize Google Drive or OneDrive in this browser, then enter the cloud vault PIN to restore it. Recovery files stay local and are never uploaded. Biometrics stay on each device.'
                    : 'Authorize a drive in this browser. Key changes push one AES-GCM blob. On unlock, kbox pulls once if this device is still authorized. Recovery files are separate and never uploaded.'}
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

            {variant === 'settings' && connected && (
                <div className="p-3 rounded-lg border border-surface-700 bg-surface-950/50 space-y-1.5">
                    <p className="text-xs text-surface-100">
                        Connected to {connectedProvider?.label ?? connected.provider}
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

            <div className="space-y-2">
                {cloud.providers.map(provider => {
                    const copy = PROVIDER_COPY[provider.id];
                    const fieldsOpen = showAppFields(provider.id);
                    const restoreOpen = restoreProviderId === provider.id;
                    return (
                        <article
                            key={provider.id}
                            className="rounded-lg border border-surface-700 bg-surface-900/40 p-3 space-y-3"
                        >
                            <div className="flex items-start gap-2.5">
                                <span
                                    className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-800 text-[11px] font-semibold text-accent"
                                    aria-hidden
                                >
                                    {copy.mark}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <h4 className="text-sm font-medium text-surface-100">{provider.label}</h4>
                                        {provider.configured ? (
                                            <span className="text-[10px] uppercase tracking-wide text-accent">
                                                Ready
                                            </span>
                                        ) : (
                                            <span className="text-[10px] uppercase tracking-wide text-surface-400">
                                                Authorize
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-surface-400 leading-relaxed mt-0.5">
                                        {copy.registerHint}
                                    </p>
                                </div>
                            </div>

                            {fieldsOpen ? (
                                <div className="space-y-2.5">
                                    <TextField
                                        label="OAuth client ID"
                                        aria-label={`${provider.label} OAuth client ID`}
                                        value={draftIds[provider.id]}
                                        onChange={e =>
                                            setDraftIds(current => ({...current, [provider.id]: e.target.value}))
                                        }
                                        placeholder={
                                            provider.id === 'google-drive'
                                                ? '123456789-abc.apps.googleusercontent.com'
                                                : 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
                                        }
                                        hint={
                                            provider.id === 'google-drive'
                                                ? 'Leave blank to use the kbox Google app, or paste your own Web client ID.'
                                                : 'Public client ID only. Register this origin, then continue to authorize.'
                                        }
                                        className="[&_input]:font-mono [&_input]:text-xs"
                                    />
                                    <details className="rounded-md border border-surface-700 bg-surface-950/60 px-3 py-2">
                                        <summary className="cursor-pointer text-[11px] text-surface-300 pressable">
                                            Registration URIs
                                        </summary>
                                        <div className="mt-2 space-y-2.5">
                                            <p className="text-[11px] text-surface-400 leading-relaxed">
                                                Add these to your{' '}
                                                <a
                                                    href={copy.registerHref}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-surface-200 underline underline-offset-2"
                                                >
                                                    {copy.registerLabel}
                                                </a>{' '}
                                                app. Google: Web client + Drive API; only the JavaScript origin is used.
                                                Microsoft: SPA + Files.ReadWrite.AppFolder + offline_access.
                                            </p>
                                            <CopyableValue
                                                label="JavaScript origin"
                                                value={javascriptOrigin}
                                                copied={copiedField === 'origin'}
                                                onCopy={() => void handleCopy('origin', javascriptOrigin)}
                                            />
                                            {provider.id === 'onedrive' && (
                                                <CopyableValue
                                                    label="Redirect URI"
                                                    value={redirectUri}
                                                    copied={copiedField === 'redirect'}
                                                    onCopy={() => void handleCopy('redirect', redirectUri)}
                                                />
                                            )}
                                        </div>
                                    </details>
                                    {provider.id === 'google-drive' && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                cloud.saveClientId('google-drive', '');
                                                setDraftIds(current => ({
                                                    ...current,
                                                    'google-drive': KBOX_GOOGLE_DRIVE_CLIENT_ID
                                                }));
                                                setOpenPanel(null);
                                                setFormError(null);
                                            }}
                                            className="text-[11px] text-surface-400 hover:text-surface-200 underline underline-offset-2 cursor-pointer pressable"
                                        >
                                            Use kbox Google app
                                        </button>
                                    )}
                                </div>
                            ) : provider.configured ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDraftIds(current => ({
                                            ...current,
                                            [provider.id]: current[provider.id] || provider.clientId
                                        }));
                                        setOpenPanel(provider.id);
                                    }}
                                    className="text-[11px] text-surface-400 hover:text-surface-200 underline underline-offset-2 cursor-pointer pressable"
                                >
                                    Change OAuth app
                                </button>
                            ) : null}

                            <div
                                className={`grid gap-2 ${variant === 'settings' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}
                            >
                                {variant === 'settings' && (
                                    <Button
                                        variant="secondary"
                                        onClick={() => handleConnect(provider.id)}
                                        disabled={busy}
                                    >
                                        {connected?.provider === provider.id
                                            ? `Reconnect ${provider.label}`
                                            : `Connect ${provider.label}`}
                                    </Button>
                                )}
                                <Button
                                    variant={variant === 'setup' ? 'primary' : 'secondary'}
                                    onClick={() => handlePull(provider.id)}
                                    disabled={busy || (needsPin && !pinReady)}
                                >
                                    <CloudDownload className="w-3.5 h-3.5" aria-hidden />
                                    {variant === 'setup'
                                        ? `Pull from ${provider.label}`
                                        : `Pull updates from ${provider.label}`}
                                </Button>
                            </div>

                            {variant === 'settings' && (
                                <div className="border-t border-surface-700 pt-3">
                                    {restoreOpen ? (
                                        <div className="space-y-3">
                                            <Alert tone="warn">
                                                Restoring replaces the vault currently stored on this device.
                                            </Alert>
                                            <TextField
                                                label="Cloud vault PIN"
                                                aria-label={`Cloud vault PIN for ${provider.label}`}
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
                                                <Button
                                                    variant="danger"
                                                    onClick={() => handleRestore(provider.id)}
                                                    disabled={busy || !pinReady}
                                                >
                                                    Restore from {provider.label}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    onClick={() => {
                                                        setPin('');
                                                        setRestoreProviderId(null);
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
                                                setRestoreProviderId(provider.id);
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
                    );
                })}
            </div>
        </section>
    );
}
