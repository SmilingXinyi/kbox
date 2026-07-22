import type {ReactNode} from 'react';
import {AlertCircle, AlertTriangle, CheckCircle2, Info} from 'lucide-react';

type AlertTone = 'error' | 'warn' | 'info' | 'success';

type AlertProps = {
    tone?: AlertTone;
    children: ReactNode;
    action?: ReactNode;
    className?: string;
};

const TONE_CLASS: Record<AlertTone, string> = {
    error: 'border-danger/30 bg-danger-muted text-danger',
    warn: 'border-warn/30 bg-warn-muted text-warn',
    info: 'border-surface-600 bg-surface-900 text-surface-300',
    success: 'border-accent/30 bg-accent-muted text-accent'
};

const ICONS: Record<AlertTone, typeof AlertCircle> = {
    error: AlertCircle,
    warn: AlertTriangle,
    info: Info,
    success: CheckCircle2
};

export default function Alert({tone = 'error', children, action, className = ''}: AlertProps) {
    const Icon = ICONS[tone];

    return (
        <div
            role={tone === 'error' ? 'alert' : 'status'}
            className={`flex items-start gap-2 p-3 rounded-lg border text-xs leading-relaxed ${TONE_CLASS[tone]} ${className}`}
        >
            <Icon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
            <div className="flex-1 min-w-0 space-y-1.5">
                <div>{children}</div>
                {action}
            </div>
        </div>
    );
}
