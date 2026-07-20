import {Link} from 'react-router';

export default function NotFoundPage() {
    return (
        <main className="min-h-dvh flex flex-col items-center justify-center gap-3 p-6 text-center bg-surface-950 text-surface-100">
            <h1 className="text-xl font-semibold">Page not found</h1>
            <p className="text-sm text-surface-400">The page you requested does not exist.</p>
            <Link to="/" className="text-sm text-accent hover:text-accent-dim underline underline-offset-2">
                Back to home
            </Link>
        </main>
    );
}
