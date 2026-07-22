import {Plus, Radio, Settings} from 'lucide-react';
import IconButton from '../ui/IconButton';
import Button from '../ui/Button';

type VaultMobileDockProps = {
    syncActive: boolean;
    onOpenSync: () => void;
    onOpenSettings: () => void;
    onAdd: () => void;
};

/**
 * Fixed bottom actions for small screens. Desktop uses the header toolbar instead.
 */
export default function VaultMobileDock({syncActive, onOpenSync, onOpenSettings, onAdd}: VaultMobileDockProps) {
    return (
        <nav
            aria-label="Primary actions"
            className="sm:hidden fixed bottom-0 inset-x-0 z-30 border-t border-surface-800 bg-surface-950/95 backdrop-blur-md"
        >
            <div className="px-4 pt-2.5 safe-pb flex items-center gap-2">
                <IconButton label="Device sync" active={syncActive} onClick={onOpenSync} className="shrink-0">
                    <Radio className="w-4 h-4" />
                </IconButton>
                <IconButton label="Settings" onClick={onOpenSettings} className="shrink-0">
                    <Settings className="w-4 h-4" />
                </IconButton>
                <Button fullWidth onClick={onAdd} className="flex-1">
                    <Plus className="w-4 h-4" aria-hidden />
                    Add key
                </Button>
            </div>
        </nav>
    );
}
