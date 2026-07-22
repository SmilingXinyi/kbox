import {FolderOpen, Plus} from 'lucide-react';
import {motion} from 'motion/react';
import Button from '../ui/Button';

type VaultEmptyStateProps = {
    onAdd: () => void;
};

export default function VaultEmptyState({onAdd}: VaultEmptyStateProps) {
    return (
        <motion.div
            initial={{opacity: 0, y: 8}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.28, ease: [0.23, 1, 0.32, 1]}}
            className="flex flex-col items-center justify-center py-16 sm:py-20 text-center gap-3 px-2"
        >
            <div className="w-14 h-14 rounded-xl border border-surface-700 bg-surface-900 flex items-center justify-center text-accent mb-1">
                <FolderOpen className="w-7 h-7" aria-hidden />
            </div>
            <h2 className="font-display text-lg font-semibold text-surface-100">No API keys yet</h2>
            <p className="text-sm text-surface-400 max-w-sm leading-relaxed">
                Add your first API key to store it encrypted on this device.
            </p>
            <Button className="mt-2" onClick={onAdd}>
                <Plus className="w-4 h-4" aria-hidden />
                Add your first API key
            </Button>
        </motion.div>
    );
}
