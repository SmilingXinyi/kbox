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
                <div className="app-overlay z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
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
                        className={`relative flex flex-col w-full ${maxWidth} h-full max-h-full sm:h-auto sm:max-h-[min(92dvh,100%)] overflow-hidden bg-surface-900 border border-surface-700 border-b-0 sm:border-b rounded-t-2xl sm:rounded-2xl shadow-[0_-8px_40px_rgba(0,0,0,0.45)]`}
                    >
                        <div className="h-1 w-full shrink-0 hazard-stripe rounded-t-2xl sm:rounded-t-2xl" aria-hidden />
                        {!hideHeader && (
                            <div className="shrink-0 px-5 sm:px-6 pt-4 sm:pt-5 pb-3 flex items-start justify-between gap-3 border-b border-surface-800 bg-surface-900">
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
                        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain scrollbar-none sheet-scroll">
                            <div className={`px-5 sm:px-6 safe-pb ${hideHeader ? 'pt-5 sm:pt-6' : 'pt-4 sm:pt-5'}`}>
                                {children}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
