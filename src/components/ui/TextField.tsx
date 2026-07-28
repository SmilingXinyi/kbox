import type {InputHTMLAttributes, ReactNode, TextareaHTMLAttributes} from 'react';

type SharedFieldProps = {
    label: string;
    hint?: string;
    trailingLabel?: ReactNode;
    className?: string;
};

type TextFieldProps = SharedFieldProps &
    Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & {
        multiline?: false;
    };

type TextAreaFieldProps = SharedFieldProps &
    Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> & {
        multiline: true;
    };

/* Always 16px: iOS Safari auto-zooms focused fields under 16px (incl. landscape phones at sm+). */
const CONTROL =
    'w-full min-h-11 px-3 py-2.5 bg-surface-950 border border-surface-700 rounded-lg text-base text-surface-100 placeholder:text-surface-600 focus:outline-none focus:border-accent transition';

export default function TextField(props: TextFieldProps | TextAreaFieldProps) {
    const {label, hint, trailingLabel, className = '', multiline, ...rest} = props;

    return (
        <div className={`space-y-1.5 ${className}`}>
            <label className="text-xs font-medium text-surface-300 flex items-center justify-between gap-2">
                <span>{label}</span>
                {trailingLabel ? (
                    <span className="text-[10px] text-surface-400 font-normal">{trailingLabel}</span>
                ) : null}
            </label>
            {multiline ? (
                <textarea
                    className={`${CONTROL} resize-y min-h-[4.5rem]`}
                    {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
                />
            ) : (
                <input className={CONTROL} {...(rest as InputHTMLAttributes<HTMLInputElement>)} />
            )}
            {hint ? <p className="text-[11px] text-surface-400 leading-normal">{hint}</p> : null}
        </div>
    );
}
