import {useEffect, useRef, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {
    ArrowDownToLine,
    ArrowUpFromLine,
    Camera,
    CheckCircle2,
    Loader2,
    QrCode,
    Radio,
    RefreshCw,
    Unplug,
    X
} from 'lucide-react';
import {Html5Qrcode} from 'html5-qrcode';
import type {UseWebRTCSyncReturn} from '../../hooks/useWebRTCSync';
import type {SyncStrategy} from '../../types/sync';

type VaultSyncProps = {
    isOpen: boolean;
    onClose: () => void;
    sync: UseWebRTCSyncReturn;
    isUnlocked: boolean;
    onRequestUnlock: () => void;
};

const SCANNER_REGION_ID = 'kbox-sync-qr-reader';

export default function VaultSync({isOpen, onClose, sync, isUnlocked, onRequestUnlock}: VaultSyncProps) {
    const [manualPeerId, setManualPeerId] = useState('');
    const [scanError, setScanError] = useState<string | null>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const handledScanRef = useRef(false);
    /** Monotonic token so overlapping start/stop cycles ignore stale async completions. */
    const scannerGenerationRef = useRef(0);
    const scannerStoppingRef = useRef(false);
    const connectWithQrTextRef = useRef(sync.connectWithQrText);

    useEffect(() => {
        connectWithQrTextRef.current = sync.connectWithQrText;
    }, [sync.connectWithQrText]);

    const stopScanner = async (expectedGeneration?: number) => {
        if (scannerStoppingRef.current) return;
        const scanner = scannerRef.current;
        if (!scanner) return;

        // A newer start() may have already replaced this instance.
        if (expectedGeneration != null && scannerGenerationRef.current !== expectedGeneration) {
            return;
        }

        scannerStoppingRef.current = true;
        scannerRef.current = null;
        try {
            if (scanner.isScanning) {
                await scanner.stop();
            }
            scanner.clear();
        } catch (err) {
            // Common when the camera track is already gone; keep a breadcrumb for harder races.
            console.warn('QR scanner stop/clear failed:', err);
        } finally {
            scannerStoppingRef.current = false;
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

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
                // Ensure any prior camera session is fully released before starting again.
                await stopScanner();
                if (cancelled || scannerGenerationRef.current !== generation) return;

                const scanner = new Html5Qrcode(SCANNER_REGION_ID);
                if (cancelled || scannerGenerationRef.current !== generation) {
                    try {
                        scanner.clear();
                    } catch (err) {
                        console.warn('Abandoned QR scanner clear failed:', err);
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

                // If we were cancelled while awaiting start(), shut the camera back down.
                if (cancelled || scannerGenerationRef.current !== generation) {
                    void stopScanner(generation);
                }
            } catch (e) {
                console.error('QR scanner failed:', e);
                if (!cancelled && scannerGenerationRef.current === generation) {
                    setScanError(
                        e instanceof Error ? e.message : 'Camera access failed. Enter the peer ID manually instead.'
                    );
                }
            }
        }

        void startScanner();

        return () => {
            cancelled = true;
            // Bump generation so in-flight start()/decode callbacks become no-ops,
            // then stop whatever camera instance is currently held (no generation gate).
            scannerGenerationRef.current += 1;
            void stopScanner();
        };
    }, [isOpen, sync.sessionState]);

    const handleClose = () => {
        sync.stop();
        setManualPeerId('');
        setScanError(null);
        onClose();
    };

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
        const value = manualPeerId.trim();
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
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <motion.button
                        type="button"
                        aria-label="Close sync backdrop"
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        exit={{opacity: 0}}
                        className="absolute inset-0 bg-surface-950/80 backdrop-blur-sm cursor-pointer"
                        onClick={handleClose}
                    />
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="vault-sync-title"
                        initial={{opacity: 0, y: 24}}
                        animate={{opacity: 1, y: 0}}
                        exit={{opacity: 0, y: 16}}
                        className="relative w-full sm:max-w-md max-h-[92dvh] overflow-y-auto bg-surface-900 border border-surface-700 rounded-t-2xl sm:rounded-2xl p-5 sm:p-6"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h2 id="vault-sync-title" className="text-lg font-semibold text-surface-100">
                                    Device sync
                                </h2>
                                <p className="text-[11px] text-surface-400 mt-1 leading-relaxed">
                                    Peer-to-peer WebRTC transfer. Secrets stay on-device and move only over the
                                    encrypted data channel.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleClose}
                                className="p-1.5 text-surface-400 hover:text-surface-100 hover:bg-surface-800 rounded-lg cursor-pointer"
                                aria-label="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {!isUnlocked && (
                            <div className="mb-4 p-3 rounded-lg border border-warn/30 bg-warn/10 text-warn text-xs">
                                Unlock the vault before starting sync so secrets can be transferred safely.
                                <button
                                    type="button"
                                    onClick={onRequestUnlock}
                                    className="block mt-2 underline cursor-pointer"
                                >
                                    Unlock now
                                </button>
                            </div>
                        )}

                        <div className="mb-4 flex items-center gap-2 text-xs text-surface-300">
                            {(sync.sessionState === 'starting' ||
                                sync.sessionState === 'connecting' ||
                                sync.sessionState === 'syncing') && (
                                <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                            )}
                            {sync.sessionState === 'synced' && <CheckCircle2 className="w-3.5 h-3.5 text-accent" />}
                            {sync.sessionState === 'waiting' && (
                                <Radio className="w-3.5 h-3.5 text-accent animate-pulse" />
                            )}
                            <span>{statusLabel}</span>
                        </div>

                        {(sync.error || scanError) && (
                            <div className="mb-4 p-3 rounded-lg border border-danger/30 bg-danger-muted text-danger text-xs">
                                <p>{sync.error ?? scanError}</p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        sync.clearError();
                                        setScanError(null);
                                    }}
                                    className="mt-1 underline cursor-pointer"
                                >
                                    Dismiss
                                </button>
                            </div>
                        )}

                        {sync.sessionState === 'idle' ||
                        sync.sessionState === 'closed' ||
                        sync.sessionState === 'error' ? (
                            <div className="space-y-3">
                                <button
                                    type="button"
                                    onClick={handleStartHost}
                                    disabled={!isUnlocked}
                                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-surface-700 hover:border-accent/40 hover:bg-accent-muted text-left cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="p-2 rounded-lg bg-surface-800 text-accent">
                                        <QrCode className="w-4 h-4" />
                                    </div>
                                    <span>
                                        <span className="block text-sm text-surface-100">Enable sync service</span>
                                        <span className="block text-[11px] text-surface-400 mt-0.5">
                                            Show a QR code for the other device to scan (device A)
                                        </span>
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleStartScan}
                                    disabled={!isUnlocked}
                                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-surface-700 hover:border-accent/40 hover:bg-accent-muted text-left cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="p-2 rounded-lg bg-surface-800 text-accent">
                                        <Camera className="w-4 h-4" />
                                    </div>
                                    <span>
                                        <span className="block text-sm text-surface-100">Scan to join</span>
                                        <span className="block text-[11px] text-surface-400 mt-0.5">
                                            Scan the host QR code on this device (device B)
                                        </span>
                                    </span>
                                </button>
                            </div>
                        ) : null}

                        {(sync.sessionState === 'starting' || sync.sessionState === 'waiting') &&
                            sync.role === 'host' && (
                                <div className="space-y-4">
                                    <div className="flex flex-col items-center gap-3 p-4 rounded-xl border border-surface-700 bg-surface-950">
                                        {sync.qrDataUrl ? (
                                            <img
                                                src={sync.qrDataUrl}
                                                alt="Sync QR code"
                                                className="w-56 h-56 rounded-lg bg-surface-100"
                                            />
                                        ) : (
                                            <div className="w-56 h-56 flex items-center justify-center">
                                                <Loader2 className="w-6 h-6 text-accent animate-spin" />
                                            </div>
                                        )}
                                        <p className="text-[11px] text-surface-400 text-center">
                                            Scan with the other device running kbox. Peer ID:
                                        </p>
                                        <code className="text-[10px] font-mono text-accent break-all text-center">
                                            {sync.peerId ?? '…'}
                                        </code>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={sync.stop}
                                        className="w-full inline-flex items-center justify-center gap-2 py-2.5 border border-surface-700 text-surface-300 rounded-lg text-sm cursor-pointer hover:bg-surface-800 transition"
                                    >
                                        <Unplug className="w-4 h-4" />
                                        Stop service
                                    </button>
                                </div>
                            )}

                        {sync.sessionState === 'scanning' && (
                            <div className="space-y-4">
                                <div
                                    id={SCANNER_REGION_ID}
                                    className="overflow-hidden rounded-xl border border-surface-700 bg-surface-950 min-h-[220px]"
                                />
                                <form onSubmit={handleManualConnect} className="space-y-2">
                                    <label className="block text-[11px] text-surface-400">
                                        Or paste peer ID manually
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={manualPeerId}
                                            onChange={e => setManualPeerId(e.target.value)}
                                            placeholder="Peer ID from host QR"
                                            className="flex-1 px-3 py-2 bg-surface-950 border border-surface-700 rounded-lg text-xs font-mono text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-accent transition"
                                        />
                                        <button
                                            type="submit"
                                            disabled={!manualPeerId.trim()}
                                            className="px-3 py-2 bg-accent hover:bg-accent-dim text-surface-950 text-xs font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition"
                                        >
                                            Connect
                                        </button>
                                    </div>
                                </form>
                                <button
                                    type="button"
                                    onClick={sync.stop}
                                    className="w-full py-2.5 border border-surface-700 text-surface-300 rounded-lg text-sm cursor-pointer hover:bg-surface-800 transition"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}

                        {(sync.sessionState === 'connecting' ||
                            sync.sessionState === 'connected' ||
                            sync.sessionState === 'syncing' ||
                            sync.sessionState === 'synced') && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 rounded-lg border border-surface-700 bg-surface-950">
                                        <p className="text-[10px] uppercase tracking-wide text-surface-400">
                                            This device
                                        </p>
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
                                            {sync.remote
                                                ? sync.remote.role === 'host'
                                                    ? 'Host (A)'
                                                    : 'Guest (B)'
                                                : 'Negotiating'}
                                        </p>
                                    </div>
                                </div>

                                {sync.sessionState === 'synced' && (
                                    <div className="flex items-start gap-2 p-3 rounded-lg border border-accent/30 bg-accent-muted text-accent text-xs">
                                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                                        <p>
                                            Sync finished
                                            {sync.lastSyncedCount != null
                                                ? ` — ${sync.lastSyncedCount} item${sync.lastSyncedCount === 1 ? '' : 's'} applied.`
                                                : '.'}
                                        </p>
                                    </div>
                                )}

                                {sync.role === 'host' &&
                                    (sync.sessionState === 'connected' || sync.sessionState === 'synced') && (
                                        <div className="space-y-2">
                                            <p className="text-[11px] text-surface-400">Merge strategy</p>
                                            <button
                                                type="button"
                                                onClick={() => handleStrategy('a-overwrites-b')}
                                                className="w-full flex items-start gap-3 p-3 rounded-lg border border-surface-700 hover:border-accent/40 hover:bg-accent-muted text-left cursor-pointer transition"
                                            >
                                                <ArrowUpFromLine className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                                                <span>
                                                    <span className="block text-sm text-surface-100">
                                                        A overwrites B
                                                    </span>
                                                    <span className="block text-[11px] text-surface-400 mt-0.5">
                                                        Push this vault to the other device
                                                    </span>
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleStrategy('b-overwrites-a')}
                                                className="w-full flex items-start gap-3 p-3 rounded-lg border border-surface-700 hover:border-accent/40 hover:bg-accent-muted text-left cursor-pointer transition"
                                            >
                                                <ArrowDownToLine className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                                                <span>
                                                    <span className="block text-sm text-surface-100">
                                                        Read B, overwrite A
                                                    </span>
                                                    <span className="block text-[11px] text-surface-400 mt-0.5">
                                                        Pull the other vault onto this device
                                                    </span>
                                                </span>
                                            </button>
                                        </div>
                                    )}

                                {sync.role === 'guest' && sync.sessionState === 'connected' && (
                                    <p className="text-[11px] text-surface-400 leading-relaxed">
                                        Connected. Wait for the host to choose a merge strategy, or stay on this screen
                                        until sync finishes.
                                    </p>
                                )}

                                {sync.sessionState === 'syncing' && (
                                    <div className="flex items-center justify-center gap-2 py-2 text-xs text-surface-300">
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent" />
                                        Transferring encrypted channel payload…
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={sync.stop}
                                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 border border-surface-700 text-surface-300 rounded-lg text-sm cursor-pointer hover:bg-surface-800 transition"
                                >
                                    <Unplug className="w-4 h-4" />
                                    Disconnect
                                </button>
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
