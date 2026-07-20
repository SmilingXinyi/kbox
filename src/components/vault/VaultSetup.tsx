import {useState} from 'react';
import {motion} from 'motion/react';
import {AlertCircle, ChevronRight, Fingerprint, Key, Lock, RefreshCw, ShieldCheck} from 'lucide-react';
import type {VaultMetadata} from '../../types/vault';
import {
    deriveKeyFromPin,
    deriveKeyFromWebAuthnSignatureHex,
    encryptMasterKey,
    generateRandomHex
} from '../../lib/crypto';
import {isRunningInIframe, isWebAuthnSupported, registerWebAuthnCredential} from '../../lib/webauthn';

import BiometricSimulator from './BiometricSimulator';

type VaultSetupProps = {
    onInitialized: (masterKeyHex: string, metadata: VaultMetadata) => Promise<void>;
};

export default function VaultSetup({onInitialized}: VaultSetupProps) {
    const [username, setUsername] = useState('vault-owner');
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const nativeBiometricsSupported = isWebAuthnSupported() && !isRunningInIframe();
    const [enableBiometrics, setEnableBiometrics] = useState(nativeBiometricsSupported);
    const [showSimulator, setShowSimulator] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const validateForm = (): boolean => {
        setError(null);
        if (!username.trim()) {
            setError('Please provide an owner identifier.');
            return false;
        }
        if (pin.length < 4 || pin.length > 12) {
            setError('Security PIN must be 4–12 characters.');
            return false;
        }
        if (pin !== confirmPin) {
            setError('PINs do not match.');
            return false;
        }
        return true;
    };

    const handleInitialize = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        setLoading(true);
        setError(null);

        try {
            const masterKeyHex = generateRandomHex(32);
            const saltHex = generateRandomHex(16);
            const pinKek = await deriveKeyFromPin(pin, saltHex);
            const encryptedMasterWithPin = await encryptMasterKey(masterKeyHex, pinKek);

            const metadata: VaultMetadata = {
                isInitialized: true,
                hasWebAuthn: false,
                salt: saltHex,
                pinIv: encryptedMasterWithPin.iv,
                encryptedMasterKeyWithPin: encryptedMasterWithPin.ciphertext
            };

            if (enableBiometrics) {
                let signatureHex = '';
                let credentialId = '';

                if (nativeBiometricsSupported) {
                    const res = await registerWebAuthnCredential(username.trim());
                    signatureHex = res.signatureHex;
                    credentialId = res.credentialId;
                }

                if (!signatureHex || !credentialId) {
                    // Fallback to simulator
                    setShowSimulator(true);
                    setLoading(false);
                    return;
                }

                await completeWithBiometrics(masterKeyHex, metadata, signatureHex, credentialId);
            } else {
                await onInitialized(masterKeyHex, metadata);
            }
        } catch (err: unknown) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Failed to initialize the vault.');
            setLoading(false);
        }
    };

    const completeWithBiometrics = async (
        masterKeyHex: string,
        baseMetadata: VaultMetadata,
        signatureHex: string,
        credentialId: string
    ) => {
        try {
            const webauthnKek = await deriveKeyFromWebAuthnSignatureHex(signatureHex);
            const encryptedMasterWithWebAuthn = await encryptMasterKey(masterKeyHex, webauthnKek);

            const finalMetadata: VaultMetadata = {
                ...baseMetadata,
                hasWebAuthn: true,
                webauthnCredentialId: credentialId,
                webauthnIv: encryptedMasterWithWebAuthn.iv,
                encryptedMasterKeyWithWebAuthn: encryptedMasterWithWebAuthn.ciphertext
            };

            await onInitialized(masterKeyHex, finalMetadata);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Biometric enrollment failed.');
            setLoading(false);
        }
    };

    const handleSimulatorSuccess = async (simulatedSignature: string) => {
        setShowSimulator(false);
        setLoading(true);
        // During setup, we generate a random master key first
        const masterKeyHex = generateRandomHex(32);
        const saltHex = generateRandomHex(16);
        const pinKek = await deriveKeyFromPin(pin, saltHex);
        const encryptedMasterWithPin = await encryptMasterKey(masterKeyHex, pinKek);

        const baseMetadata: VaultMetadata = {
            isInitialized: true,
            hasWebAuthn: false,
            salt: saltHex,
            pinIv: encryptedMasterWithPin.iv,
            encryptedMasterKeyWithPin: encryptedMasterWithPin.ciphertext
        };

        await completeWithBiometrics(masterKeyHex, baseMetadata, simulatedSignature, 'simulated-credential-id');
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[85dvh] p-4">
            <motion.div
                initial={{opacity: 0, y: 16}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.35}}
                className="w-full max-w-md p-6 bg-surface-900 border border-surface-700 rounded-2xl"
            >
                <div className="flex flex-col items-center mb-6 text-center">
                    <p className="text-2xl font-semibold tracking-tight text-accent mb-3">kbox</p>
                    <div className="p-3 bg-accent-muted border border-accent/25 rounded-xl mb-3 text-accent">
                        <ShieldCheck className="w-8 h-8" />
                    </div>
                    <h1 className="text-xl font-semibold tracking-tight text-surface-100">Set up your vault</h1>
                    <p className="text-xs text-surface-400 mt-1.5 max-w-xs leading-relaxed">
                        End-to-end encrypted API keys, stored only on this device. Your master key never leaves the
                        browser.
                    </p>
                </div>

                {error && (
                    <div className="p-3 mb-4 bg-danger-muted border border-danger/25 text-danger text-xs rounded-lg flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span className="leading-normal">{error}</span>
                    </div>
                )}

                <form onSubmit={handleInitialize} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-surface-300 flex items-center justify-between">
                            <span>Owner name</span>
                            <span className="text-[10px] text-surface-400">For WebAuthn</span>
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder="e.g. cloud-master"
                            className="w-full px-3 py-2 bg-surface-950 border border-surface-700 rounded-lg text-sm text-surface-100 placeholder:text-surface-600 focus:outline-none focus:border-accent font-mono transition"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-surface-300 flex items-center gap-1">
                                <Key className="w-3 h-3 text-surface-400" />
                                <span>PIN</span>
                            </label>
                            <input
                                type="password"
                                maxLength={12}
                                value={pin}
                                onChange={e => setPin(e.target.value)}
                                placeholder="••••"
                                className="w-full px-3 py-2 bg-surface-950 border border-surface-700 rounded-lg text-sm text-surface-100 placeholder:text-surface-600 focus:outline-none focus:border-accent font-mono text-center tracking-widest transition"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-surface-300">Confirm PIN</label>
                            <input
                                type="password"
                                maxLength={12}
                                value={confirmPin}
                                onChange={e => setConfirmPin(e.target.value)}
                                placeholder="••••"
                                className="w-full px-3 py-2 bg-surface-950 border border-surface-700 rounded-lg text-sm text-surface-100 placeholder:text-surface-600 focus:outline-none focus:border-accent font-mono text-center tracking-widest transition"
                                required
                            />
                        </div>
                    </div>

                    <div className="p-3 bg-surface-950 rounded-lg border border-surface-700 flex items-center justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                            <Fingerprint className="w-5 h-5 text-accent mt-0.5 shrink-0" />
                            <div>
                                <h2 className="text-xs font-semibold text-surface-100">Face ID / Touch ID</h2>
                                <p className="text-[10px] text-surface-400 leading-normal mt-0.5">
                                    {nativeBiometricsSupported
                                        ? 'Wrap the master key with a platform authenticator (WebAuthn).'
                                        : 'Native biometrics unavailable — using sandbox simulator.'}
                                </p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                            <input
                                type="checkbox"
                                checked={enableBiometrics}
                                onChange={() => setEnableBiometrics(!enableBiometrics)}
                                className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-surface-700 rounded-full peer peer-checked:bg-accent peer-disabled:opacity-40 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-surface-300 peer-checked:after:bg-surface-950 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                        </label>
                    </div>

                    <div className="p-3 rounded-lg border border-surface-700/60 text-[10px] text-surface-400 leading-normal flex items-start gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-surface-400 shrink-0 mt-0.5" />
                        <span>Keys are encrypted locally. Nothing is uploaded to a server.</span>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 bg-accent hover:bg-accent-dim text-surface-950 font-medium rounded-lg text-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
                    >
                        {loading ? (
                            <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Creating vault…</span>
                            </>
                        ) : (
                            <>
                                <span>Create secure vault</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                            </>
                        )}
                    </button>
                </form>
            </motion.div>

            <BiometricSimulator
                isOpen={showSimulator}
                onClose={() => setShowSimulator(false)}
                onSuccess={handleSimulatorSuccess}
                onFail={msg => setError(msg)}
                username={username}
                actionType="register"
                fallbackToPin={() => {
                    setShowSimulator(false);
                    setEnableBiometrics(false);
                    setError('Continuing with PIN only.');
                }}
            />
        </div>
    );
}
