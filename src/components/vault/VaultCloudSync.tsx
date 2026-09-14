import {Cloud, CloudDownload, Loader2, Unplug} from 'lucide-react';
import type {CloudProviderId} from '../../types/cloudSync';
import type {UseCloudSyncReturn} from '../../hooks/useCloudSync';
import Alert from '../ui/Alert';
import Button from '../ui/Button';

type VaultCloudSyncProps = {
    cloud: UseCloudSyncReturn;
    variant?: 'settings' | 'setup';
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

export default function VaultCloudSync({cloud, variant = 'settings'}: VaultCloudSyncProps) {
    const busy = cloud.isBusy;
    const connected = cloud.session;
    const connectedProvider = cloud.providers.find(provider => provider.id === connected?.provider);
    const anyConfigured = cloud.providers.some(provider => provider.configured);

    const handlePull = (id: CloudProviderId) => {
        void cloud.pull(id).catch(() => {
            // Error is surfaced via cloud.error.
        });
    };

    const handleConnect = (id: CloudProviderId) => {
        void cloud.connect(id).catch(() => {
            // Error is surfaced via cloud.error.
        });
    };

    return (
        <section className="space-y-3 mb-6">
            <div className="flex items-center gap-2 text-sm font-medium text-surface-100">
                <Cloud className="w-4 h-4 text-accent" aria-hidden />
                <h3>{variant === 'setup' ? 'Pull from a cloud drive' : 'Cloud drive'}</h3>
            </div>
            <p className="text-[11px] text-surface-400 leading-relaxed">
                {variant === 'setup'
                    ? 'Authorize Google Drive or OneDrive and pull the encrypted vault. Unlock afterwards with the same PIN. Biometrics stay on each device.'
                    : 'Key changes push to the connected drive. On launch, kbox pulls once if this device is still authorized. The drive only stores the encrypted vault.'}
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
                            disabled={busy || !provider.configured}
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
