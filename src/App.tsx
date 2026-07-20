import {Outlet} from 'react-router';

/**
 * Root layout shell. Page-level vault UI lives in HomePage.
 */
export default function App() {
    return (
        <div id="app" className="min-h-dvh">
            <Outlet />
        </div>
    );
}
