import {Outlet} from 'react-router';

/**
 * Root layout shell. Page-level vault UI lives in HomePage.
 */
export default function App() {
    return (
        <div id="app" className="h-full overflow-hidden overscroll-none">
            <Outlet />
        </div>
    );
}
