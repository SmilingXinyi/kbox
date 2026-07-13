import {Link} from 'react-router';

export default function NotFoundPage() {
    return (
        <main>
            <h1>Page not found</h1>
            <p>The page you requested does not exist.</p>
            <Link to="/">Back to home</Link>
        </main>
    );
}
