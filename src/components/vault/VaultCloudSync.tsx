import {useState} from 'react';
import {Cloud, CloudDownload, Loader2, Unplug} from 'lucide-react';
import type {CloudProviderId} from '../../types/cloudSync';
import type {UseCloudSyncReturn} from '../../hooks/useCloudSync';
import {PIN_MAX_LENGTH, PIN_MIN_LENGTH} from '../../lib/crypto';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import TextField from '../ui/TextField';

type VaultCloudSyncProps = {
    cloud: UseCloudSyncReturn;
    variant?: 'settings' | 'setup';
    isUnlocked?: boolean;
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

export default function VaultCloudSync({cloud, variant = 'settings', isUnlocked = false}: VaultCloudSyncProps) {
    const [pin, setPin] = useState('');
    const busy = cloud.isBusy;
    const connected = cloud.session;
    const connectedProvider = cloud.providers.find(provider => provider.id === connected?.provider);
    const anyConfigured = cloud.providers.some(provider => provider.configured);
    const needsPin = !isUnlocked;
    const pinReady = !needsPin || pin.length >= PIN_MIN_LENGTH;

    const handlePull = (id: CloudProviderId) => {
        void cloud.pull(id, needsPin ? {pin} : undefined).catch(() => {
            // Error is surfaced via cloud.error.
        });
    };

    const handleConnect = (id: CloudProviderId) => {
        void cloud.connect(id, needsPin ? {pin} : undefined).catch(() => {
            // Error is surfaced via cloud.error.
        });
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
                    ? 'Authorize a drive, then enter the vault PIN to decrypt the whole-file blob. Recovery files stay local and are never uploaded. Biometrics stay on each device.'
                    : 'Key changes push one AES-GCM blob (labels and secrets inside the ciphertext). On unlock, kbox pulls once if this device is still authorized. Recovery files are separate and never uploaded.'}
            </p>

            {!anyConfigured && (
                <Alert tone="info">
                    Cloud drive OAuth client IDs are not set. Add{' '}
                    <span className="font-mono">VITE_GOOGLE_DRIVE_CLIENT_ID</span> and/or{' '}
                    <span className="font-mono">VITE_ONEDRIVE_CLIENT_ID</span> to enable Google Drive and OneDrive.
                </Alert>
            )}

            {cloud.error && (
                <Alert
                    tone="error"
                    action={
                        <button type="button" onClick={cloud.clearError} className="underline cursor-pointer pressable">
                            Dismiss
                        </button>
                    }
                >
                    {cloud.error}
                </Alert>
            )}

            {cloud.lastResult && !cloud.error && <Alert tone="success">{cloud.lastResult}</Alert>}

            {statusLabel(cloud.status) && (
                <p className="flex items-center gap-2 text-[11px] text-surface-300">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                    {statusLabel(cloud.status)}
                </p>
            )}

            {needsPin && (
                <TextField
                    label="Vault PIN"
                    aria-label="Vault PIN"
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

            {variant === 'settings' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {cloud.providers.map(provider => (
                        <Button
                            key={`connect-${provider.id}`}
                            variant="secondary"
                            onClick={() => handleConnect(provider.id)}
                            disabled={busy || !provider.configured}
                        >
                            {connected?.provider === provider.id
                                ? `Reconnect ${provider.label}`
                                : `Connect ${provider.label}`}
                        </Button>
                    ))}
                </div>
            )}

            <div className="space-y-2">
                <p className="text-[11px] font-medium text-surface-300">Pull vault</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {cloud.providers.map(provider => (
                        <Button
                            key={`pull-${provider.id}`}
                            variant={variant === 'setup' ? 'primary' : 'secondary'}
                            onClick={() => handlePull(provider.id)}
                            disabled={busy || !provider.configured || !pinReady}
                        >
                            <CloudDownload className="w-3.5 h-3.5" aria-hidden />
                            Pull from {provider.label}
                        </Button>
                    ))}
                </div>
            </div>
        </section>
    );
}
