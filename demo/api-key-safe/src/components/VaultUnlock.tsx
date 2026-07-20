import React, {useState, useEffect} from 'react';
import {motion} from 'motion/react';
import {Lock, Fingerprint, RefreshCw, Key, AlertCircle, HelpCircle, ArrowRight} from 'lucide-react';
import {deriveKeyFromPin, decryptMasterKey} from '../lib/crypto';
import {getWebAuthnAssertion} from '../lib/webauthn';
import BiometricSimulator from './BiometricSimulator';
import {VaultMetadata} from '../types';

interface VaultUnlockProps {
    metadata: VaultMetadata;
    onUnlock: (masterKeyHex: string) => void;
    onReset: () => void;
    isModal?: boolean;
    onClose?: () => void;
}

export default function VaultUnlock({metadata, onUnlock, onReset, isModal = false, onClose}: VaultUnlockProps) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showSimulator, setShowSimulator] = useState(false);
    const [confirmReset, setConfirmReset] = useState(false);

    // Auto-trigger biometrics on load if enabled
    useEffect(() => {
        if (metadata.hasWebAuthn) {
            handleBiometricUnlock();
        }
    }, [metadata]);

    const handleBiometricUnlock = async () => {
        setError(null);
        if (!metadata.hasWebAuthn || !metadata.webauthnCredentialId) return;

        try {
            const res = await getWebAuthnAssertion(metadata.webauthnCredentialId);

            if (res.isSimulated) {
                setShowSimulator(true);
                return;
            }

            // Real WebAuthn assertion signature success
            await unlockWithSignature(res.signatureHex);
        } catch (err: any) {
            console.warn(err);
            setError('Biometric authentication failed. Please use your PIN.');
        }
    };

    const unlockWithSignature = async (signatureHex: string) => {
        setLoading(true);
        try {
            const webauthnKek = await importWebAuthnKeyFromHex(signatureHex);
            if (!metadata.encryptedMasterKeyWithWebAuthn || !metadata.webauthnIv) {
                throw new Error('Biometric configuration is missing on this device.');
            }

            const masterKeyHex = await decryptMasterKey(
                metadata.encryptedMasterKeyWithWebAuthn,
                metadata.webauthnIv,
                webauthnKek
            );

            onUnlock(masterKeyHex);
        } catch (err: any) {
            console.error(err);
            setError('Cryptographic mismatch. Biometric signature could not decrypt the vault.');
        } finally {
            setLoading(false);
        }
    };

    const handlePinUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!pin) return;

        setLoading(true);
        try {
            // Derive PIN Key Encryption Key using salt and entered PIN
            const pinKek = await deriveKeyFromPin(pin, metadata.salt);

            // Attempt to decrypt the master key
            const masterKeyHex = await decryptMasterKey(metadata.encryptedMasterKeyWithPin, metadata.pinIv, pinKek);

            // If successful, trigger unlock
            onUnlock(masterKeyHex);
        } catch (err: any) {
            console.warn('PIN Decryption failure:', err);
            setError('Incorrect Security PIN. Cryptographic decryption failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleSimulatorSuccess = async (fakeSignatureHex: string) => {
        setShowSimulator(false);
        await unlockWithSignature(fakeSignatureHex);
    };

    const handleSimulatorFail = (err: string) => {
        setShowSimulator(false);
        setError(`${err} Please enter your backup Security PIN.`);
    };

    const importWebAuthnKeyFromHex = async (signatureHex: string): Promise<CryptoKey> => {
        const encoder = new TextEncoder();
        const signatureBytes = encoder.encode(signatureHex);
        const hash = await window.crypto.subtle.digest('SHA-256', signatureBytes);
        return window.crypto.subtle.importKey('raw', hash, {name: 'AES-GCM', length: 256}, false, [
            'encrypt',
            'decrypt'
        ]);
    };

    const cardElement = (
        <motion.div
            id="vault-unlock-card"
            initial={{opacity: 0, scale: 0.96}}
            animate={{opacity: 1, scale: 1}}
            transition={{duration: 0.3}}
            className="w-full max-w-md p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl shadow-slate-950/50 relative"
        >
            {isModal && onClose && (
                <button
                    id="close-unlock-modal-button"
                    type="button"
                    onClick={onClose}
                    className="absolute top-4 right-4 text-xs font-semibold px-2.5 py-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition cursor-pointer"
                >
                    Cancel
                </button>
            )}

            <div className="flex flex-col items-center mb-6 text-center">
                <div className="relative mb-3">
                    <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                        <Lock className="w-7 h-7" />
                    </div>
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                    </span>
                </div>
                <h2 className="text-xl font-bold tracking-tight text-slate-100">Vault Locked</h2>
                <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                    Authenticate using your device biometrics or Security PIN to decrypt and reveal your secrets.
                </p>
            </div>

            {error && (
                <div className="p-3 mb-4 bg-rose-950/40 border border-rose-500/20 text-rose-300 text-xs rounded-lg flex flex-col space-y-1.5">
                    <div className="flex items-start space-x-2">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span className="leading-normal">{error}</span>
                    </div>
                    {error.toLowerCase().includes('cryptographic mismatch') && (
                        <p className="text-[10px] text-slate-400 pl-6 leading-relaxed">
                            Tip: Since the simulator signature has been updated to be fully stable, please unlock using
                            your backup PIN or click{' '}
                            <strong className="text-rose-400">"Reset Vault & Delete Data"</strong> below to register a
                            fresh stable credentials profile.
                        </p>
                    )}
                </div>
            )}

            {/* Biometric Trigger State (large button if active) */}
            {metadata.hasWebAuthn && (
                <div className="flex flex-col items-center p-4 bg-slate-950 rounded-xl border border-slate-800 mb-4 text-center">
                    <button
                        id="biometric-trigger-icon-button"
                        onClick={handleBiometricUnlock}
                        className="p-4 bg-indigo-500 hover:bg-indigo-600 text-slate-950 rounded-full cursor-pointer hover:scale-105 active:scale-95 transition duration-200 shadow-lg shadow-indigo-500/10 mb-2.5"
                        title="Unlock with biometrics"
                    >
                        <Fingerprint className="w-8 h-8" />
                    </button>
                    <span className="text-xs font-semibold text-slate-300">Biometrics Enabled</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">Click to activate Face ID / Touch ID</span>
                </div>
            )}

            {/* PIN Form */}
            <form onSubmit={handlePinUnlock} className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                        <span className="flex items-center space-x-1">
                            <Key className="w-3.5 h-3.5 text-slate-500" />
                            <span>Unlock with PIN</span>
                        </span>
                        {metadata.hasWebAuthn && (
                            <span className="text-[10px] text-slate-500 font-mono">PIN is secure backup</span>
                        )}
                    </label>
                    <div className="flex space-x-2">
                        <input
                            id="unlock-pin-input"
                            type="password"
                            maxLength={12}
                            value={pin}
                            onChange={e => setPin(e.target.value)}
                            placeholder="Enter PIN..."
                            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-center tracking-widest transition"
                            required
                            disabled={loading}
                        />
                        <button
                            id="unlock-pin-submit-button"
                            type="submit"
                            disabled={loading || !pin}
                            className="px-4 bg-indigo-500 hover:bg-indigo-600 text-slate-950 font-medium rounded-lg text-xs flex items-center justify-center transition cursor-pointer disabled:opacity-50"
                        >
                            {loading ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <ArrowRight className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex flex-col space-y-2">
                    {!confirmReset ? (
                        <div className="flex items-center justify-between w-full">
                            <button
                                id="reset-vault-button"
                                type="button"
                                onClick={() => setConfirmReset(true)}
                                className="text-[10px] text-rose-500 hover:text-rose-400 font-semibold transition cursor-pointer"
                            >
                                Reset Vault & Delete Data
                            </button>
                            <span className="text-[10px] text-slate-500 flex items-center space-x-1">
                                <HelpCircle className="w-3 h-3" />
                                <span>Full local security</span>
                            </span>
                        </div>
                    ) : (
                        <div className="p-2.5 bg-rose-950/20 border border-rose-500/20 rounded-lg space-y-2 text-left">
                            <p className="text-[10px] text-rose-300 leading-relaxed font-medium">
                                Are you absolutely sure? This will permanently delete all stored encrypted API keys from
                                this browser session. There is NO backup!
                            </p>
                            <div className="flex items-center space-x-2">
                                <button
                                    id="confirm-reset-vault-button"
                                    type="button"
                                    onClick={onReset}
                                    className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold transition cursor-pointer"
                                >
                                    Yes, Reset & Wipe All
                                </button>
                                <button
                                    id="cancel-reset-vault-button"
                                    type="button"
                                    onClick={() => setConfirmReset(false)}
                                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-medium transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </form>
        </motion.div>
    );

    return (
        <>
            {isModal ? (
                <div className="w-full max-w-md">{cardElement}</div>
            ) : (
                <div className="flex flex-col items-center justify-center min-h-[85vh] p-4 font-sans text-slate-100">
                    {cardElement}
                </div>
            )}

            {/* Simulated webauthn overlay */}
            <BiometricSimulator
                isOpen={showSimulator}
                onClose={() => setShowSimulator(false)}
                onSuccess={handleSimulatorSuccess}
                onFail={handleSimulatorFail}
                username="Security-User"
                actionType="assert"
                fallbackToPin={() => {
                    setShowSimulator(false);
                    setError('Use fallback PIN below.');
                }}
            />
        </>
    );
}
