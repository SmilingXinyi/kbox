import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {RouterProvider} from 'react-router';
import {router} from './router';
import {registerServiceWorker} from './lib/registerServiceWorker';
import {registerMobileFormFocus} from './lib/mobileFormFocus';
import './index.css';

registerServiceWorker();
registerMobileFormFocus();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <RouterProvider router={router} />
    </StrictMode>
);
