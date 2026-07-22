import type {ButtonHTMLAttributes, ReactNode} from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
    children: ReactNode;
};

const VARIANT_CLASS: Record<ButtonVariant, string> = {
    primary: 'bg-accent hover:bg-accent-dim text-on-accent font-medium border border-transparent',
    secondary:
        'bg-surface-800 hover:bg-surface-700 text-surface-100 border border-surface-600 hover:border-surface-400',
    ghost: 'bg-transparent hover:bg-surface-800 text-surface-300 hover:text-surface-100 border border-transparent',
    danger: 'bg-danger-muted hover:bg-danger/20 text-danger border border-danger/30'
};

const SIZE_CLASS: Record<ButtonSize, string> = {
    sm: 'min-h-9 px-3 py-1.5 text-xs gap-1.5',
    md: 'min-h-11 px-4 py-2.5 text-sm gap-2',
    lg: 'min-h-12 px-5 py-3 text-sm gap-2'
};

export default function Button({
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    className = '',
    type = 'button',
    disabled,
    children,
    ...rest
}: ButtonProps) {
    return (
        <button
            type={type}
            disabled={disabled}
            className={[
                'inline-flex items-center justify-center rounded-lg cursor-pointer pressable',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:transform-none',
                VARIANT_CLASS[variant],
                SIZE_CLASS[size],
                fullWidth ? 'w-full' : '',
                className
            ]
                .filter(Boolean)
                .join(' ')}
            {...rest}
        >
            {children}
        </button>
    );
}
