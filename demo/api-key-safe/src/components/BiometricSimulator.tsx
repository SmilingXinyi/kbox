import React, {useState, useEffect} from 'react';
import {motion, AnimatePresence} from 'motion/react';
import {Fingerprint, ShieldAlert, Cpu, Check, AlertTriangle, Key} from 'lucide-react';

interface BiometricSimulatorProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (simulatedSignature: string) => void;
    onFail: (errorMsg: string) => void;
    username: string;
    actionType: 'register' | 'assert';
    fallbackToPin: () => void;
}

export default function BiometricSimulator({
    isOpen,
    onClose,
    onSuccess,
    onFail,
    username,
    actionType,
    fallbackToPin
}: BiometricSimulatorProps) {
    const [logs, setLogs] = useState<string[]>([]);
    const [status, setStatus] = useState<'idle' | 'scanning' | 'success' | 'failed'>('idle');
    const [scanProgress, setScanProgress] = useState(0);

    useEffect(() => {
        if (isOpen) {
            setStatus('idle');
            setScanProgress(0);
            setLogs([
                `[SYSTEM] Initializing biometric ${actionType === 'register' ? 'credential creation' : 'assertion'}...`,
                `[SYSTEM] RP Origin: ${window.location.hostname || 'localhost'}`,
                `[SECURITY] Detected iframe environment. WebAuthn sandboxed mode active.`
            ]);
        }
    }, [isOpen, actionType]);

    const addLog = (msg: string) => {
        setLogs(prev => [...prev, msg]);
    };

    const startScan = async () => {
        setStatus('scanning');
        addLog(`[WEBAUTHN] Generating 32-byte cryptographic challenge...`);

        // Simulate steps with intervals
        setTimeout(() => {
            addLog(`[HARDWARE] Activating platform authenticator (TouchID/FaceID)...`);
            addLog(`[USER] Prompting user for biometric gesture: "${username}"`);
        }, 600);

        // Animate progress bar
        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            setScanProgress(progress);
            if (progress === 40) {
                addLog(`[HARDWARE] Scanning biometric data (Secure Enclave)...`);
            } else if (progress === 80) {
                addLog(`[HARDWARE] Biometric verification matched! Generating keypair signature...`);
            }
            if (progress >= 100) {
                clearInterval(interval);
                completeScan();
            }
        }, 200);
    };

    const completeScan = () => {
        setStatus('success');
        addLog(`[WEBAUTHN] Signature created successfully.`);

        // Generate a deterministic simulated signature that is stable and consistent
        // across both registration and assertion phases to prevent decryption mismatches.
        const fakeSignature = Array.from(new TextEncoder().encode('stable-device-bound-biometric-key-safe-token'))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
            .padEnd(64, 'a')
            .substring(0, 64);

        addLog(`[WEBAUTHN] Signature: ${fakeSignature.substring(0, 16)}...${fakeSignature.substring(48)}`);
        addLog(`[CRYPTO] Computing SHA-256 digest of WebAuthn signature...`);
        addLog(`[CRYPTO] Derived 256-bit AES-GCM Key Encryption Key.`);
        addLog(`[SYSTEM] Access granted.`);

        setTimeout(() => {
            onSuccess(fakeSignature);
        }, 1200);
    };

    const handleCancel = () => {
        setStatus('failed');
        addLog('[WEBAUTHN] Operation cancelled by user.');
        setTimeout(() => {
            onFail('Biometric verification cancelled.');
            onClose();
        }, 500);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
                <motion.div
                    id="biometric-simulator-container"
                    initial={{opacity: 0, scale: 0.95}}
                    animate={{opacity: 1, scale: 1}}
                    exit={{opacity: 0, scale: 0.95}}
                    className="relative w-full max-w-lg overflow-hidden border border-slate-800 bg-slate-900 rounded-2xl shadow-2xl shadow-emerald-500/5 text-slate-100"
                >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
                        <div className="flex items-center space-x-2">
                            <Cpu className="w-5 h-5 text-emerald-400" />
                            <span className="font-semibold text-sm tracking-wide uppercase text-slate-300">
                                WebAuthn Sandbox Simulator
                            </span>
                        </div>
                        <span className="px-2 py-0.5 text-xs font-mono rounded bg-slate-800 text-slate-400 border border-slate-700">
                            IFrame Fallback
                        </span>
                    </div>

                    {/* Body */}
                    <div className="p-6 flex flex-col items-center">
                        {/* Visual Scanner Stage */}
                        <div className="relative w-32 h-32 flex items-center justify-center bg-slate-950 rounded-full border border-slate-800 mb-6 shadow-inner overflow-hidden">
                            {/* Scan wave overlay */}
                            {status === 'scanning' && (
                                <motion.div
                                    initial={{top: '-10%'}}
                                    animate={{top: '110%'}}
                                    transition={{repeat: Infinity, duration: 1.5, ease: 'linear'}}
                                    className="absolute left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_8px_#34d399]"
                                />
                            )}

                            {/* Status graphics */}
                            {status === 'idle' && (
                                <motion.div
                                    animate={{scale: [1, 1.05, 1]}}
                                    transition={{repeat: Infinity, duration: 2}}
                                >
                                    <Fingerprint className="w-16 h-16 text-slate-400" />
                                </motion.div>
                            )}

                            {status === 'scanning' && (
                                <motion.div animate={{scale: 1.1}} className="relative">
                                    <Fingerprint className="w-16 h-16 text-emerald-400" />
                                    <div className="absolute inset-0 bg-emerald-500/10 blur-xl rounded-full" />
                                </motion.div>
                            )}

                            {status === 'success' && (
                                <motion.div
                                    initial={{scale: 0.5}}
                                    animate={{scale: 1}}
                                    className="flex items-center justify-center"
                                >
                                    <Check className="w-16 h-16 text-emerald-400" />
                                    <div className="absolute inset-0 bg-emerald-500/20 blur-lg rounded-full animate-ping" />
                                </motion.div>
                            )}

                            {status === 'failed' && (
                                <motion.div initial={{scale: 0.5}} animate={{scale: 1}}>
                                    <AlertTriangle className="w-16 h-16 text-rose-500" />
                                </motion.div>
                            )}
                        </div>

                        {/* Title / Description */}
                        <h3 className="text-lg font-medium text-slate-200 mb-2">
                            {actionType === 'register' ? 'Register Biometric Key' : 'Unlock with Biometrics'}
                        </h3>
                        <p className="text-xs text-slate-400 text-center max-w-sm mb-6 leading-relaxed">
                            Touch ID or Face ID has been simulated for your secure sandbox environment. To perform real
                            WebAuthn operations, run this app in a standalone browser tab.
                        </p>

                        {/* Cryptographic Step Logs */}
                        <div className="w-full bg-slate-950 rounded-lg p-3 font-mono text-[10px] leading-relaxed text-slate-400 h-32 overflow-y-auto border border-slate-800 shadow-inner mb-6">
                            {logs.map((log, index) => {
                                let colorClass = 'text-slate-400';
                                if (log.includes('[SUCCESS]')) colorClass = 'text-emerald-400';
                                if (log.includes('[SECURITY]')) colorClass = 'text-amber-400 font-medium';
                                if (log.includes('[SYSTEM]')) colorClass = 'text-blue-400';
                                return (
                                    <div key={index} className={`${colorClass} truncate`}>
                                        {log}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Actions */}
                        <div className="w-full flex flex-col space-y-2">
                            {status === 'idle' && (
                                <button
                                    id="simulate-scan-button"
                                    onClick={startScan}
                                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-medium rounded-lg text-sm flex items-center justify-center space-x-2 transition cursor-pointer shadow-lg shadow-emerald-500/10"
                                >
                                    <Fingerprint className="w-4 h-4" />
                                    <span>Verify Biometrics</span>
                                </button>
                            )}

                            {status === 'scanning' && (
                                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                    <div
                                        className="bg-emerald-500 h-1.5 rounded-full transition-all duration-200"
                                        style={{width: `${scanProgress}%`}}
                                    />
                                </div>
                            )}

                            {status === 'success' && (
                                <div className="w-full py-2.5 bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 font-medium rounded-lg text-sm flex items-center justify-center space-x-2">
                                    <Check className="w-4 h-4 animate-bounce" />
                                    <span>Verified successfully!</span>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-2 w-full pt-2">
                                <button
                                    id="simulator-pin-fallback-button"
                                    onClick={fallbackToPin}
                                    className="py-2 px-3 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-medium flex items-center justify-center space-x-1.5 transition cursor-pointer"
                                >
                                    <Key className="w-3.5 h-3.5" />
                                    <span>Use Device PIN</span>
                                </button>
                                <button
                                    id="simulator-cancel-button"
                                    onClick={handleCancel}
                                    className="py-2 px-3 border border-slate-800 hover:bg-rose-950/30 hover:border-rose-900/40 text-slate-400 hover:text-rose-400 rounded-lg text-xs font-medium flex items-center justify-center transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
