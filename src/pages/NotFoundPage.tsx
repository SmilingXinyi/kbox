import {Link} from 'react-router';

export default function NotFoundPage() {
    return (
        <main className="min-h-full h-full flex flex-col items-center justify-center gap-4 p-6 text-center bg-surface-950 text-surface-100 safe-pt safe-pb">
            <div className="h-1 w-24 hazard-stripe rounded-full mb-2" aria-hidden />
            <p className="font-display text-accent text-sm font-semibold tracking-wide">kbox</p>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Page not found</h1>
            <p className="text-sm text-surface-400 max-w-sm">The page you requested does not exist.</p>
            <Link
                to="/"
                className="mt-2 inline-flex min-h-11 items-center px-4 rounded-lg bg-accent text-on-accent text-sm font-medium hover:bg-accent-dim pressable"
            >
                Back to vault
            </Link>
        </main>
    );
}
