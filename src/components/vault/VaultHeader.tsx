import {Lock, Plus, Radio, Settings, Unlock} from 'lucide-react';
import Button from '../ui/Button';
import IconButton from '../ui/IconButton';

type VaultHeaderProps = {
    isUnlocked: boolean;
    isViewOnly: boolean;
    syncActive: boolean;
    onLock: () => void;
    onUnlock: () => void;
    onOpenSync: () => void;
    onOpenSettings: () => void;
    onAdd: () => void;
};

export default function VaultHeader({
    isUnlocked,
    isViewOnly,
    syncActive,
    onLock,
    onUnlock,
    onOpenSync,
    onOpenSettings,
    onAdd
}: VaultHeaderProps) {
    return (
        <header className="sticky top-0 z-20 border-b border-surface-800/90 bg-surface-950/90 backdrop-blur-md safe-pt">
            <div className="h-0.5 hazard-stripe" aria-hidden />
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <img
                        src={`${import.meta.env.BASE_URL}kbox.svg`}
                        alt="kbox"
                        className="h-5 w-auto"
                        width={31}
                        height={9}
                        decoding="async"
                    />
                    <p className="text-[11px] text-surface-400 mt-1.5 truncate">
                        {isUnlocked
                            ? 'Vault unlocked'
                            : isViewOnly
                              ? 'Locked — labels visible, secrets hidden'
                              : 'Vault'}
                    </p>
                </div>

                {/* Desktop / tablet actions */}
                <div className="hidden sm:flex items-center gap-2 shrink-0">
                    {isUnlocked ? (
                        <Button variant="secondary" size="sm" onClick={onLock}>
                            <Lock className="w-3.5 h-3.5" aria-hidden />
                            Lock
                        </Button>
                    ) : (
                        <Button variant="primary" size="sm" onClick={onUnlock}>
                            <Unlock className="w-3.5 h-3.5" aria-hidden />
                            Unlock
                        </Button>
                    )}
                    <IconButton label="Device sync" active={syncActive} onClick={onOpenSync}>
                        <Radio className="w-4 h-4" />
                    </IconButton>
                    <IconButton label="Settings" onClick={onOpenSettings}>
                        <Settings className="w-4 h-4" />
                    </IconButton>
                    <Button size="sm" onClick={onAdd}>
                        <Plus className="w-3.5 h-3.5" aria-hidden />
                        Add
                    </Button>
                </div>

                {/* Mobile: unlock/lock only in header; rest in bottom dock */}
                <div className="flex sm:hidden items-center gap-2 shrink-0">
                    {isUnlocked ? (
                        <IconButton label="Lock vault" onClick={onLock}>
                            <Lock className="w-4 h-4" />
                        </IconButton>
                    ) : (
                        <Button size="sm" onClick={onUnlock}>
                            <Unlock className="w-3.5 h-3.5" aria-hidden />
                            Unlock
                        </Button>
                    )}
                </div>
            </div>
        </header>
    );
}
