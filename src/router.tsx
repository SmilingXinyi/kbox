import {createBrowserRouter} from 'react-router';
import App from './App';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';

/**
 * Central route table. Add pages under `src/pages/` and register them here.
 * Prefer lazy() + Suspense for heavy routes when the app grows.
 */
export const router = createBrowserRouter([
    {
        path: '/',
        element: <App />,
        children: [
            {index: true, element: <HomePage />},
            {path: '*', element: <NotFoundPage />}
        ]
    }
]);
