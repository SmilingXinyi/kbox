import {useEffect, type ReactNode} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {X} from 'lucide-react';

type ModalProps = {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: ReactNode;
    /** Wider sheet for forms */
    size?: 'md' | 'lg';
    /** Hide the built-in header (caller provides its own) */
    hideHeader?: boolean;
};

export default function Modal({
    isOpen,
    onClose,
    title,
    description,
    children,
    size = 'md',
    hideHeader = false
}: ModalProps) {
    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previous;
        };
    }, [isOpen]);

    const maxWidth = size === 'lg' ? 'sm:max-w-lg' : 'sm:max-w-md';

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
                        transition={{duration: 0.2}}
                        className="absolute inset-0 bg-surface-950/85 backdrop-blur-[2px] cursor-pointer"
                        onClick={onClose}
                    />
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="kbox-modal-title"
                        initial={{opacity: 0, y: 28, scale: 0.98}}
                        animate={{opacity: 1, y: 0, scale: 1}}
                        exit={{opacity: 0, y: 16, scale: 0.98}}
                        transition={{duration: 0.28, ease: [0.32, 0.72, 0, 1]}}
                        className={`relative flex flex-col w-full ${maxWidth} max-h-[92dvh] overflow-hidden bg-surface-900 border border-surface-700 border-b-0 sm:border-b rounded-t-2xl sm:rounded-2xl shadow-[0_-8px_40px_rgba(0,0,0,0.45)]`}
                    >
                        <div className="h-1 w-full shrink-0 hazard-stripe rounded-t-2xl sm:rounded-t-2xl" aria-hidden />
                        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain scrollbar-none">
                            <div className="p-5 sm:p-6 safe-pb">
                                {!hideHeader && (
                                    <div className="flex items-start justify-between gap-3 mb-5">
                                        <div className="min-w-0">
                                            <h2
                                                id="kbox-modal-title"
                                                className="font-display text-lg font-semibold tracking-tight text-surface-100"
                                            >
                                                {title}
                                            </h2>
                                            {description ? (
                                                <p className="text-[11px] text-surface-400 mt-1.5 leading-relaxed">
                                                    {description}
                                                </p>
                                            ) : null}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="shrink-0 p-2.5 -mr-1 -mt-1 min-h-11 min-w-11 inline-flex items-center justify-center text-surface-400 hover:text-surface-100 hover:bg-surface-800 rounded-lg cursor-pointer pressable"
                                            aria-label="Close"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                                {children}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
