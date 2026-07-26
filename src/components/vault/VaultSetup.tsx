import {useState} from 'react';
import {motion} from 'motion/react';
import {ChevronRight, Fingerprint, Key, Lock, RefreshCw, ShieldCheck} from 'lucide-react';
import type {VaultMetadata, WebAuthnKeySource} from '../../types/vault';
import {
    deriveKeyFromPin,
    deriveKeyFromWebAuthnPrf,
    encryptMasterKey,
    generateRandomHex,
    hexToArrayBuffer,
    PIN_MAX_LENGTH,
    validatePinStrength
} from '../../lib/crypto';
import {isRunningInIframe, isWebAuthnSupported, registerWebAuthnCredential} from '../../lib/webauthn';
import {isBiometricSimulatorEnabled} from '../../lib/biometricSimulator';
import BiometricSimulator from './BiometricSimulator';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import TextField from '../ui/TextField';

type VaultSetupProps = {
    onInitialized: (masterKeyHex: string, metadata: VaultMetadata) => Promise<void>;
};

export default function VaultSetup({onInitialized}: VaultSetupProps) {
    const [username, setUsername] = useState('vault-owner');
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const simulatorEnabled = isBiometricSimulatorEnabled();
    const nativeBiometricsSupported = isWebAuthnSupported() && !isRunningInIframe();
    const canEnrollBiometrics = nativeBiometricsSupported || simulatorEnabled;
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
        const pinError = validatePinStrength(pin);
        if (pinError) {
            setError(pinError);
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
                if (nativeBiometricsSupported) {
                    const res = await registerWebAuthnCredential(username.trim());
                    if (res.prfOutput && res.credentialId && res.prfSaltHex) {
                        await completeWithBiometrics(
                            masterKeyHex,
                            metadata,
                            res.prfOutput,
                            res.credentialId,
                            'prf',
                            res.prfSaltHex
                        );
                        return;
                    }
                    if (res.errorMessage) {
                        if (simulatorEnabled) {
                            setError(`${res.errorMessage} Falling back to biometric sandbox.`);
                        } else {
                            setError(`${res.errorMessage} Continuing with PIN only.`);
                            await onInitialized(masterKeyHex, metadata);
                            return;
                        }
                    } else if (!simulatorEnabled) {
                        setError('Biometric enrollment failed. Continuing with PIN only.');
                        await onInitialized(masterKeyHex, metadata);
                        return;
                    }
                }

                if (simulatorEnabled) {
                    setShowSimulator(true);
                    setLoading(false);
                    return;
                }

                await onInitialized(masterKeyHex, metadata);
                return;
            }

            await onInitialized(masterKeyHex, metadata);
        } catch (err: unknown) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Failed to initialize the vault.');
            setLoading(false);
        }
    };

    const completeWithBiometrics = async (
        masterKeyHex: string,
        baseMetadata: VaultMetadata,
        prfOutput: BufferSource,
        credentialId: string,
        keySource: WebAuthnKeySource,
        prfSaltHex?: string
    ) => {
        try {
            const webauthnKek = await deriveKeyFromWebAuthnPrf(prfOutput);
            const encryptedMasterWithWebAuthn = await encryptMasterKey(masterKeyHex, webauthnKek);

            const finalMetadata: VaultMetadata = {
                ...baseMetadata,
                hasWebAuthn: true,
                webauthnCredentialId: credentialId,
                webauthnKeySource: keySource,
                webauthnPrfSalt: prfSaltHex,
                webauthnIv: encryptedMasterWithWebAuthn.iv,
                encryptedMasterKeyWithWebAuthn: encryptedMasterWithWebAuthn.ciphertext
            };

            await onInitialized(masterKeyHex, finalMetadata);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Biometric enrollment failed.');
            setLoading(false);
        }
    };

    const handleSimulatorSuccess = async (simulatedKeyMaterialHex: string) => {
        setShowSimulator(false);
        setLoading(true);
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

        await completeWithBiometrics(
            masterKeyHex,
            baseMetadata,
            hexToArrayBuffer(simulatedKeyMaterialHex),
            'simulated-credential-id',
            'simulated'
        );
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-dvh p-4 safe-pt safe-pb">
            <motion.div
                initial={{opacity: 0, y: 16}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.35, ease: [0.23, 1, 0.32, 1]}}
                className="w-full max-w-md overflow-hidden bg-surface-900 border border-surface-700 rounded-2xl"
            >
                <div className="h-1.5 hazard-stripe" aria-hidden />

                <div className="p-5 sm:p-6">
                    <div className="flex flex-col items-center mb-6 text-center">
                        <img
                            src={`${import.meta.env.BASE_URL}kbox.svg`}
                            alt="KBox"
                            className="h-8 w-auto mb-4"
                            width={124}
                            height={36}
                            decoding="async"
                        />
                        <div className="p-3 bg-accent-muted border border-accent/30 rounded-xl mb-3 text-accent">
                            <ShieldCheck className="w-8 h-8" aria-hidden />
                        </div>
                        <h1 className="font-display text-xl font-semibold tracking-tight text-surface-100">
                            Set up your vault
                        </h1>
                        <p className="text-xs text-surface-400 mt-1.5 max-w-xs leading-relaxed">
                            End-to-end encrypted API keys, stored only on this device. Your master key never leaves the
                            browser.
                        </p>
                    </div>

                    {error && (
                        <Alert tone="error" className="mb-4">
                            {error}
                        </Alert>
                    )}

                    <form onSubmit={handleInitialize} className="space-y-4">
                        <TextField
                            label="Owner name"
                            trailingLabel="For WebAuthn"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder="e.g. cloud-master"
                            className="[&_input]:font-mono"
                            required
                        />

                        <div className="grid grid-cols-2 gap-3">
                            <TextField
                                label="PIN"
                                trailingLabel={<Key className="w-3 h-3 text-surface-400" aria-hidden />}
                                type="password"
                                inputMode="numeric"
                                autoComplete="new-password"
                                maxLength={PIN_MAX_LENGTH}
                                value={pin}
                                onChange={e => setPin(e.target.value)}
                                placeholder="••••••"
                                className="[&_input]:font-mono [&_input]:text-center [&_input]:tracking-widest"
                                required
                            />
                            <TextField
                                label="Confirm PIN"
                                type="password"
                                inputMode="numeric"
                                autoComplete="new-password"
                                maxLength={PIN_MAX_LENGTH}
                                value={confirmPin}
                                onChange={e => setConfirmPin(e.target.value)}
                                placeholder="••••••"
                                className="[&_input]:font-mono [&_input]:text-center [&_input]:tracking-widest"
                                required
                            />
                        </div>

                        <div className="p-3 bg-surface-950 rounded-lg border border-surface-700 flex items-center justify-between gap-3">
                            <div className="flex items-start gap-2.5 min-w-0">
                                <Fingerprint className="w-5 h-5 text-accent mt-0.5 shrink-0" aria-hidden />
                                <div>
                                    <h2 className="text-xs font-semibold text-surface-100">Face ID / Touch ID</h2>
                                    <p className="text-[11px] text-surface-400 leading-normal mt-0.5">
                                        {nativeBiometricsSupported
                                            ? 'Wrap the master key with WebAuthn PRF.'
                                            : simulatorEnabled
                                              ? 'Native biometrics unavailable — DEV sandbox simulator can be used.'
                                              : 'Native biometrics unavailable on this device. Use your PIN.'}
                                    </p>
                                </div>
                            </div>
                            <label
                                className={`relative inline-flex items-center select-none shrink-0 min-h-11 px-1 ${
                                    canEnrollBiometrics ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={enableBiometrics && canEnrollBiometrics}
                                    onChange={() => {
                                        if (!canEnrollBiometrics) return;
                                        setEnableBiometrics(!enableBiometrics);
                                    }}
                                    disabled={!canEnrollBiometrics}
                                    className="sr-only peer"
                                    aria-label="Enable biometrics"
                                />
                                <span className="relative w-10 h-6 bg-surface-700 rounded-full peer-checked:bg-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent transition-colors peer-disabled:opacity-80">
                                    <span
                                        className={`absolute top-1 left-1 h-4 w-4 rounded-full transition-transform ${
                                            enableBiometrics && canEnrollBiometrics
                                                ? 'translate-x-4 bg-on-accent'
                                                : 'translate-x-0 bg-surface-300'
                                        }`}
                                    />
                                </span>
                            </label>
                        </div>

                        <div className="p-3 rounded-lg border border-surface-700/70 text-[11px] text-surface-400 leading-relaxed flex items-start gap-2">
                            <Lock className="w-3.5 h-3.5 text-surface-400 shrink-0 mt-0.5" aria-hidden />
                            <span>
                                Secret values are encrypted locally with your PIN (and optional biometrics). Labels and
                                tags stay readable while locked.
                            </span>
                        </div>

                        <Button type="submit" fullWidth disabled={loading}>
                            {loading ? (
                                <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden />
                                    Creating vault…
                                </>
                            ) : (
                                <>
                                    Create secure vault
                                    <ChevronRight className="w-3.5 h-3.5" aria-hidden />
                                </>
                            )}
                        </Button>
                    </form>
                </div>
            </motion.div>

            <BiometricSimulator
                isOpen={showSimulator && simulatorEnabled}
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
