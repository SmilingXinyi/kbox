import {useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {AlertCircle, Plus, Trash2, X} from 'lucide-react';
import type {ApiKeyItem, KeyEntry} from '../../types/vault';

type ApiKeyFormProps = {
    isOpen: boolean;
    onClose: () => void;
    onSave: (item: ApiKeyItem) => Promise<void>;
    existingItems: ApiKeyItem[];
    commonTags: string[];
    editItem?: ApiKeyItem | null;
};

function newKeyId(): string {
    return `key-${crypto.randomUUID()}`;
}

function buildInitialKeys(editItem?: ApiKeyItem | null): KeyEntry[] {
    if (editItem) {
        return editItem.keys.map(k => ({...k}));
    }
    return [{id: newKeyId(), label: 'API Key', value: ''}];
}

type ApiKeyFormFieldsProps = {
    onClose: () => void;
    onSave: (item: ApiKeyItem) => Promise<void>;
    existingItems: ApiKeyItem[];
    commonTags: string[];
    editItem?: ApiKeyItem | null;
};

function ApiKeyFormFields({onClose, onSave, existingItems, commonTags, editItem}: ApiKeyFormFieldsProps) {
    const [label, setLabel] = useState(editItem?.label ?? '');
    const [tag, setTag] = useState(editItem?.tag ?? '');
    const [description, setDescription] = useState(editItem?.description ?? '');
    const [keys, setKeys] = useState<KeyEntry[]>(() => buildInitialKeys(editItem));
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    const handleAddKeyRow = () => {
        let defaultLabel = 'Sub-key';
        if (keys.length === 1) {
            const firstLabel = keys[0].label.toLowerCase();
            if (firstLabel.includes('access key') || firstLabel.includes('ak') || firstLabel.includes('id')) {
                defaultLabel = 'Secret Key (SK)';
            } else if (firstLabel.includes('key')) {
                defaultLabel = 'Secret Key';
            }
        } else if (keys.length === 2) {
            defaultLabel = 'Session Token';
        }

        setKeys([...keys, {id: newKeyId(), label: defaultLabel, value: ''}]);
    };

    const handleRemoveKeyRow = (id: string) => {
        if (keys.length === 1) return;
        setKeys(keys.filter(k => k.id !== id));
    };

    const handleKeyFieldChange = (id: string, field: 'label' | 'value', val: string) => {
        setKeys(keys.map(k => (k.id === id ? {...k, [field]: val} : k)));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const trimmedLabel = label.trim();
        if (!trimmedLabel) {
            setError('Label is required.');
            return;
        }

        const duplicate = existingItems.find(
            item => item.label.toLowerCase() === trimmedLabel.toLowerCase() && (!editItem || item.id !== editItem.id)
        );
        if (duplicate) {
            setError('An item with this label already exists.');
            return;
        }

        if (keys.some(k => !k.label.trim() || !k.value.trim())) {
            setError('Each key row needs a label and a value.');
            return;
        }

        const now = new Date().toISOString();
        const item: ApiKeyItem = {
            id: editItem?.id ?? crypto.randomUUID(),
            label: trimmedLabel,
            tag: tag.trim() || undefined,
            description: description.trim() || undefined,
            keys: keys.map(k => ({
                id: k.id,
                label: k.label.trim(),
                value: k.value,
                encryptedValue: k.encryptedValue,
                iv: k.iv
            })),
            createdAt: editItem?.createdAt ?? now,
            updatedAt: now
        };

        setSaving(true);
        try {
            await onSave(item);
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to save item.');
            setSaving(false);
        }
    };

    return (
        <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="api-key-form-title"
            initial={{opacity: 0, y: 24}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: 16}}
            className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto bg-surface-900 border border-surface-700 rounded-t-2xl sm:rounded-2xl p-5 sm:p-6"
        >
            <div className="flex items-start justify-between mb-4">
                <h2 id="api-key-form-title" className="text-lg font-semibold text-surface-100">
                    {editItem ? 'Edit API key' : 'Add API key'}
                </h2>
                <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 text-surface-400 hover:text-surface-100 hover:bg-surface-800 rounded-lg cursor-pointer"
                    aria-label="Close"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {error && (
                <div className="p-3 mb-4 bg-danger-muted border border-danger/25 text-danger text-xs rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-surface-300">Label</label>
                    <input
                        type="text"
                        value={label}
                        onChange={e => setLabel(e.target.value)}
                        placeholder="e.g. AWS Production"
                        className="w-full px-3 py-2 bg-surface-950 border border-surface-700 rounded-lg text-sm text-surface-100 placeholder:text-surface-600 focus:outline-none focus:border-accent transition"
                        required
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-surface-300">Tag</label>
                    <input
                        type="text"
                        value={tag}
                        onChange={e => setTag(e.target.value)}
                        placeholder="Optional"
                        list="kbox-common-tags"
                        className="w-full px-3 py-2 bg-surface-950 border border-surface-700 rounded-lg text-sm text-surface-100 placeholder:text-surface-600 focus:outline-none focus:border-accent transition"
                    />
                    <datalist id="kbox-common-tags">
                        {commonTags.map(t => (
                            <option key={t} value={t} />
                        ))}
                    </datalist>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-surface-300">Description</label>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        rows={2}
                        placeholder="Optional notes"
                        className="w-full px-3 py-2 bg-surface-950 border border-surface-700 rounded-lg text-sm text-surface-100 placeholder:text-surface-600 focus:outline-none focus:border-accent transition resize-y"
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-surface-300">Secrets</label>
                        <button
                            type="button"
                            onClick={handleAddKeyRow}
                            className="text-xs text-accent hover:text-accent-dim flex items-center gap-1 cursor-pointer"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Add row
                        </button>
                    </div>
                    {keys.map(keyEntry => (
                        <div
                            key={keyEntry.id}
                            className="p-3 bg-surface-950 border border-surface-700 rounded-lg space-y-2"
                        >
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={keyEntry.label}
                                    onChange={e => handleKeyFieldChange(keyEntry.id, 'label', e.target.value)}
                                    placeholder="Key label"
                                    className="flex-1 px-2.5 py-1.5 bg-surface-900 border border-surface-700 rounded-md text-xs text-surface-100 focus:outline-none focus:border-accent"
                                />
                                {keys.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveKeyRow(keyEntry.id)}
                                        className="p-1.5 text-surface-400 hover:text-danger cursor-pointer"
                                        aria-label="Remove row"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                            <input
                                type="password"
                                value={keyEntry.value}
                                onChange={e => handleKeyFieldChange(keyEntry.id, 'value', e.target.value)}
                                placeholder="Secret value"
                                className="w-full px-2.5 py-1.5 bg-surface-900 border border-surface-700 rounded-md text-xs font-mono text-surface-100 focus:outline-none focus:border-accent"
                            />
                        </div>
                    ))}
                </div>

                <div className="flex gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-2.5 border border-surface-600 text-surface-300 rounded-lg text-sm cursor-pointer hover:bg-surface-800 transition"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 py-2.5 bg-accent hover:bg-accent-dim text-surface-950 font-medium rounded-lg text-sm cursor-pointer disabled:opacity-50 transition"
                    >
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </form>
        </motion.div>
    );
}

export default function ApiKeyForm({isOpen, onClose, onSave, existingItems, commonTags, editItem}: ApiKeyFormProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <motion.button
                        type="button"
                        aria-label="Close dialog backdrop"
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        exit={{opacity: 0}}
                        className="absolute inset-0 bg-surface-950/80 backdrop-blur-sm cursor-pointer"
                        onClick={onClose}
                    />
                    <ApiKeyFormFields
                        key={editItem?.id ?? 'new'}
                        onClose={onClose}
                        onSave={onSave}
                        existingItems={existingItems}
                        commonTags={commonTags}
                        editItem={editItem}
                    />
                </div>
            )}
        </AnimatePresence>
    );
}
