import {useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {PlusSquare, Share, Smartphone, X} from 'lucide-react';
import {useIosInstallHint} from '../../hooks/useIosInstallHint';
import type {DisplayProbe} from '../../lib/iosInstallHint';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

type IosInstallHintProps = {
    probe?: DisplayProbe;
};

const STEPS = [
    {
        icon: Share,
        title: 'Tap Share',
        body: "Open Safari's Share icon — the square with an up arrow — in the toolbar."
    },
    {
        icon: PlusSquare,
        title: 'Add to Home Screen',
        body: 'Scroll the share sheet and tap Add to Home Screen. Confirm with Add.'
    },
    {
        icon: Smartphone,
        title: 'Open from the Home Screen',
        body: 'Launch KBox from the new icon. It runs full-screen, like a native app.'
    }
] as const;

export default function IosInstallHint({probe}: IosInstallHintProps) {
    const hint = useIosInstallHint({probe});
    const [guideOpen, setGuideOpen] = useState(false);
    const [dismissOpen, setDismissOpen] = useState(false);
    const [neverAgain, setNeverAgain] = useState(false);

    const deviceWord = hint.isIpad ? 'iPad' : 'iPhone';

    const confirmHide = () => {
        if (neverAgain) {
            hint.dismissForever();
        } else {
            hint.dismissForSession();
        }
        setDismissOpen(false);
        setNeverAgain(false);
    };

    const cancelHide = () => {
        setDismissOpen(false);
        setNeverAgain(false);
    };

    return (
        <>
            <AnimatePresence>
                {hint.visible ? (
                    <motion.div
                        key="ios-install-hint"
                        role="region"
                        aria-label="Add KBox to Home Screen"
                        initial={{opacity: 0, y: -12}}
                        animate={{opacity: 1, y: 0}}
                        exit={{opacity: 0, y: -8}}
                        transition={{duration: 0.28, ease: [0.32, 0.72, 0, 1]}}
                        className="shrink-0 z-30 border-b border-accent/25 bg-surface-900/95 backdrop-blur-md safe-pt"
                    >
                        <div className="h-0.5 hazard-stripe" aria-hidden />
                        <div className="max-w-5xl mx-auto px-3 py-2 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setGuideOpen(true)}
                                className="flex-1 min-w-0 min-h-11 flex items-center gap-3 text-left cursor-pointer pressable rounded-lg px-1 -mx-1"
                                aria-haspopup="dialog"
                            >
                                <span className="shrink-0 p-2 rounded-lg bg-accent-muted border border-accent/30 text-accent">
                                    <Share className="w-4 h-4" aria-hidden />
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-xs font-semibold text-surface-100 font-display tracking-tight">
                                        Add KBox to Home Screen
                                    </span>
                                    <span className="block text-[11px] text-surface-400 mt-0.5 truncate">
                                        Tap for steps · Safari on {deviceWord}
                                    </span>
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setDismissOpen(true)}
                                className="shrink-0 p-2.5 min-h-11 min-w-11 inline-flex items-center justify-center text-surface-400 hover:text-surface-100 hover:bg-surface-800 rounded-lg cursor-pointer pressable"
                                aria-label="Hide install hint"
                            >
                                <X className="w-4 h-4" aria-hidden />
                            </button>
                        </div>
                    </motion.div>
                ) : null}
            </AnimatePresence>

            <Modal
                isOpen={guideOpen}
                onClose={() => setGuideOpen(false)}
                title={`Install on this ${deviceWord}`}
                description="iOS Safari has no Install button. Add KBox to your Home Screen from the Share sheet instead."
            >
                <ol className="space-y-3">
                    {STEPS.map((step, index) => {
                        const Icon = step.icon;
                        return (
                            <li
                                key={step.title}
                                className="flex items-start gap-3 p-3 rounded-lg border border-surface-700 bg-surface-950/50"
                            >
                                <span className="shrink-0 w-8 h-8 rounded-lg bg-accent-muted border border-accent/25 text-accent inline-flex items-center justify-center">
                                    <Icon className="w-4 h-4" aria-hidden />
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-sm text-surface-100">
                                        <span className="font-mono text-[11px] text-accent mr-2">
                                            {String(index + 1).padStart(2, '0')}
                                        </span>
                                        {step.title}
                                    </span>
                                    <span className="block text-[11px] text-surface-400 mt-1 leading-relaxed">
                                        {step.body}
                                    </span>
                                </span>
                            </li>
                        );
                    })}
                </ol>
                <Button fullWidth className="mt-5" onClick={() => setGuideOpen(false)}>
                    Got it
                </Button>
            </Modal>

            <Modal
                isOpen={dismissOpen}
                onClose={cancelHide}
                title="Hide install hint?"
                description="You can still add KBox later from Safari's Share sheet."
            >
                <label className="flex items-start gap-3 p-3 min-h-11 rounded-lg border border-surface-700 hover:border-surface-600 cursor-pointer pressable">
                    <input
                        type="checkbox"
                        checked={neverAgain}
                        onChange={e => setNeverAgain(e.target.checked)}
                        className="mt-1 accent-[var(--color-accent)]"
                    />
                    <span>
                        <span className="block text-sm text-surface-100">Never show again</span>
                        <span className="block text-[11px] text-surface-400 mt-0.5 leading-relaxed">
                            Saved on this device only. Clear site data to restore the hint.
                        </span>
                    </span>
                </label>
                <div className="mt-5 flex items-center gap-2">
                    <Button variant="secondary" fullWidth onClick={cancelHide}>
                        Keep showing
                    </Button>
                    <Button fullWidth onClick={confirmHide}>
                        Hide
                    </Button>
                </div>
            </Modal>
        </>
    );
}
