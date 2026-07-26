import {useRef, useState} from 'react';
import {Download, FileKey, RefreshCw, Shield} from 'lucide-react';
import {
    BACKUP_FILE_EXTENSION,
    createVaultBackup,
    decryptVaultBackup,
    downloadVaultBackup,
    parseVaultBackupJson,
    RECOVERY_PASSPHRASE_MIN_LENGTH,
    validateRecoveryPassphrase
} from '../../lib/vaultBackup';
import type {ApiKeyItem, LockBehavior} from '../../types/vault';
import {
    deriveKeyFromPin,
    encryptMasterKey,
    generateRandomHex,
    PIN_MAX_LENGTH,
    validatePinStrength
} from '../../lib/crypto';
import type {VaultMetadata} from '../../types/vault';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import TextField from '../ui/TextField';

type VaultBackupExportProps = {
    masterKeyHex: string;
    items: ApiKeyItem[];
    lockBehavior: LockBehavior;
    commonTags: string[];
};

/** Export encrypted recovery file — requires an unlocked vault. */
export function VaultBackupExport({masterKeyHex, items, lockBehavior, commonTags}: VaultBackupExportProps) {
    const [passphrase, setPassphrase] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleExport = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        const passphraseError = validateRecoveryPassphrase(passphrase);
        if (passphraseError) {
            setError(passphraseError);
            return;
        }
        if (passphrase !== confirm) {
            setError('Recovery passphrases do not match.');
            return;
        }

        setLoading(true);
        try {
            const file = await createVaultBackup(masterKeyHex, items, passphrase, {
                lockBehavior,
                commonTags
            });
            downloadVaultBackup(file);
            setSuccess('Recovery file downloaded. Store it offline in a safe place.');
            setPassphrase('');
            setConfirm('');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to export recovery file.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="space-y-3 mb-6">
            <div className="flex items-center gap-2 text-sm font-medium text-surface-100">
                <Shield className="w-4 h-4 text-accent" aria-hidden />
                <h3>Account recovery</h3>
            </div>
            <p className="text-[11px] text-surface-400 leading-relaxed">
                Export an encrypted recovery file. If you forget your PIN or switch devices, restore with this file and
                its passphrase. Biometrics stay on this device and are not included.
            </p>

            {error && (
                <Alert tone="error" className="mb-1">
                    {error}
                </Alert>
            )}
            {success && (
                <Alert tone="success" className="mb-1">
                    {success}
                </Alert>
            )}

            <form onSubmit={e => void handleExport(e)} className="space-y-3">
                <TextField
                    label="Recovery passphrase"
                    type="password"
                    autoComplete="new-password"
                    value={passphrase}
                    onChange={e => setPassphrase(e.target.value)}
                    placeholder={`At least ${RECOVERY_PASSPHRASE_MIN_LENGTH} characters`}
                    hint="Different from your unlock PIN. You will need this to restore."
                    required
                />
                <TextField
                    label="Confirm passphrase"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                />
                <Button type="submit" variant="secondary" fullWidth disabled={loading || !passphrase || !confirm}>
                    {loading ? (
                        <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden />
                            Encrypting…
                        </>
                    ) : (
                        <>
                            <Download className="w-3.5 h-3.5" aria-hidden />
                            Download recovery file
                        </>
                    )}
                </Button>
            </form>
        </section>
    );
}

type VaultRestoreProps = {
    onRestored: (masterKeyHex: string, metadata: VaultMetadata, items: ApiKeyItem[]) => Promise<void>;
    onCancel: () => void;
};

/** Restore vault from an encrypted recovery file (setup / empty state). */
export default function VaultRestore({onRestored, onCancel}: VaultRestoreProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [fileText, setFileText] = useState<string | null>(null);
    const [passphrase, setPassphrase] = useState('');
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setError(null);
        const file = e.target.files?.[0];
        if (!file) {
            setFileName(null);
            setFileText(null);
            return;
        }

        try {
            const text = await file.text();
            parseVaultBackupJson(text);
            setFileName(file.name);
            setFileText(text);
        } catch (err: unknown) {
            setFileName(null);
            setFileText(null);
            setError(err instanceof Error ? err.message : 'Could not read backup file.');
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRestore = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!fileText) {
            setError('Choose a recovery file first.');
            return;
        }

        const pinError = validatePinStrength(pin);
        if (pinError) {
            setError(pinError);
            return;
        }
        if (pin !== confirmPin) {
            setError('PINs do not match.');
            return;
        }

        setLoading(true);
        try {
            const backupFile = parseVaultBackupJson(fileText);
            const payload = await decryptVaultBackup(backupFile, passphrase);

            const saltHex = generateRandomHex(16);
            const pinKek = await deriveKeyFromPin(pin, saltHex);
            const encryptedMasterWithPin = await encryptMasterKey(payload.masterKeyHex, pinKek);

            const metadata: VaultMetadata = {
                isInitialized: true,
                hasWebAuthn: false,
                salt: saltHex,
                pinIv: encryptedMasterWithPin.iv,
                encryptedMasterKeyWithPin: encryptedMasterWithPin.ciphertext
            };

            await onRestored(payload.masterKeyHex, metadata, payload.items);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to restore vault.');
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md overflow-hidden bg-surface-900 border border-surface-700 rounded-2xl">
            <div className="h-1.5 hazard-stripe" aria-hidden />
            <div className="p-5 sm:p-6">
                <div className="flex flex-col items-center mb-6 text-center">
                    <div className="p-3 bg-accent-muted border border-accent/30 rounded-xl mb-3 text-accent">
                        <FileKey className="w-8 h-8" aria-hidden />
                    </div>
                    <h1 className="font-display text-xl font-semibold tracking-tight text-surface-100">
                        Restore from recovery file
                    </h1>
                    <p className="text-xs text-surface-400 mt-1.5 max-w-xs leading-relaxed">
                        Decrypt your recovery file, then set a new PIN for this device. Re-enable Face ID / Touch ID
                        after restore if needed.
                    </p>
                </div>

                {error && (
                    <Alert tone="error" className="mb-4">
                        {error}
                    </Alert>
                )}

                <form onSubmit={e => void handleRestore(e)} className="space-y-4">
                    <div className="space-y-1.5">
                        <span className="text-xs font-medium text-surface-300">Recovery file</span>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept={`.${BACKUP_FILE_EXTENSION},application/json,.json`}
                            onChange={e => void handleFileChange(e)}
                            className="block w-full text-sm text-surface-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-surface-800 file:text-surface-100 file:text-xs file:font-medium file:cursor-pointer hover:file:bg-surface-700"
                        />
                        {fileName && <p className="text-[11px] text-surface-400 font-mono truncate">{fileName}</p>}
                    </div>

                    <TextField
                        label="Recovery passphrase"
                        type="password"
                        autoComplete="current-password"
                        value={passphrase}
                        onChange={e => setPassphrase(e.target.value)}
                        placeholder="Passphrase used when exporting"
                        required
                    />

                    <div className="grid grid-cols-2 gap-3">
                        <TextField
                            label="New PIN"
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

                    <Button type="submit" fullWidth disabled={loading || !fileText || !passphrase || !pin}>
                        {loading ? (
                            <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden />
                                Restoring…
                            </>
                        ) : (
                            'Restore vault'
                        )}
                    </Button>

                    <Button type="button" variant="ghost" fullWidth onClick={onCancel} disabled={loading}>
                        Back to setup
                    </Button>
                </form>
            </div>
        </div>
    );
}
