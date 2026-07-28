import {useState} from 'react';
import {Plus, Trash2} from 'lucide-react';
import type {ApiKeyItem, KeyEntry} from '../../types/vault';
import Modal from '../ui/Modal';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import TextField from '../ui/TextField';

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
        <form onSubmit={handleSave} className="space-y-4">
            {error && <Alert tone="error">{error}</Alert>}

            <TextField
                label="Label"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="e.g. AWS Production"
                required
            />

            <TextField
                label="Tag"
                value={tag}
                onChange={e => setTag(e.target.value)}
                placeholder="Optional"
                list="kbox-common-tags"
            />
            <datalist id="kbox-common-tags">
                {commonTags.map(t => (
                    <option key={t} value={t} />
                ))}
            </datalist>

            <TextField
                multiline
                label="Description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                placeholder="Optional notes"
            />

            <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-surface-300">Secrets</span>
                    <button
                        type="button"
                        onClick={handleAddKeyRow}
                        className="min-h-9 px-2 text-xs text-accent hover:text-accent-dim inline-flex items-center gap-1 cursor-pointer pressable"
                    >
                        <Plus className="w-3.5 h-3.5" aria-hidden />
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
                                className="flex-1 min-h-11 px-2.5 py-2 bg-surface-900 border border-surface-700 rounded-md text-base text-surface-100 focus:outline-none focus:border-accent"
                            />
                            {keys.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => handleRemoveKeyRow(keyEntry.id)}
                                    className="p-2.5 min-h-11 min-w-11 inline-flex items-center justify-center text-surface-400 hover:text-danger cursor-pointer pressable"
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
                            className="w-full min-h-11 px-2.5 py-2 bg-surface-900 border border-surface-700 rounded-md text-base font-mono text-surface-100 focus:outline-none focus:border-accent"
                        />
                    </div>
                ))}
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
                <Button type="button" variant="secondary" fullWidth onClick={onClose}>
                    Cancel
                </Button>
                <Button type="submit" fullWidth disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                </Button>
            </div>
        </form>
    );
}

export default function ApiKeyForm({isOpen, onClose, onSave, existingItems, commonTags, editItem}: ApiKeyFormProps) {
    // Remount fields when the edited item changes so local state resets cleanly.
    const formKey = editItem?.id ?? 'new';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editItem ? 'Edit API key' : 'Add API key'} size="lg">
            <ApiKeyFormFields
                key={formKey}
                onClose={onClose}
                onSave={onSave}
                existingItems={existingItems}
                commonTags={commonTags}
                editItem={editItem}
            />
        </Modal>
    );
}
