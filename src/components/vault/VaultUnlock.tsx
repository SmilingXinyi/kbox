import {useState} from 'react';
import {motion} from 'motion/react';
import {AlertCircle, Fingerprint, Key, Lock, RefreshCw, X} from 'lucide-react';
import type {VaultMetadata, ResidualUnlockResult} from '../../types/vault';
import {PIN_MAX_LENGTH} from '../../lib/crypto';
import BiometricSimulator from './BiometricSimulator';

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

    const handleBiometricUnlock = async (simulatedKeyMaterialHex?: string) => {
        setError(null);
        setLoading(true);
        try {
            const residual = await onUnlockWithWebAuthn(simulatedKeyMaterialHex);
            if (residual) onResidualAction?.(residual);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Biometric authentication failed.';
            if (
                msg.includes('iframe') ||
                msg.includes('not supported') ||
                msg.includes('not initialized') ||
                msg.includes('sandbox required')
            ) {
                setShowSimulator(true);
            } else {
                setError(`${msg} Try your PIN.`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-950/80 backdrop-blur-sm">
            <motion.div
                initial={{opacity: 0, scale: 0.97}}
                animate={{opacity: 1, scale: 1}}
                transition={{duration: 0.25}}
                className="w-full max-w-md p-6 bg-surface-900 border border-surface-700 rounded-2xl relative"
            >
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 text-surface-400 hover:text-surface-100 hover:bg-surface-800 rounded-lg transition cursor-pointer"
                    aria-label="Cancel"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="flex flex-col items-center mb-6 text-center">
                    <div className="p-3.5 bg-accent-muted border border-accent/25 rounded-xl text-accent mb-3">
                        <Lock className="w-7 h-7" />
                    </div>
                    <h2 className="text-lg font-semibold text-surface-100">Authenticate to continue</h2>
                    <p className="text-xs text-surface-400 mt-1.5 max-w-xs leading-relaxed">
                        Enter your PIN or use biometrics to reveal or edit secrets.
                    </p>
                </div>

                {error && (
                    <div className="p-3 mb-4 bg-danger-muted border border-danger/25 text-danger text-xs rounded-lg flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {metadata.hasWebAuthn && (
                    <button
                        type="button"
                        disabled={loading}
                        onClick={() => void handleBiometricUnlock()}
                        className="w-full mb-3 py-2.5 bg-surface-800 hover:bg-surface-700 border border-surface-600 text-surface-100 rounded-lg text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition"
                    >
                        <Fingerprint className="w-4 h-4 text-accent" />
                        <span>Unlock with biometrics</span>
                    </button>
                )}

                <form onSubmit={handlePinUnlock} className="space-y-3">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-surface-300 flex items-center gap-1">
                            <Key className="w-3 h-3 text-surface-400" />
                            <span>Security PIN</span>
                        </label>
                        <input
                            type="password"
                            maxLength={PIN_MAX_LENGTH}
                            value={pin}
                            onChange={e => setPin(e.target.value)}
                            placeholder="••••••"
                            autoFocus
                            className="w-full px-3 py-2 bg-surface-950 border border-surface-700 rounded-lg text-sm text-surface-100 placeholder:text-surface-600 focus:outline-none focus:border-accent font-mono text-center tracking-widest transition"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !pin}
                        className="w-full py-2.5 bg-accent hover:bg-accent-dim text-surface-950 font-medium rounded-lg text-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
                    >
                        {loading ? (
                            <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Unlocking…</span>
                            </>
                        ) : (
                            <span>Unlock</span>
                        )}
                    </button>
                </form>

                <BiometricSimulator
                    isOpen={showSimulator}
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
                    }}
                />
            </motion.div>
        </div>
    );
}
