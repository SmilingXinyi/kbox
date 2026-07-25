/**
 * BiometricSimulator uses fixed key material and must never ship enabled in production.
 * Allow only Vite DEV, or an explicit opt-in for sandboxed previews.
 */
export function isBiometricSimulatorEnabled(): boolean {
    if (import.meta.env.DEV) return true;
    return import.meta.env.VITE_ENABLE_BIOMETRIC_SIMULATOR === 'true';
}
