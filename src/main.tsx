import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {RouterProvider} from 'react-router';
import {router} from './router';
import {registerServiceWorker} from './lib/registerServiceWorker';
import {bindSafeAreaSync} from './lib/safeArea';
import './index.css';

bindSafeAreaSync();
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <RouterProvider router={router} />
    </StrictMode>
);
