import {useEffect, useRef, useState} from 'react';
import {
    ArrowDownToLine,
    ArrowUpFromLine,
    Camera,
    CheckCircle2,
    Copy,
    Loader2,
    QrCode,
    Radio,
    RefreshCw,
    Shield,
    Unplug
} from 'lucide-react';
import {Html5Qrcode} from 'html5-qrcode';
import type {UseWebRTCSyncReturn} from '../../hooks/useWebRTCSync';
import type {SyncStrategy} from '../../types/sync';
import Modal from '../ui/Modal';
import Alert from '../ui/Alert';
import Button from '../ui/Button';

type VaultSyncProps = {
    isOpen: boolean;
    onClose: () => void;
    sync: UseWebRTCSyncReturn;
    isUnlocked: boolean;
    onRequestUnlock: () => void;
};

const SCANNER_REGION_ID = 'kbox-sync-qr-reader';

function isAbortLikeError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const name = 'name' in err ? String(err.name) : '';
    const message = 'message' in err ? String(err.message) : String(err);
    return name === 'AbortError' || /abort|not scanning|scan is ongoing/i.test(message);
}

export default function VaultSync({isOpen, onClose, sync, isUnlocked, onRequestUnlock}: VaultSyncProps) {
    const [manualInvite, setManualInvite] = useState('');
    const [scanError, setScanError] = useState<string | null>(null);
    const [copiedInvite, setCopiedInvite] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const handledScanRef = useRef(false);
    /** Monotonic token so overlapping start/stop cycles ignore stale async completions. */
    const scannerGenerationRef = useRef(0);
    /** Serialize stop/clear so start ↔ cleanup races cannot clear while still scanning. */
    const scannerStopChainRef = useRef<Promise<void>>(Promise.resolve());
    const connectWithQrTextRef = useRef(sync.connectWithQrText);

    useEffect(() => {
        connectWithQrTextRef.current = sync.connectWithQrText;
    }, [sync.connectWithQrText]);

    const stopScanner = (expectedGeneration?: number) => {
        const run = async () => {
            const scanner = scannerRef.current;
            if (!scanner) return;

            if (expectedGeneration != null && scannerGenerationRef.current !== expectedGeneration) {
                return;
            }

            // Detach immediately so a concurrent start does not reuse this instance.
            scannerRef.current = null;

            try {
                // Prefer stop whenever the library reports an active scan; fall back to
                // best-effort stop for transitional states where isScanning is stale.
                if (scanner.isScanning) {
                    await scanner.stop();
                }
            } catch (err) {
                if (!isAbortLikeError(err)) {
                    console.warn('QR scanner stop failed:', err);
                }
            }

            try {
                if (scanner.isScanning) {
                    await scanner.stop();
                }
            } catch (err) {
                if (!isAbortLikeError(err)) {
                    console.warn('QR scanner second stop failed:', err);
                }
            }

            try {
                // Html5Qrcode throws if clear() runs while a scan is still active.
                if (!scanner.isScanning) {
                    scanner.clear();
                }
            } catch (err) {
                if (!isAbortLikeError(err)) {
                    console.warn('QR scanner clear failed:', err);
                }
            }
        };

        scannerStopChainRef.current = scannerStopChainRef.current.then(run, run);
        return scannerStopChainRef.current;
    };

    const stopRef = useRef(sync.stop);
    useEffect(() => {
        stopRef.current = sync.stop;
    }, [sync.stop]);

    const handleClose = () => {
        stopRef.current();
        setManualInvite('');
        setScanError(null);
        setCopiedInvite(false);
        onClose();
    };

    const handleStop = () => {
        setScanError(null);
        setCopiedInvite(false);
        stopRef.current();
    };

    const handleCopyInvite = async () => {
        if (!sync.inviteText) return;
        try {
            await navigator.clipboard.writeText(sync.inviteText);
            setCopiedInvite(true);
            window.setTimeout(() => setCopiedInvite(false), 2000);
        } catch (e) {
            console.error('Failed to copy invite:', e);
            setScanError('Failed to copy invite. Select and copy it manually.');
        }
    };

    useEffect(() => {
        if (isOpen) return;
        stopRef.current();
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || sync.sessionState !== 'scanning') {
            void stopScanner();
            return;
        }

        handledScanRef.current = false;
        const generation = ++scannerGenerationRef.current;
        let cancelled = false;

        async function startScanner() {
            if (cancelled || scannerGenerationRef.current !== generation) return;

            try {
                await stopScanner();
                if (cancelled || scannerGenerationRef.current !== generation) return;

                const scanner = new Html5Qrcode(SCANNER_REGION_ID);
                if (cancelled || scannerGenerationRef.current !== generation) {
                    try {
                        scanner.clear();
                    } catch (err) {
                        if (!isAbortLikeError(err)) {
                            console.warn('Abandoned QR scanner clear failed:', err);
                        }
                    }
                    return;
                }

                scannerRef.current = scanner;
                await scanner.start(
                    {facingMode: 'environment'},
                    {fps: 8, qrbox: {width: 220, height: 220}},
                    decoded => {
                        if (handledScanRef.current || cancelled || scannerGenerationRef.current !== generation) {
                            return;
                        }
                        handledScanRef.current = true;
                        void connectWithQrTextRef.current(decoded);
                        void stopScanner(generation);
                    },
                    () => {
                        // Ignore per-frame not-found errors.
                    }
                );

                if (cancelled || scannerGenerationRef.current !== generation) {
                    void stopScanner(generation);
                }
            } catch (e) {
                // Manual peer-ID connect (or effect cleanup) often aborts an in-flight start.
                if (cancelled || scannerGenerationRef.current !== generation || isAbortLikeError(e)) {
                    void stopScanner(generation);
                    return;
                }
                console.error('QR scanner failed:', e);
                if (scannerGenerationRef.current === generation) {
                    setScanError(
                        e instanceof Error ? e.message : 'Camera access failed. Enter the peer ID manually instead.'
                    );
                }
            }
        }

        void startScanner();

        return () => {
            cancelled = true;
            scannerGenerationRef.current += 1;
            void stopScanner();
        };
    }, [isOpen, sync.sessionState]);

    const ensureUnlocked = () => {
        if (isUnlocked) return true;
        onRequestUnlock();
        return false;
    };

    const handleStartHost = () => {
        if (!ensureUnlocked()) return;
        void sync.startHost();
    };

    const handleStartScan = () => {
        if (!ensureUnlocked()) return;
        setScanError(null);
        sync.startGuestScan();
    };

    const handleManualConnect = (e: React.FormEvent) => {
        e.preventDefault();
        if (!ensureUnlocked()) return;
        const value = manualInvite.trim();
        if (!value) return;
        void sync.connectWithQrText(value);
    };

    const handleStrategy = (strategy: SyncStrategy) => {
        if (!ensureUnlocked()) return;
        const label =
            strategy === 'a-overwrites-b'
                ? 'Overwrite the other device with THIS vault? Their keys will be replaced.'
                : 'Overwrite THIS vault with the other device? Your local keys will be replaced.';
        if (!window.confirm(label)) return;
        void sync.runStrategy(strategy);
    };

    const statusLabel = (() => {
        switch (sync.sessionState) {
            case 'idle':
                return 'Sync service is off';
            case 'starting':
                return 'Starting WebRTC…';
            case 'waiting':
                return 'Waiting for the other device to scan…';
            case 'scanning':
                return 'Point the camera at the host QR code';
            case 'connecting':
                return 'Connecting…';
            case 'connected':
                return 'Devices linked — ready to sync';
            case 'syncing':
                return 'Syncing vault data…';
            case 'synced':
                return 'Sync complete';
            case 'error':
                return 'Sync error';
            case 'closed':
                return 'Connection closed';
            default:
                return '';
        }
    })();

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Device sync"
            description="Peer-to-peer WebRTC transfer with app-layer AES-GCM. The QR invite carries a one-time session key — vault secrets are never sent in plaintext."
        >
            {!isUnlocked && (
                <Alert
                    tone="warn"
                    className="mb-4"
                    action={
                        <button type="button" onClick={onRequestUnlock} className="underline cursor-pointer pressable">
                            Unlock now
                        </button>
                    }
                >
                    Unlock the vault before starting sync so secrets can be transferred safely.
                </Alert>
            )}

            <div className="mb-4 flex items-center gap-2 text-xs text-surface-300">
                {(sync.sessionState === 'starting' ||
                    sync.sessionState === 'connecting' ||
                    sync.sessionState === 'syncing') && <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />}
                {sync.sessionState === 'synced' && <CheckCircle2 className="w-3.5 h-3.5 text-accent" />}
                {sync.sessionState === 'waiting' && <Radio className="w-3.5 h-3.5 text-accent animate-pulse" />}
                <span>{statusLabel}</span>
            </div>

            {(sync.error || scanError) && (
                <Alert
                    tone="error"
                    className="mb-4"
                    action={
                        <button
                            type="button"
                            onClick={() => {
                                sync.clearError();
                                setScanError(null);
                            }}
                            className="underline cursor-pointer pressable"
                        >
                            Dismiss
                        </button>
                    }
                >
                    {sync.error ?? scanError}
                </Alert>
            )}

            {(sync.sessionState === 'idle' || sync.sessionState === 'closed' || sync.sessionState === 'error') && (
                <div className="space-y-3">
                    <button
                        type="button"
                        onClick={handleStartHost}
                        disabled={!isUnlocked}
                        className="w-full flex items-center gap-3 p-3 min-h-14 rounded-lg border border-surface-700 hover:border-accent/40 hover:bg-accent-muted text-left cursor-pointer pressable transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="p-2 rounded-lg bg-surface-800 text-accent">
                            <QrCode className="w-4 h-4" aria-hidden />
                        </div>
                        <span>
                            <span className="block text-sm text-surface-100">Enable sync service</span>
                            <span className="block text-[11px] text-surface-400 mt-0.5">
                                Show a secure QR invite for the other device (device A)
                            </span>
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={handleStartScan}
                        disabled={!isUnlocked}
                        className="w-full flex items-center gap-3 p-3 min-h-14 rounded-lg border border-surface-700 hover:border-accent/40 hover:bg-accent-muted text-left cursor-pointer pressable transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="p-2 rounded-lg bg-surface-800 text-accent">
                            <Camera className="w-4 h-4" aria-hidden />
                        </div>
                        <span>
                            <span className="block text-sm text-surface-100">Scan to join</span>
                            <span className="block text-[11px] text-surface-400 mt-0.5">
                                Scan or paste the host invite on this device (device B)
                            </span>
                        </span>
                    </button>
                </div>
            )}

            {(sync.sessionState === 'starting' || sync.sessionState === 'waiting') && sync.role === 'host' && (
                <div className="space-y-4">
                    <div className="flex flex-col items-center gap-3 p-4 rounded-xl border border-surface-700 bg-surface-950">
                        {sync.qrDataUrl ? (
                            <img
                                src={sync.qrDataUrl}
                                alt="Sync QR code"
                                className="w-full max-w-56 aspect-square rounded-lg bg-surface-100"
                            />
                        ) : (
                            <div className="w-56 h-56 flex items-center justify-center">
                                <Loader2 className="w-6 h-6 text-accent animate-spin" />
                            </div>
                        )}
                        <p className="text-[11px] text-surface-400 text-center leading-relaxed">
                            Scan with the other device running kbox. The invite includes a one-time encryption key —
                            treat it like a password.
                        </p>
                        {sync.pairingCode && (
                            <p className="text-[11px] text-surface-300 font-mono">
                                Pairing code: <span className="text-accent">{sync.pairingCode}</span>
                            </p>
                        )}
                        <code className="text-[10px] font-mono text-surface-400 break-all text-center max-h-20 overflow-y-auto overscroll-y-contain w-full">
                            {sync.inviteText ?? '…'}
                        </code>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={!sync.inviteText}
                            onClick={() => void handleCopyInvite()}
                        >
                            <Copy className="w-3.5 h-3.5" aria-hidden />
                            {copiedInvite ? 'Copied' : 'Copy invite'}
                        </Button>
                    </div>
                    <Button variant="secondary" fullWidth onClick={handleStop}>
                        <Unplug className="w-4 h-4" aria-hidden />
                        Stop service
                    </Button>
                </div>
            )}

            {sync.sessionState === 'scanning' && (
                <div className="space-y-4">
                    <div
                        id={SCANNER_REGION_ID}
                        className="overflow-hidden rounded-xl border border-surface-700 bg-surface-950 min-h-[220px]"
                    />
                    <form onSubmit={handleManualConnect} className="space-y-2">
                        <label className="block text-[11px] text-surface-400">Or paste the full host invite</label>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="text"
                                value={manualInvite}
                                onChange={e => setManualInvite(e.target.value)}
                                placeholder="kbox-sync:{…} invite from host"
                                className="flex-1 min-h-11 px-3 py-2 bg-surface-950 border border-surface-700 rounded-lg text-base font-mono text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-accent transition"
                            />
                            <Button type="submit" disabled={!manualInvite.trim()} className="sm:w-auto">
                                Connect
                            </Button>
                        </div>
                    </form>
                    <Button variant="secondary" fullWidth onClick={handleStop}>
                        Cancel
                    </Button>
                </div>
            )}

            {(sync.sessionState === 'connecting' ||
                sync.sessionState === 'connected' ||
                sync.sessionState === 'syncing' ||
                sync.sessionState === 'synced') && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg border border-surface-700 bg-surface-950">
                            <p className="text-[10px] uppercase tracking-wide text-surface-400">This device</p>
                            <p className="text-sm text-surface-100 mt-1">
                                {sync.localItemCount} key{sync.localItemCount === 1 ? '' : 's'}
                            </p>
                            <p className="text-[10px] text-surface-500 mt-0.5">
                                {sync.role === 'host' ? 'Host (A)' : 'Guest (B)'}
                            </p>
                        </div>
                        <div className="p-3 rounded-lg border border-surface-700 bg-surface-950">
                            <p className="text-[10px] uppercase tracking-wide text-surface-400">Peer</p>
                            <p className="text-sm text-surface-100 mt-1">
                                {sync.remote
                                    ? `${sync.remote.itemCount} key${sync.remote.itemCount === 1 ? '' : 's'}`
                                    : '…'}
                            </p>
                            <p className="text-[10px] text-surface-500 mt-0.5">
                                {sync.remote ? (sync.remote.role === 'host' ? 'Host (A)' : 'Guest (B)') : 'Negotiating'}
                            </p>
                        </div>
                    </div>

                    {sync.pairingCode && sync.isConnected && (
                        <div className="flex items-start gap-2 p-3 rounded-lg border border-accent/30 bg-accent-muted text-[11px] text-surface-200 leading-relaxed">
                            <Shield className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" aria-hidden />
                            <span>
                                Confirm both devices show the same pairing code:{' '}
                                <span className="font-mono text-accent">{sync.pairingCode}</span>. If they differ,
                                disconnect and start over.
                            </span>
                        </div>
                    )}

                    {sync.sessionState === 'synced' && (
                        <Alert tone="success">
                            Sync finished
                            {sync.lastSyncedCount != null
                                ? ` — ${sync.lastSyncedCount} item${sync.lastSyncedCount === 1 ? '' : 's'} applied.`
                                : '.'}
                        </Alert>
                    )}

                    {sync.role === 'host' && (sync.sessionState === 'connected' || sync.sessionState === 'synced') && (
                        <div className="space-y-2">
                            <p className="text-[11px] text-surface-400">Merge strategy</p>
                            <button
                                type="button"
                                onClick={() => handleStrategy('a-overwrites-b')}
                                className="w-full flex items-start gap-3 p-3 min-h-14 rounded-lg border border-surface-700 hover:border-accent/40 hover:bg-accent-muted text-left cursor-pointer pressable transition"
                            >
                                <ArrowUpFromLine className="w-4 h-4 text-accent mt-0.5 shrink-0" aria-hidden />
                                <span>
                                    <span className="block text-sm text-surface-100">A overwrites B</span>
                                    <span className="block text-[11px] text-surface-400 mt-0.5">
                                        Push this vault to the other device
                                    </span>
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleStrategy('b-overwrites-a')}
                                className="w-full flex items-start gap-3 p-3 min-h-14 rounded-lg border border-surface-700 hover:border-accent/40 hover:bg-accent-muted text-left cursor-pointer pressable transition"
                            >
                                <ArrowDownToLine className="w-4 h-4 text-accent mt-0.5 shrink-0" aria-hidden />
                                <span>
                                    <span className="block text-sm text-surface-100">Read B, overwrite A</span>
                                    <span className="block text-[11px] text-surface-400 mt-0.5">
                                        Pull the other vault onto this device
                                    </span>
                                </span>
                            </button>
                        </div>
                    )}

                    {sync.role === 'guest' && sync.pendingIncoming && (
                        <div className="space-y-3">
                            <Alert tone="warn">
                                {sync.pendingIncoming.strategy === 'a-overwrites-b'
                                    ? `The host wants to replace THIS vault with theirs (${sync.pendingIncoming.items.length} key${sync.pendingIncoming.items.length === 1 ? '' : 's'}). Your local keys will be deleted.`
                                    : 'The host wants to pull THIS vault onto their device. Your secrets will be sent in an encrypted envelope over the linked channel.'}
                            </Alert>
                            <div className="flex flex-col-reverse sm:flex-row gap-2">
                                <Button variant="secondary" fullWidth onClick={() => sync.rejectIncomingSync()}>
                                    Reject
                                </Button>
                                <Button fullWidth onClick={() => void sync.acceptIncomingSync()}>
                                    {sync.pendingIncoming.strategy === 'a-overwrites-b'
                                        ? 'Accept overwrite'
                                        : 'Send my vault'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {sync.role === 'guest' && sync.sessionState === 'connected' && !sync.pendingIncoming && (
                        <p className="text-[11px] text-surface-400 leading-relaxed">
                            Connected. Wait for the host to choose a merge strategy. You will be asked to confirm before
                            any keys are sent or replaced.
                        </p>
                    )}

                    {sync.role === 'guest' && sync.sessionState === 'syncing' && !sync.pendingIncoming && (
                        <p className="text-[11px] text-surface-400 leading-relaxed">
                            Waiting for the host to finish applying the transfer…
                        </p>
                    )}

                    {sync.sessionState === 'syncing' && (
                        <div className="flex items-center justify-center gap-2 py-2 text-xs text-surface-300">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent" aria-hidden />
                            Transferring AES-GCM encrypted vault…
                        </div>
                    )}

                    <Button variant="secondary" fullWidth onClick={handleStop}>
                        <Unplug className="w-4 h-4" aria-hidden />
                        Disconnect
                    </Button>
                </div>
            )}
        </Modal>
    );
}
