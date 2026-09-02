/** Build-time git tag (or package version fallback), injected by Vite. */
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION || 'dev';
