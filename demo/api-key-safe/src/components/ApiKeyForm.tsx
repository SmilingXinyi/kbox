import React, {useState, useEffect} from 'react';
import {motion, AnimatePresence} from 'motion/react';
import {X, Plus, Trash2, Key, Tag, HelpCircle, FileText, AlertCircle, Sparkles} from 'lucide-react';
import {ApiKeyItem, KeyEntry} from '../types';

interface ApiKeyFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (item: ApiKeyItem) => void;
    existingItems: ApiKeyItem[];
    editItem?: ApiKeyItem | null; // If editing, pass item
}

const COMMON_TAGS = ['AI', 'Cloud', 'Database', 'SaaS', 'Payments', 'Analytics', 'Dev', 'Prod'];

export default function ApiKeyForm({isOpen, onClose, onSave, existingItems, editItem}: ApiKeyFormProps) {
    const [label, setLabel] = useState('');
    const [tag, setTag] = useState('');
    const [description, setDescription] = useState('');
    const [keys, setKeys] = useState<KeyEntry[]>([{id: 'initial-key', label: 'API Key', value: ''}]);
    const [error, setError] = useState<string | null>(null);

    // Populate form if in edit mode
    useEffect(() => {
        if (isOpen) {
            if (editItem) {
                setLabel(editItem.label);
                setTag(editItem.tag || '');
                setDescription(editItem.description || '');
                setKeys(editItem.keys.map(k => ({...k})));
            } else {
                // Default clean state
                setLabel('');
                setTag('');
                setDescription('');
                setKeys([{id: 'key-' + Math.random().toString(36).substr(2, 9), label: 'API Key', value: ''}]);
            }
            setError(null);
        }
    }, [isOpen, editItem]);

    const handleAddKeyRow = () => {
        const newId = 'key-' + Math.random().toString(36).substr(2, 9);

        // Auto-detect a smart default label based on what already exists
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

        setKeys([...keys, {id: newId, label: defaultLabel, value: ''}]);
    };

    const handleRemoveKeyRow = (id: string) => {
        if (keys.length === 1) return; // Must have at least 1 key
        setKeys(keys.filter(k => k.id !== id));
    };

    const handleKeyFieldChange = (id: string, field: 'label' | 'value', val: string) => {
        setKeys(
            keys.map(k => {
                if (k.id === id) {
                    return {...k, [field]: val};
                }
                return k;
            })
        );
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const trimmedLabel = label.trim();
        if (!trimmedLabel) {
            setError('Label is a required field.');
            return;
        }

        // Check unique label rule
        const duplicate = existingItems.find(
            item => item.label.toLowerCase() === trimmedLabel.toLowerCase() && (!editItem || item.id !== editItem.id)
        );

        if (duplicate) {
            setError(`An entry named "${trimmedLabel}" already exists. Label must be unique.`);
            return;
        }

        // Validate that all key values are filled
        const hasEmptyKeys = keys.some(k => !k.value.trim());
        if (hasEmptyKeys) {
            setError('All key entries must have a value.');
            return;
        }

        const savedItem: ApiKeyItem = {
            id: editItem ? editItem.id : 'item-' + Math.random().toString(36).substr(2, 9),
            label: trimmedLabel,
            tag: tag.trim() || undefined,
            description: description.trim() || undefined,
            keys: keys.map(k => ({
                id: k.id,
                label: k.label.trim() || 'Key',
                value: k.value.trim()
            })),
            createdAt: editItem ? editItem.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        onSave(savedItem);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
                <motion.div
                    id="api-key-form-modal"
                    initial={{opacity: 0, scale: 0.97, y: 10}}
                    animate={{opacity: 1, scale: 1, y: 0}}
                    exit={{opacity: 0, scale: 0.97, y: 10}}
                    transition={{duration: 0.2}}
                    className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col text-slate-100 max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/30">
                        <h3 className="font-semibold text-slate-200 text-sm flex items-center space-x-2">
                            <span className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded">
                                <Key className="w-4 h-4" />
                            </span>
                            <span>{editItem ? 'Edit API Key Safe Entry' : 'Add API Key Safe Entry'}</span>
                        </h3>
                        <button
                            id="close-form-button"
                            onClick={onClose}
                            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Form Scroll Container */}
                    <form onSubmit={handleSave} className="overflow-y-auto flex-1 p-6 space-y-4">
                        {error && (
                            <div className="p-3 bg-rose-950/40 border border-rose-500/20 text-rose-300 text-xs rounded-lg flex items-start space-x-2">
                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                <span className="leading-normal">{error}</span>
                            </div>
                        )}

                        {/* Label Input */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                                <span>
                                    Unique Label <span className="text-rose-500">*</span>
                                </span>
                                <span className="text-[10px] text-slate-500">e.g., AWS IAM Dev, Gemini Production</span>
                            </label>
                            <input
                                id="form-label-input"
                                type="text"
                                value={label}
                                onChange={e => setLabel(e.target.value)}
                                placeholder="Enter a unique name..."
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition font-medium"
                                required
                            />
                        </div>

                        {/* Tag Selection / Custom */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-300 flex items-center space-x-1">
                                <Tag className="w-3 h-3 text-slate-500" />
                                <span>Tag / Category</span>
                            </label>
                            <div className="flex space-x-2">
                                <input
                                    id="form-tag-input"
                                    type="text"
                                    value={tag}
                                    onChange={e => setTag(e.target.value)}
                                    placeholder="Create custom tag (optional)..."
                                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition font-medium"
                                />
                            </div>
                            {/* Quick Tag Pills */}
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                {COMMON_TAGS.map(t => (
                                    <button
                                        id={`quick-tag-${t}`}
                                        key={t}
                                        type="button"
                                        onClick={() => setTag(t)}
                                        className={`px-2 py-0.5 text-[10px] rounded border transition cursor-pointer font-medium ${
                                            tag.toLowerCase() === t.toLowerCase()
                                                ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400'
                                                : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                                        }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Keys Area (Multiple Sub-Keys Support) */}
                        <div className="space-y-2 pt-2 border-t border-slate-800/60">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-slate-300 flex items-center space-x-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                                    <span>Key / Secret Entries</span>
                                </label>
                                <span className="text-[10px] text-slate-500">Add multiple rows for AK/SK keys</span>
                            </div>

                            <div className="space-y-3">
                                {keys.map((keyEntry, idx) => (
                                    <motion.div
                                        key={keyEntry.id}
                                        initial={{opacity: 0, y: -5}}
                                        animate={{opacity: 1, y: 0}}
                                        className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg space-y-2 relative"
                                    >
                                        {/* Delete button for rows beyond the first one */}
                                        {keys.length > 1 && (
                                            <button
                                                id={`delete-key-row-${idx}`}
                                                type="button"
                                                onClick={() => handleRemoveKeyRow(keyEntry.id)}
                                                className="absolute right-2 top-2 p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-900 rounded transition cursor-pointer"
                                                title="Delete this row"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}

                                        {/* Sub-key label */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                            <div className="sm:col-span-1 space-y-1">
                                                <span className="text-[10px] text-slate-500 font-medium">Key Name</span>
                                                <input
                                                    id={`key-label-input-${idx}`}
                                                    type="text"
                                                    value={keyEntry.label}
                                                    onChange={e =>
                                                        handleKeyFieldChange(keyEntry.id, 'label', e.target.value)
                                                    }
                                                    placeholder="e.g. Access Key"
                                                    className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500 font-medium"
                                                    required
                                                />
                                            </div>

                                            <div className="sm:col-span-2 space-y-1">
                                                <span className="text-[10px] text-slate-500 font-medium">
                                                    Secret Value
                                                </span>
                                                <input
                                                    id={`key-value-input-${idx}`}
                                                    type="text"
                                                    value={keyEntry.value}
                                                    onChange={e =>
                                                        handleKeyFieldChange(keyEntry.id, 'value', e.target.value)
                                                    }
                                                    placeholder="Paste API key here..."
                                                    className="w-full px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-200 placeholder-slate-700 focus:outline-none focus:border-indigo-500 font-mono"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Add Key Button */}
                            <button
                                id="add-key-row-button"
                                type="button"
                                onClick={handleAddKeyRow}
                                className="w-full py-1.5 border border-dashed border-slate-800 hover:border-indigo-500/50 hover:bg-slate-950 text-indigo-400 hover:text-indigo-300 font-medium rounded-lg text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer mt-1"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Multi-Key Entry (AK/SK)</span>
                            </button>
                        </div>

                        {/* Description (Optional) */}
                        <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
                            <label className="text-xs font-medium text-slate-300 flex items-center space-x-1">
                                <FileText className="w-3 h-3 text-slate-500" />
                                <span>Notes / Usage Instructions</span>
                            </label>
                            <textarea
                                id="form-description-textarea"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Write specific notes, command lines, or usage environment details..."
                                rows={3}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition font-sans leading-relaxed resize-none"
                            />
                        </div>
                    </form>

                    {/* Footer Actions */}
                    <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/20 flex items-center justify-end space-x-2">
                        <button
                            id="form-cancel-button"
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-slate-800 hover:bg-slate-800 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            id="form-save-button"
                            type="button"
                            onClick={handleSave}
                            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-slate-950 font-medium rounded-lg text-xs transition cursor-pointer shadow-lg shadow-indigo-500/10"
                        >
                            Save API Key
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
