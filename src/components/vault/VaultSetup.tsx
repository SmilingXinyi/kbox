import {useState, type ReactNode} from 'react';
import {motion} from 'motion/react';
import {ChevronRight, Cloud, FileKey, Fingerprint, Key, Lock, Plus, RefreshCw, type LucideIcon} from 'lucide-react';
import type {ApiKeyItem, VaultMetadata, WebAuthnKeySource} from '../../types/vault';
import type {UseCloudSyncReturn} from '../../hooks/useCloudSync';
import {
    deriveKeyFromPin,
    deriveKeyFromWebAuthnPrf,
    encryptMasterKey,
    generateRandomHex,
    hexToArrayBuffer,
    PIN_MAX_LENGTH,
    validatePinStrength
} from '../../lib/crypto';
import {
    isRunningInIframe,
    isWebAuthnSupported,
    registerWebAuthnCredential,
    WEBAUTHN_USER_NAME
} from '../../lib/webauthn';
import {isBiometricSimulatorEnabled} from '../../lib/biometricSimulator';
import BiometricSimulator from './BiometricSimulator';
import VaultRestore from './VaultBackup';
import VaultCloudSync from './VaultCloudSync';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import TextField from '../ui/TextField';

type VaultSetupProps = {
    onInitialized: (masterKeyHex: string, metadata: VaultMetadata) => Promise<void>;
    onRestored: (masterKeyHex: string, metadata: VaultMetadata, items: ApiKeyItem[]) => Promise<void>;
    cloud: UseCloudSyncReturn;
};

type SetupMode = 'choose' | 'create' | 'existing' | 'restore' | 'cloud';

function SetupFrame({children, align = 'center'}: {children: ReactNode; align?: 'center' | 'start'}) {
    return (
        <div
            className={`flex flex-col items-center ${align === 'start' ? 'justify-start' : 'justify-center'} min-h-full p-4 safe-pt safe-pb overflow-y-auto overscroll-y-contain`}
        >
            <motion.div
                initial={{opacity: 0, y: 16}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.35, ease: [0.23, 1, 0.32, 1]}}
                className="w-full max-w-md overflow-hidden bg-surface-900 border border-surface-700 rounded-2xl"
            >
                <div className="h-1.5 hazard-stripe" aria-hidden />
                <div className="p-5 sm:p-6">{children}</div>
            </motion.div>
        </div>
    );
}

function SetupPathButton({
    icon: Icon,
    title,
    hint,
    onClick
}: {
    icon: LucideIcon;
    title: string;
    hint: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full flex items-start gap-3 p-3 min-h-14 rounded-lg border border-surface-700 hover:border-accent/40 hover:bg-accent-muted text-left cursor-pointer pressable transition"
        >
            <Icon className="w-4 h-4 text-accent mt-0.5 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
                <span className="block text-sm text-surface-100">{title}</span>
                <span className="block text-[11px] text-surface-400 mt-0.5 leading-relaxed">{hint}</span>
            </span>
            <ChevronRight className="w-4 h-4 text-surface-500 mt-0.5 shrink-0" aria-hidden />
        </button>
    );
}

function SetupBrand({title, description}: {title: string; description: string}) {
    return (
        <div className="flex flex-col items-center mb-6 text-center">
            <img
                src={`${import.meta.env.BASE_URL}kbox.webp`}
                alt="KBox"
                className="h-16 w-16 mb-4 rounded-2xl object-cover"
                width={64}
                height={64}
                decoding="async"
            />
            <h1 className="font-display text-xl font-semibold tracking-tight text-surface-100">{title}</h1>
            <p className="text-xs text-surface-400 mt-1.5 max-w-xs leading-relaxed">{description}</p>
        </div>
    );
}

