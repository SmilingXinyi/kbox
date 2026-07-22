import type {ButtonHTMLAttributes, ReactNode} from 'react';

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    active?: boolean;
    children: ReactNode;
};

export default function IconButton({
    label,
    active = false,
    className = '',
    type = 'button',
    children,
    ...rest
}: IconButtonProps) {
    return (
        <button
            type={type}
            aria-label={label}
            title={label}
            className={[
                'inline-flex items-center justify-center min-h-11 min-w-11 p-2.5 rounded-lg border cursor-pointer pressable',
                active
                    ? 'text-accent border-accent/40 bg-accent-muted'
                    : 'text-surface-300 hover:text-surface-100 hover:bg-surface-800 border-surface-700',
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
