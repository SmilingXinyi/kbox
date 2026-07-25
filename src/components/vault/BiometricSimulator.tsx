import {useState} from 'react';
import {motion, AnimatePresence} from 'motion/react';
import {Fingerprint, Check, AlertTriangle, Key, Cpu} from 'lucide-react';
import Button from '../ui/Button';

type BiometricSimulatorProps = {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (simulatedSignature: string) => void;
    onFail: (errorMsg: string) => void;
    username: string;
    actionType: 'register' | 'assert';
    fallbackToPin: () => void;
};

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

    const [prevOpen, setPrevOpen] = useState(isOpen);
    const [prevAction, setPrevAction] = useState(actionType);

    if (isOpen && (isOpen !== prevOpen || actionType !== prevAction)) {
        setPrevOpen(isOpen);
        setPrevAction(actionType);
        setStatus('idle');
        setScanProgress(0);
        setLogs([
            `[SYSTEM] Initializing biometric ${actionType === 'register' ? 'enrollment' : 'assertion'}…`,
            `[SYSTEM] RP Origin: ${window.location.hostname || 'localhost'}`,
            `[SECURITY] Sandbox mode active (hardware bypass).`
        ]);
    } else if (!isOpen && prevOpen) {
        setPrevOpen(false);
    }

    const addLog = (msg: string) => {
        setLogs(prev => [...prev, msg]);
    };

    const startScan = () => {
        setStatus('scanning');
        addLog(`[WEBAUTHN] Generating cryptographic challenge…`);

        setTimeout(() => {
            addLog(`[HARDWARE] Activating platform authenticator…`);
            addLog(`[USER] Prompting for biometric gesture: "${username}"`);
        }, 600);

        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            setScanProgress(progress);
            if (progress === 40) {
                addLog(`[HARDWARE] Scanning biometric data (Secure Enclave)…`);
            } else if (progress === 80) {
                addLog(`[HARDWARE] Verification matched! Generating signature…`);
            }
            if (progress >= 100) {
                clearInterval(interval);
                completeScan();
            }
        }, 150);
    };

    const completeScan = () => {
        setStatus('success');
        addLog(`[WEBAUTHN] Signature created successfully.`);

        const fakeSignature = Array.from(new TextEncoder().encode('kbox-stable-simulated-biometric-key'))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
            .padEnd(64, 'a')
            .substring(0, 64);

        addLog(`[WEBAUTHN] Signature: ${fakeSignature.substring(0, 16)}…`);
        addLog(`[CRYPTO] Derived 256-bit AES-GCM Key Encryption Key.`);
        addLog(`[SYSTEM] Access granted.`);

        setTimeout(() => {
            onSuccess(fakeSignature);
        }, 1000);
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
        <AnimatePresence mode="wait">
            <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-surface-950/85 backdrop-blur-[2px]">
                <motion.div
                    initial={{opacity: 0, y: 20, scale: 0.98}}
                    animate={{opacity: 1, y: 0, scale: 1}}
                    exit={{opacity: 0, scale: 0.97}}
                    transition={{duration: 0.25, ease: [0.32, 0.72, 0, 1]}}
                    className="relative w-full max-w-md overflow-hidden border border-surface-700 bg-surface-900 rounded-t-2xl sm:rounded-2xl text-surface-100"
                >
                    <div className="h-1 hazard-stripe" aria-hidden />
                    <div className="px-5 py-3 border-b border-surface-800 flex items-center justify-between bg-surface-950/40">
                        <div className="flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-accent" aria-hidden />
                            <span className="font-semibold text-[10px] tracking-wider uppercase text-surface-400">
                                WebAuthn Sandbox Simulator
                            </span>
                        </div>
                        <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-warn/15 text-warn border border-warn/30">
                            Non-production
                        </span>
                    </div>

                    <div className="p-5 sm:p-6 flex flex-col items-center safe-pb">
                        <div className="relative w-24 h-24 flex items-center justify-center bg-surface-950 rounded-full border border-surface-800 mb-6 overflow-hidden">
                            {status === 'scanning' && (
                                <motion.div
                                    initial={{top: '-10%'}}
                                    animate={{top: '110%'}}
                                    transition={{repeat: Infinity, duration: 1.5, ease: 'linear'}}
                                    className="absolute left-0 right-0 h-0.5 bg-accent"
                                />
                            )}

                            {status === 'idle' && (
                                <motion.div
                                    animate={{scale: [1, 1.04, 1]}}
                                    transition={{repeat: Infinity, duration: 2}}
                                >
                                    <Fingerprint className="w-12 h-12 text-surface-600" />
                                </motion.div>
                            )}

                            {status === 'scanning' && <Fingerprint className="w-12 h-12 text-accent" />}

                            {status === 'success' && (
                                <motion.div initial={{scale: 0.9, opacity: 0}} animate={{scale: 1, opacity: 1}}>
                                    <Check className="w-12 h-12 text-accent" />
                                </motion.div>
                            )}

                            {status === 'failed' && (
                                <motion.div initial={{scale: 0.9, opacity: 0}} animate={{scale: 1, opacity: 1}}>
                                    <AlertTriangle className="w-12 h-12 text-danger" />
                                </motion.div>
                            )}
                        </div>

                        <h3 className="font-display text-base font-semibold text-surface-100 mb-2">
                            {actionType === 'register' ? 'Enroll Biometrics' : 'Authenticate Biometrics'}
                        </h3>
                        <p className="text-[11px] text-surface-400 text-center max-w-xs mb-6 leading-relaxed">
                            Simulating platform authenticator for this sandbox. To use native hardware, run kbox in a
                            standalone browser tab.
                        </p>

                        <div className="w-full bg-surface-950 rounded-lg p-3 font-mono text-[9px] leading-relaxed text-surface-500 h-28 overflow-y-auto border border-surface-800 mb-6">
                            {logs.map((log, index) => {
                                let colorClass = 'text-surface-500';
                                if (log.includes('[SUCCESS]')) colorClass = 'text-accent';
                                if (log.includes('[SECURITY]')) colorClass = 'text-warn';
                                if (log.includes('[SYSTEM]')) colorClass = 'text-surface-300';
                                return (
                                    <div key={index} className={`${colorClass} truncate`}>
                                        {log}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="w-full flex flex-col gap-2">
                            {status === 'idle' && (
                                <Button fullWidth onClick={startScan}>
                                    <Fingerprint className="w-3.5 h-3.5" aria-hidden />
                                    Verify biometrics
                                </Button>
                            )}

                            {status === 'scanning' && (
                                <div className="w-full bg-surface-800 rounded h-1 overflow-hidden">
                                    <div
                                        className="bg-accent h-1 transition-all duration-200"
                                        style={{width: `${scanProgress}%`}}
                                    />
                                </div>
                            )}

                            {status === 'success' && (
                                <div className="w-full py-2.5 bg-accent-muted border border-accent/25 text-accent font-medium rounded-lg text-xs flex items-center justify-center gap-2">
                                    <Check className="w-3.5 h-3.5" aria-hidden />
                                    Verified
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-2 w-full pt-2">
                                <Button variant="secondary" size="sm" onClick={fallbackToPin}>
                                    <Key className="w-3 h-3" aria-hidden />
                                    Use PIN
                                </Button>
                                <Button variant="ghost" size="sm" onClick={handleCancel}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
