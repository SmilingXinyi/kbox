import {motion} from 'motion/react';
import {Calendar, Check, Copy, Edit2, Eye, EyeOff, FileText, Tag, Trash2} from 'lucide-react';
import type {ApiKeyItem} from '../../types/vault';

type ApiKeyCardProps = {
    item: ApiKeyItem;
    onEdit: (item: ApiKeyItem) => void;
    onDelete: (id: string) => void;
    isUnlocked: boolean;
    revealedKeys: Record<string, boolean>;
    copiedKeyId: string | null;
    onToggleReveal: (itemId: string, keyId: string) => void;
    onCopyKey: (itemId: string, keyId: string) => void;
};

function formatDate(isoStr: string): string {
    try {
        return new Date(isoStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return 'Recent';
    }
}

function maskValue(value: string): string {
    if (value.length > 12) {
        return `${value.slice(0, 4)}••••••••${value.slice(-4)}`;
    }
    return '••••••••••••••••';
}

export default function ApiKeyCard({
    item,
    onEdit,
    onDelete,
    isUnlocked,
    revealedKeys,
    copiedKeyId,
    onToggleReveal,
    onCopyKey
}: ApiKeyCardProps) {
    const handleDeleteClick = () => {
        if (window.confirm(`Permanently delete "${item.label}"? This cannot be undone.`)) {
            onDelete(item.id);
        }
    };

    return (
        <motion.div
            layout
            initial={{opacity: 0, y: 10}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, scale: 0.97}}
            transition={{duration: 0.2}}
            className="p-5 bg-surface-900 border border-surface-700 hover:border-surface-600 rounded-xl flex flex-col gap-4 relative group"
        >
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-accent/40 group-hover:bg-accent/70 transition-colors" />

            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                    <h3 className="text-sm font-semibold tracking-tight text-surface-100 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                        <span className="truncate">{item.label}</span>
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                        {item.tag && (
                            <span className="px-2 py-0.5 text-[10px] rounded font-semibold bg-accent-muted text-accent border border-accent/25 flex items-center gap-1">
                                <Tag className="w-2.5 h-2.5" />
                                <span>{item.tag}</span>
                            </span>
                        )}
                        <span className="text-[9px] text-surface-400 flex items-center gap-0.5">
                            <Calendar className="w-2.5 h-2.5" />
                            <span>{formatDate(item.updatedAt)}</span>
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <button
                        type="button"
                        onClick={() => onEdit(item)}
                        className="p-1.5 text-surface-400 hover:text-accent hover:bg-surface-800 rounded transition cursor-pointer"
                        title="Edit"
                        aria-label={`Edit ${item.label}`}
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={handleDeleteClick}
                        className="p-1.5 text-surface-400 hover:text-danger hover:bg-surface-800 rounded transition cursor-pointer"
                        title="Delete"
                        aria-label={`Delete ${item.label}`}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            <div className="space-y-2.5">
                {item.keys.map(keyEntry => {
                    const isRevealed = !!revealedKeys[keyEntry.id];
                    const isCopied = copiedKeyId === keyEntry.id;

                    return (
                        <div
                            key={keyEntry.id}
                            className="p-2.5 bg-surface-950 rounded-lg border border-surface-700/70 space-y-1"
                        >
                            <div className="flex items-center justify-between text-[10px] font-medium text-surface-400">
                                <span className="tracking-wide uppercase font-mono text-[9px]">{keyEntry.label}</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => onToggleReveal(item.id, keyEntry.id)}
                                        className="hover:text-surface-100 transition cursor-pointer"
                                        title={isRevealed ? 'Hide' : 'Reveal'}
                                        aria-label={isRevealed ? 'Hide secret' : 'Reveal secret'}
                                    >
                                        {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onCopyKey(item.id, keyEntry.id)}
                                        className={`transition cursor-pointer ${
                                            isCopied ? 'text-accent' : 'hover:text-surface-100'
                                        }`}
                                        title="Copy"
                                        aria-label="Copy secret"
                                    >
                                        {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                </div>
                            </div>

                            <div className="font-mono text-xs text-surface-100 break-all flex items-center">
                                {isRevealed && isUnlocked && keyEntry.value ? (
                                    <span>{keyEntry.value}</span>
                                ) : (
                                    <span className="text-surface-400 select-none tracking-widest text-[10px]">
                                        {isUnlocked && keyEntry.value ? maskValue(keyEntry.value) : '••••••••••••••••'}
                                    </span>
                                )}
                                {isCopied && (
                                    <span className="ml-2 px-1.5 py-0.5 bg-accent-muted border border-accent/25 text-[9px] text-accent rounded-md font-sans">
                                        Copied
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {item.description && (
                <div className="p-2.5 bg-surface-950/50 rounded-lg border border-surface-700/50 text-[11px] text-surface-400 flex items-start gap-1.5 leading-normal">
                    <FileText className="w-3.5 h-3.5 text-surface-400 shrink-0 mt-0.5" />
                    <span className="whitespace-pre-wrap">{item.description}</span>
                </div>
            )}
        </motion.div>
    );
}
