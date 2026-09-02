import {useEffect, useRef, useState} from 'react';
import {motion} from 'motion/react';
import {Fingerprint, Key, Lock, RefreshCw, X} from 'lucide-react';
import type {VaultMetadata, ResidualUnlockResult} from '../../types/vault';
import {PIN_MAX_LENGTH} from '../../lib/crypto';
import {isBiometricSimulatorEnabled} from '../../lib/biometricSimulator';
import BiometricSimulator from './BiometricSimulator';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import TextField from '../ui/TextField';

type VaultUnlockProps = {
    metadata: VaultMetadata;
    onUnlockWithPin: (pin: string) => Promise<ResidualUnlockResult | null>;
    onUnlockWithWebAuthn: (simulatedKeyMaterialHex?: string) => Promise<ResidualUnlockResult | null>;
    onClose: () => void;
    onResidualAction?: (result: ResidualUnlockResult) => void;
};

export default function VaultUnlock({
    metadata,
    onUnlockWithPin,
    onUnlockWithWebAuthn,
    onClose,
    onResidualAction
}: VaultUnlockProps) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showSimulator, setShowSimulator] = useState(false);
    const [showPinForm, setShowPinForm] = useState(!metadata.hasWebAuthn);
    const simulatorEnabled = isBiometricSimulatorEnabled();
    const preferBiometrics = metadata.hasWebAuthn && metadata.webauthnKeySource !== 'simulated';
    const autoPromptedRef = useRef(false);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !showSimulator) onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose, showSimulator]);

    const handleBiometricUnlock = async (simulatedKeyMaterialHex?: string) => {
        setError(null);
        setLoading(true);
        try {
            const residual = await onUnlockWithWebAuthn(simulatedKeyMaterialHex);
            if (residual) onResidualAction?.(residual);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Biometric authentication failed.';
            const cancelled =
                msg.toLowerCase().includes('not allowed') ||
                msg.toLowerCase().includes('cancel') ||
                msg.toLowerCase().includes('abort');
            const canUseSimulator =
                simulatorEnabled &&
                (msg.includes('iframe') ||
                    msg.includes('not supported') ||
                    msg.includes('not initialized') ||
                    msg.includes('sandbox required'));
            if (canUseSimulator) {
                setShowSimulator(true);
            } else {
                if (!cancelled) {
                    setError(`${msg} Try your PIN.`);
                }
                setShowPinForm(true);
            }
        } finally {
            setLoading(false);
        }
    };

    // Prefer Face ID / Touch ID: auto-prompt once when the unlock sheet opens.
    useEffect(() => {
        if (!preferBiometrics || autoPromptedRef.current) return;
        autoPromptedRef.current = true;
        const timer = window.setTimeout(() => {
            void handleBiometricUnlock();
        }, 280);
        return () => window.clearTimeout(timer);
        // Intentionally run once on mount for this unlock session.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handlePinUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!pin) return;

        setLoading(true);
        try {
            const residual = await onUnlockWithPin(pin);
            if (residual) onResidualAction?.(residual);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Incorrect PIN.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="app-overlay z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-surface-950/85 backdrop-blur-[2px]">
            <motion.div
                initial={{opacity: 0, y: 24, scale: 0.98}}
                animate={{opacity: 1, y: 0, scale: 1}}
                transition={{duration: 0.28, ease: [0.32, 0.72, 0, 1]}}
                className="w-full sm:max-w-md overflow-hidden bg-surface-900 border border-surface-700 border-b-0 sm:border-b rounded-t-2xl sm:rounded-2xl relative"
                role="dialog"
                aria-modal="true"
                aria-labelledby="vault-unlock-title"
            >
                <div className="h-1 hazard-stripe" aria-hidden />

                <div className="p-5 sm:p-6 safe-pb relative">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-3 right-3 p-2.5 min-h-11 min-w-11 inline-flex items-center justify-center text-surface-400 hover:text-surface-100 hover:bg-surface-800 rounded-lg transition cursor-pointer pressable"
                        aria-label="Cancel"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    <div className="flex flex-col items-center mb-6 text-center pt-1">
                        <div className="p-3.5 bg-accent-muted border border-accent/30 rounded-xl text-accent mb-3">
                            {preferBiometrics ? (
                                <Fingerprint className="w-7 h-7" aria-hidden />
                            ) : (
                                <Lock className="w-7 h-7" aria-hidden />
                            )}
                        </div>
                        <h2 id="vault-unlock-title" className="font-display text-lg font-semibold text-surface-100">
                            {preferBiometrics ? 'Unlock with Face ID / Touch ID' : 'Authenticate to continue'}
                        </h2>
                        <p className="text-xs text-surface-400 mt-1.5 max-w-xs leading-relaxed">
                            {preferBiometrics
                                ? 'Confirm with biometrics to reveal or edit secrets. Your PIN remains available as backup.'
                                : 'Enter your PIN or use biometrics to reveal or edit secrets.'}
                        </p>
                    </div>

                    {error && (
                        <Alert tone="error" className="mb-4">
                            {error}
                        </Alert>
                    )}

                    {metadata.hasWebAuthn && (
                        <Button
                            variant="primary"
                            fullWidth
                            disabled={loading}
                            className="mb-3"
                            onClick={() => void handleBiometricUnlock()}
                        >
                            {loading && preferBiometrics && !showPinForm ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" aria-hidden />
                                    Waiting for biometrics…
                                </>
                            ) : (
                                <>
                                    <Fingerprint className="w-4 h-4" aria-hidden />
                                    Unlock with Face ID / Touch ID
                                </>
                            )}
                        </Button>
                    )}

                    {metadata.hasWebAuthn && !showPinForm && (
                        <button
                            type="button"
                            onClick={() => setShowPinForm(true)}
                            className="w-full text-center text-xs text-surface-400 hover:text-surface-200 py-2 cursor-pointer pressable"
                        >
                            Use PIN instead
                        </button>
                    )}

                    {(showPinForm || !metadata.hasWebAuthn) && (
                        <form onSubmit={e => void handlePinUnlock(e)} className="space-y-3">
                            {metadata.hasWebAuthn && (
                                <div className="flex items-center gap-3 py-1">
                                    <div className="flex-1 h-px bg-surface-700" />
                                    <span className="text-[10px] uppercase tracking-wider text-surface-500 font-mono">
                                        PIN backup
                                    </span>
                                    <div className="flex-1 h-px bg-surface-700" />
                                </div>
                            )}
                            <TextField
                                label="Security PIN"
                                trailingLabel={<Key className="w-3 h-3 text-surface-400" aria-hidden />}
                                type="password"
                                inputMode="numeric"
                                autoComplete="current-password"
                                maxLength={PIN_MAX_LENGTH}
                                value={pin}
                                onChange={e => setPin(e.target.value)}
                                placeholder="••••••"
                                autoFocus={showPinForm && !preferBiometrics}
                                className="[&_input]:font-mono [&_input]:text-center [&_input]:tracking-widest"
                            />

                            <Button type="submit" variant="secondary" fullWidth disabled={loading || !pin}>
                                {loading && showPinForm ? (
                                    <>
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden />
                                        Unlocking…
                                    </>
                                ) : (
                                    'Unlock with PIN'
                                )}
                            </Button>
                        </form>
                    )}
                </div>

                <BiometricSimulator
                    isOpen={showSimulator && simulatorEnabled}
                    onClose={() => setShowSimulator(false)}
                    onSuccess={sig => {
                        setShowSimulator(false);
                        void handleBiometricUnlock(sig);
                    }}
                    onFail={msg => setError(msg)}
                    username="vault-owner"
                    actionType="assert"
                    fallbackToPin={() => {
                        setShowSimulator(false);
                        setShowPinForm(true);
                    }}
                />
            </motion.div>
        </div>
    );
}
