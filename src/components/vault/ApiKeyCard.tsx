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
        <motion.article
            layout
            initial={{opacity: 0, y: 10}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, scale: 0.97}}
            transition={{duration: 0.2, ease: [0.23, 1, 0.32, 1]}}
            className="relative flex flex-col gap-3.5 p-4 sm:p-5 bg-surface-900 border border-surface-700 hover:border-surface-600 rounded-xl overflow-hidden"
        >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent" aria-hidden />

            <div className="flex items-start justify-between gap-3 pl-2">
                <div className="space-y-1.5 min-w-0">
                    <h3 className="font-display text-sm font-semibold tracking-tight text-surface-100 truncate">
                        {item.label}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                        {item.tag && (
                            <span className="px-2 py-0.5 text-[10px] rounded font-medium bg-accent-muted text-accent border border-accent/25 inline-flex items-center gap-1">
                                <Tag className="w-2.5 h-2.5" aria-hidden />
                                {item.tag}
                            </span>
                        )}
                        <span className="text-[10px] text-surface-400 inline-flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" aria-hidden />
                            {formatDate(item.updatedAt)}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                    <button
                        type="button"
                        onClick={() => onEdit(item)}
                        className="p-2.5 min-h-11 min-w-11 inline-flex items-center justify-center text-surface-400 hover:text-accent hover:bg-surface-800 rounded-lg transition cursor-pointer pressable"
                        aria-label={`Edit ${item.label}`}
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={handleDeleteClick}
                        className="p-2.5 min-h-11 min-w-11 inline-flex items-center justify-center text-surface-400 hover:text-danger hover:bg-surface-800 rounded-lg transition cursor-pointer pressable"
                        aria-label={`Delete ${item.label}`}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            <div className="space-y-2 pl-2">
                {item.keys.map(keyEntry => {
                    const isRevealed = !!revealedKeys[keyEntry.id];
                    const isCopied = copiedKeyId === keyEntry.id;

                    return (
                        <div
                            key={keyEntry.id}
                            className="p-2.5 bg-surface-950 rounded-lg border border-surface-700/70 space-y-1.5"
                        >
                            <div className="flex items-center justify-between text-[10px] font-medium text-surface-400">
                                <span className="tracking-wide uppercase font-mono text-[9px]">{keyEntry.label}</span>
                                <div className="flex items-center gap-0.5">
                                    <button
                                        type="button"
                                        onClick={() => onToggleReveal(item.id, keyEntry.id)}
                                        className="p-2 min-h-9 min-w-9 inline-flex items-center justify-center hover:text-surface-100 transition cursor-pointer pressable"
                                        aria-label={isRevealed ? 'Hide secret' : 'Reveal secret'}
                                    >
                                        {isRevealed ? (
                                            <EyeOff className="w-3.5 h-3.5" />
                                        ) : (
                                            <Eye className="w-3.5 h-3.5" />
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onCopyKey(item.id, keyEntry.id)}
                                        className={`p-2 min-h-9 min-w-9 inline-flex items-center justify-center transition cursor-pointer pressable ${
                                            isCopied ? 'text-accent' : 'hover:text-surface-100'
                                        }`}
                                        aria-label="Copy secret"
                                    >
                                        {isCopied ? (
                                            <Check className="w-3.5 h-3.5" />
                                        ) : (
                                            <Copy className="w-3.5 h-3.5" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="font-mono text-xs text-surface-100 break-all flex items-center flex-wrap gap-1.5">
                                {isRevealed && isUnlocked && keyEntry.value ? (
                                    <span>{keyEntry.value}</span>
                                ) : (
                                    <span className="text-surface-400 select-none tracking-widest text-[10px]">
                                        {isUnlocked && keyEntry.value ? maskValue(keyEntry.value) : '••••••••••••••••'}
                                    </span>
                                )}
                                {isCopied && (
                                    <span className="px-1.5 py-0.5 bg-accent-muted border border-accent/25 text-[9px] text-accent rounded font-sans">
                                        Copied
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {item.description && (
                <div className="pl-2 p-2.5 bg-surface-950/50 rounded-lg border border-surface-700/50 text-[11px] text-surface-400 flex items-start gap-1.5 leading-relaxed">
                    <FileText className="w-3.5 h-3.5 text-surface-400 shrink-0 mt-0.5" aria-hidden />
                    <span className="whitespace-pre-wrap">{item.description}</span>
                </div>
            )}
        </motion.article>
    );
}
