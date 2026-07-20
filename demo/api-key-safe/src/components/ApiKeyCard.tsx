import React from 'react';
import {motion} from 'motion/react';
import {Eye, EyeOff, Copy, Check, Edit2, Trash2, Calendar, FileText, Tag} from 'lucide-react';
import {ApiKeyItem} from '../types';

interface ApiKeyCardProps {
    key?: string;
    item: ApiKeyItem;
    onEdit: (item: ApiKeyItem) => void;
    onDelete: (id: string) => void;
    isUnlocked: boolean;
    revealedKeys: Record<string, boolean>;
    copiedKeyId: string | null;
    onToggleReveal: (itemId: string, keyId: string) => void;
    onCopyKey: (itemId: string, keyId: string) => void;
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
    const formatDate = (isoStr: string) => {
        try {
            const d = new Date(isoStr);
            return d.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        } catch (e) {
            return 'Recent';
        }
    };

    const handleDeleteClick = () => {
        if (
            window.confirm(`Are you sure you want to permanently delete "${item.label}"? This action cannot be undone.`)
        ) {
            onDelete(item.id);
        }
    };

    return (
        <motion.div
            id={`api-key-card-${item.id}`}
            layout
            initial={{opacity: 0, y: 10}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, scale: 0.95}}
            transition={{duration: 0.2}}
            className="p-5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl shadow-lg hover:shadow-indigo-500/5 transition duration-200 flex flex-col justify-between space-y-4 relative overflow-hidden group"
        >
            {/* Decorative Top Accent */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-indigo-500/30 group-hover:bg-indigo-500/70 transition-all duration-300" />

            {/* Card Header (Label & Tag) */}
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <h4 className="text-sm font-semibold tracking-tight text-slate-100 flex items-center space-x-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                        <span>{item.label}</span>
                    </h4>

                    <div className="flex items-center space-x-2">
                        {item.tag && (
                            <span className="px-2 py-0.5 text-[10px] rounded font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center space-x-1">
                                <Tag className="w-2.5 h-2.5" />
                                <span>{item.tag}</span>
                            </span>
                        )}
                        <span className="text-[9px] text-slate-500 flex items-center space-x-0.5">
                            <Calendar className="w-2.5 h-2.5" />
                            <span>{formatDate(item.updatedAt)}</span>
                        </span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-1 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 opacity-100 transition-opacity duration-200 shrink-0">
                    <button
                        id={`edit-card-${item.id}`}
                        onClick={() => onEdit(item)}
                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded transition cursor-pointer"
                        title="Edit API key"
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                        id={`delete-card-${item.id}`}
                        onClick={handleDeleteClick}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition cursor-pointer"
                        title="Delete API key"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Keys List (Multiple Rows support) */}
            <div className="space-y-2.5 py-1">
                {item.keys.map(keyEntry => {
                    const isRevealed = !!revealedKeys[keyEntry.id];
                    const isCopied = copiedKeyId === keyEntry.id;
                    const displayValue = isUnlocked ? keyEntry.value : '••••••••••••••••';

                    return (
                        <div
                            key={keyEntry.id}
                            className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/60 space-y-1"
                        >
                            {/* Key Row Header */}
                            <div className="flex items-center justify-between text-[10px] font-medium text-slate-500">
                                <span className="tracking-wide uppercase font-mono text-[9px] text-slate-400">
                                    {keyEntry.label}
                                </span>

                                {/* Actions inside row */}
                                <div className="flex items-center space-x-2">
                                    <button
                                        id={`toggle-reveal-${keyEntry.id}`}
                                        onClick={() => onToggleReveal(item.id, keyEntry.id)}
                                        className="hover:text-slate-200 transition cursor-pointer flex items-center space-x-0.5"
                                        title={isRevealed ? 'Mask key' : 'Show key'}
                                    >
                                        {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                    </button>
                                    <button
                                        id={`copy-key-${keyEntry.id}`}
                                        onClick={() => onCopyKey(item.id, keyEntry.id)}
                                        className={`transition cursor-pointer flex items-center space-x-0.5 ${
                                            isCopied ? 'text-emerald-400' : 'hover:text-slate-200'
                                        }`}
                                        title="Copy key"
                                    >
                                        {isCopied ? (
                                            <Check className="w-3 h-3 animate-ping" />
                                        ) : (
                                            <Copy className="w-3 h-3" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Key Row Value Display */}
                            <div className="font-mono text-xs text-slate-200 break-all select-all flex items-center">
                                {isRevealed && isUnlocked ? (
                                    <span className="text-slate-200 tracking-normal">{displayValue}</span>
                                ) : (
                                    <span className="text-slate-500 select-none tracking-widest text-[10px]">
                                        {isUnlocked && keyEntry.value && keyEntry.value.length > 12
                                            ? `${keyEntry.value.substring(0, 4)}••••••••${keyEntry.value.substring(keyEntry.value.length - 4)}`
                                            : '••••••••••••••••'}
                                    </span>
                                )}
                                {/* Temporary visual checkmark feedback */}
                                {isCopied && (
                                    <span className="ml-2 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-[9px] text-emerald-400 rounded-md font-sans">
                                        Copied!
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Description / notes (If present) */}
            {item.description && (
                <div className="p-2.5 bg-slate-950/40 rounded-lg border border-slate-800/40 text-[11px] text-slate-400 flex items-start space-x-1.5 leading-normal">
                    <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <span className="whitespace-pre-wrap">{item.description}</span>
                </div>
            )}
        </motion.div>
    );
}