export default function VaultSetup({onInitialized, onRestored, cloud}: VaultSetupProps) {
    const [mode, setMode] = useState<SetupMode>('choose');
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const simulatorEnabled = isBiometricSimulatorEnabled();
    const nativeBiometricsSupported = isWebAuthnSupported() && !isRunningInIframe();
    const canEnrollBiometrics = nativeBiometricsSupported || simulatorEnabled;
    const [enableBiometrics, setEnableBiometrics] = useState(canEnrollBiometrics);
    const [showSimulator, setShowSimulator] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const validateForm = (): boolean => {
        setError(null);
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
                    const res = await registerWebAuthnCredential();
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

    if (mode === 'choose') {
        return (
            <SetupFrame>
                <SetupBrand
                    title="Welcome to kbox"
                    description="End-to-end encrypted API keys. No kbox server. Choose how this device should start."
                />
                <div className="space-y-2">
                    <SetupPathButton
                        icon={Plus}
                        title="Create a new vault"
                        hint="Set a PIN and optional Face ID on this device."
                        onClick={() => setMode('create')}
                    />
                    <SetupPathButton
                        icon={FileKey}
                        title="I already have a vault"
                        hint="Bring it here with a recovery file or Google Drive."
                        onClick={() => setMode('existing')}
                    />
                </div>
            </SetupFrame>
        );
    }

    if (mode === 'existing') {
        return (
            <SetupFrame>
                <SetupBrand
                    title="Bring your vault here"
                    description="Open a recovery file or pull the Google Drive copy. That becomes the vault on this device."
                />
                <div className="space-y-2">
                    <SetupPathButton
                        icon={FileKey}
                        title="Recovery file"
                        hint="Decrypt a .kboxbackup, then set a PIN for this device."
                        onClick={() => setMode('restore')}
                    />
                    <SetupPathButton
                        icon={Cloud}
                        title="Google Drive"
                        hint="Pull the encrypted copy. Use the vault PIN from the device that pushed it."
                        onClick={() => setMode('cloud')}
                    />
                </div>
                <Button type="button" variant="ghost" fullWidth className="mt-4" onClick={() => setMode('choose')}>
                    Back
                </Button>
            </SetupFrame>
        );
    }

    if (mode === 'cloud') {
        return (
            <SetupFrame align="start">
                <VaultCloudSync cloud={cloud} variant="setup" />
                <Button type="button" variant="ghost" fullWidth onClick={() => setMode('existing')}>
                    Back
                </Button>
            </SetupFrame>
        );
    }

    if (mode === 'restore') {
        return (
            <div className="flex flex-col items-center justify-center min-h-full p-4 safe-pt safe-pb overflow-y-auto overscroll-y-contain">
                <motion.div
                    initial={{opacity: 0, y: 16}}
                    animate={{opacity: 1, y: 0}}
                    transition={{duration: 0.35, ease: [0.23, 1, 0.32, 1]}}
                    className="w-full max-w-md"
                >
                    <VaultRestore onRestored={onRestored} onCancel={() => setMode('existing')} />
                </motion.div>
            </div>
        );
    }

    return (
        <SetupFrame>
            <button
                type="button"
                onClick={() => {
                    setError(null);
                    setMode('choose');
                }}
                className="text-xs text-surface-400 hover:text-surface-200 mb-4 cursor-pointer pressable"
            >
                Back
            </button>
            <SetupBrand
                title="Create a new vault"
                description="Your master key stays in this browser. PIN unlocks this device; Face ID is optional and stays here."
            />

            {error && (
                <Alert tone="error" className="mb-4">
                    {error}
                </Alert>
            )}

            <form onSubmit={handleInitialize} className="space-y-4">
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

                <div className="p-3 bg-surface-950 rounded-lg border border-accent/35 flex items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                        <Fingerprint className="w-5 h-5 text-accent mt-0.5 shrink-0" aria-hidden />
                        <div>
                            <h2 className="text-xs font-semibold text-surface-100">
                                Face ID / Touch ID
                                {canEnrollBiometrics ? (
                                    <span className="ml-1.5 text-[10px] font-normal text-accent">Recommended</span>
                                ) : null}
                            </h2>
                            <p className="text-[11px] text-surface-400 leading-normal mt-0.5">
                                {nativeBiometricsSupported
                                    ? 'Preferred unlock. PIN stays as backup recovery on this device.'
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
                        Secret values are encrypted locally with your PIN (and optional biometrics). Labels and tags
                        stay readable while locked.
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

            <BiometricSimulator
                isOpen={showSimulator && simulatorEnabled}
                onClose={() => setShowSimulator(false)}
                onSuccess={handleSimulatorSuccess}
                onFail={msg => setError(msg)}
                username={WEBAUTHN_USER_NAME}
                actionType="register"
                fallbackToPin={() => {
                    setShowSimulator(false);
                    setEnableBiometrics(false);
                    setError('Continuing with PIN only.');
                }}
            />
        </SetupFrame>
    );
}
