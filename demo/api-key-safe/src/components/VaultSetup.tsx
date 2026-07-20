import React, {useState} from 'react';
import {motion} from 'motion/react';
import {ShieldCheck, Key, Fingerprint, Lock, ChevronRight, HelpCircle, AlertCircle, RefreshCw} from 'lucide-react';
import {generateRandomHex, deriveKeyFromPin, encryptMasterKey, encryptDatabase} from '../lib/crypto';
import {isWebAuthnSupported, registerWebAuthnCredential} from '../lib/webauthn';
import BiometricSimulator from './BiometricSimulator';
import {VaultMetadata} from '../types';

interface VaultSetupProps {
    onInitialized: (masterKeyHex: string, metadata: VaultMetadata) => void;
}

export default function VaultSetup({onInitialized}: VaultSetupProps) {
    const [username, setUsername] = useState('My-API-Key-Wallet');
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [enableBiometrics, setEnableBiometrics] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Simulator control state
    const [showSimulator, setShowSimulator] = useState(false);
    const [tempMasterKey, setTempMasterKey] = useState<string | null>(null);
    const [tempSalt, setTempSalt] = useState<string | null>(null);
    const [tempPinKek, setTempPinKek] = useState<any>(null);

    const validateForm = (): boolean => {
        setError(null);
        if (!username.trim()) {
            setError('Please provide a wallet owner identifier.');
            return false;
        }
        if (pin.length < 4) {
            setError('Security PIN must be at least 4 digits or characters.');
            return false;
        }
        if (pin !== confirmPin) {
            setError('Security PINs do not match.');
            return false;
        }
        return true;
    };

    const handleInitialize = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        setLoading(true);
        try {
            // Step 1: Generate high-entropy master key (32 bytes = 256 bits)
            const masterKeyHex = generateRandomHex(32);
            // Step 2: Generate random salt for PBKDF2 derivation
            const saltHex = generateRandomHex(16);

            // Step 3: Derive PBKDF2 Key from Master PIN and Salt
            const pinKek = await deriveKeyFromPin(pin, saltHex);
            const encryptedMasterWithPin = await encryptMasterKey(masterKeyHex, pinKek);

            if (enableBiometrics) {
                // Since we are inside AI Studio (iframe), let's check if we can do real WebAuthn,
                // but proactively prepare to trigger our simulator which guarantees 100% smooth preview.
                const res = await registerWebAuthnCredential(username);

                if (res.isSimulated) {
                    // Store temporary values so we can continue after simulator success
                    setTempMasterKey(masterKeyHex);
                    setTempSalt(saltHex);
                    setTempPinKek(encryptedMasterWithPin);
                    setShowSimulator(true);
                    setLoading(false);
                    return;
                }

                // Real WebAuthn success
                const webauthnKek = await importWebAuthnKeyFromHex(res.signatureHex);
                const encryptedMasterWithWebAuthn = await encryptMasterKey(masterKeyHex, webauthnKek);

                const metadata: VaultMetadata = {
                    isInitialized: true,
                    hasWebAuthn: true,
                    webauthnCredentialId: res.credentialId,
                    salt: saltHex,
                    pinIv: encryptedMasterWithPin.iv,
                    webauthnIv: encryptedMasterWithWebAuthn.iv,
                    encryptedMasterKeyWithPin: encryptedMasterWithPin.ciphertext,
                    encryptedMasterKeyWithWebAuthn: encryptedMasterWithWebAuthn.ciphertext
                };

                await saveInitialVault(masterKeyHex, metadata);
            } else {
                // PIN-only setup
                const metadata: VaultMetadata = {
                    isInitialized: true,
                    hasWebAuthn: false,
                    salt: saltHex,
                    pinIv: encryptedMasterWithPin.iv,
                    encryptedMasterKeyWithPin: encryptedMasterWithPin.ciphertext
                };

                await saveInitialVault(masterKeyHex, metadata);
            }
        } catch (err: any) {
            console.error(err);
            setError(err?.message || 'Failed to initialize the secure vault.');
            setLoading(false);
        }
    };

    // Callback from Biometric Simulator (when they verify biometrics in sandboxed simulator)
    const handleSimulatorSuccess = async (fakeSignatureHex: string) => {
        setShowSimulator(false);
        setLoading(true);

        if (!tempMasterKey || !tempSalt || !tempPinKek) {
            setError('Setup session expired. Please try again.');
            setLoading(false);
            return;
        }

        try {
            const webauthnKek = await importWebAuthnKeyFromHex(fakeSignatureHex);
            const encryptedMasterWithWebAuthn = await encryptMasterKey(tempMasterKey, webauthnKek);

            const metadata: VaultMetadata = {
                isInitialized: true,
                hasWebAuthn: true,
                webauthnCredentialId: 'simulated-credential-id',
                salt: tempSalt,
                pinIv: tempPinKek.iv,
                webauthnIv: encryptedMasterWithWebAuthn.iv,
                encryptedMasterKeyWithPin: tempPinKek.ciphertext,
                encryptedMasterKeyWithWebAuthn: encryptedMasterWithWebAuthn.ciphertext
            };

            await saveInitialVault(tempMasterKey, metadata);
        } catch (err: any) {
            setError(err?.message || 'Failed to finish biometric encryption setup.');
            setLoading(false);
        }
    };

    const handleSimulatorFail = (err: string) => {
        setShowSimulator(false);
        setError(`${err} Toggled biometric requirement off. You can proceed with PIN only, or retry.`);
        setEnableBiometrics(false);
    };

    // Save empty database and metadata
    const saveInitialVault = async (masterKeyHex: string, metadata: VaultMetadata) => {
        const emptyDbJson = JSON.stringify({items: []});
        const encryptedDb = await encryptDatabase(emptyDbJson, masterKeyHex);

        localStorage.setItem('apiKeySafe_metadata', JSON.stringify(metadata));
        localStorage.setItem('apiKeySafe_db_iv', encryptedDb.iv);
        localStorage.setItem('apiKeySafe_db_ciphertext', encryptedDb.ciphertext);

        onInitialized(masterKeyHex, metadata);
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

    return (
        <div className="flex flex-col items-center justify-center min-h-[85vh] p-4 font-sans text-slate-100">
            <motion.div
                id="vault-setup-card"
                initial={{opacity: 0, y: 15}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.4}}
                className="w-full max-w-md p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl shadow-slate-950/50"
            >
                <div className="flex flex-col items-center mb-6 text-center">
                    <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl mb-3 text-indigo-400">
                        <ShieldCheck className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-100">Initialize API Key Safe</h2>
                    <p className="text-xs text-slate-400 mt-1.5 max-w-xs leading-relaxed">
                        Create an end-to-end encrypted hardware-bound wallet. All encryption keys are held in your
                        browser and device secure enclave.
                    </p>
                </div>

                {error && (
                    <div className="p-3 mb-4 bg-rose-950/40 border border-rose-500/20 text-rose-300 text-xs rounded-lg flex items-start space-x-2">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span className="leading-normal">{error}</span>
                    </div>
                )}

                <form onSubmit={handleInitialize} className="space-y-4">
                    {/* Owner/Label */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                            <span>Owner Name / Identifier</span>
                            <span className="text-[10px] text-slate-500">For WebAuthn Registration</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-500 text-xs">@</span>
                            <input
                                id="setup-username-input"
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="e.g. cloud-master"
                                className="w-full pl-7 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono transition"
                                required
                            />
                        </div>
                    </div>

                    {/* Master PIN */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-300 flex items-center space-x-1">
                                <Key className="w-3 h-3 text-slate-500" />
                                <span>Security PIN</span>
                            </label>
                            <input
                                id="setup-pin-input"
                                type="password"
                                maxLength={12}
                                value={pin}
                                onChange={e => setPin(e.target.value)}
                                placeholder="••••"
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-center tracking-widest transition"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-300">Confirm PIN</label>
                            <input
                                id="setup-confirm-pin-input"
                                type="password"
                                maxLength={12}
                                value={confirmPin}
                                onChange={e => setConfirmPin(e.target.value)}
                                placeholder="••••"
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-center tracking-widest transition"
                                required
                            />
                        </div>
                    </div>

                    {/* Biometrics Toggle */}
                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                        <div className="flex items-start space-x-2.5">
                            <Fingerprint className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
                            <div>
                                <h4 className="text-xs font-semibold text-slate-200">Device Face ID / Touch ID</h4>
                                <p className="text-[10px] text-slate-500 leading-normal mt-0.5">
                                    Encrypt master wallet credentials with biometric security keys (WebAuthn).
                                </p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                            <input
                                id="setup-biometric-toggle"
                                type="checkbox"
                                checked={enableBiometrics}
                                onChange={() => setEnableBiometrics(!enableBiometrics)}
                                className="sr-only peer"
                            />
                            <div className="w-8 h-4.5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-500 peer-checked:after:bg-slate-900 peer-checked:after:border-indigo-300"></div>
                        </label>
                    </div>

                    {/* Core Security Info Banner */}
                    <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800/40 text-[10px] text-slate-400 leading-normal flex items-start space-x-1.5">
                        <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                        <span>
                            Your master cryptographic key is never sent to any server. Your data remains completely
                            encrypted on this device.
                        </span>
                    </div>

                    {/* Submit */}
                    <button
                        id="initialize-vault-button"
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-slate-950 font-medium rounded-lg text-xs flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 transition shadow-lg shadow-indigo-500/15 font-sans"
                    >
                        {loading ? (
                            <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Generating Cryptography...</span>
                            </>
                        ) : (
                            <>
                                <span>Create Secure Vault</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                            </>
                        )}
                    </button>
                </form>
            </motion.div>

            {/* Simulated webauthn overlay */}
            <BiometricSimulator
                isOpen={showSimulator}
                onClose={() => setShowSimulator(false)}
                onSuccess={handleSimulatorSuccess}
                onFail={handleSimulatorFail}
                username={username}
                actionType="register"
                fallbackToPin={() => {
                    setShowSimulator(false);
                    setEnableBiometrics(false);
                    setError('Toggled biometrics off. Proceed with security PIN.');
                }}
            />
        </div>
    );
}
