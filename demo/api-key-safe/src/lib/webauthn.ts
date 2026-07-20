// WebAuthn Helpers for API Key Safe
import {arrayBufferToHex, stringToBuffer} from './crypto';

// Check if native WebAuthn is supported by the browser
export function isWebAuthnSupported(): boolean {
    return (
        window.PublicKeyCredential !== undefined &&
        typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    );
}

// Check if the current window is running inside an iframe
export function isRunningInIframe(): boolean {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
}

export interface WebAuthnRegistrationResult {
    credentialId: string;
    signatureHex: string; // Used to derive the key
    isSimulated: boolean;
    errorMessage?: string;
}

export interface WebAuthnAssertionResult {
    signatureHex: string;
    isSimulated: boolean;
    errorMessage?: string;
}

// Fixed challenge to generate reproducible signature-based keys
const STATIC_CHALLENGE = new Uint8Array([
    0x61, 0x70, 0x69, 0x2d, 0x6b, 0x65, 0x79, 0x2d, 0x73, 0x61, 0x66, 0x65, 0x2d, 0x63, 0x68, 0x61, 0x6c, 0x6c, 0x65,
    0x6e, 0x67, 0x65, 0x2d, 0x76, 0x31, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01
]);

/**
 * Register a platform biometric authenticator
 */
export async function registerWebAuthnCredential(username: string): Promise<WebAuthnRegistrationResult> {
    if (!isWebAuthnSupported()) {
        return {
            credentialId: '',
            signatureHex: '',
            isSimulated: true,
            errorMessage: 'WebAuthn is not supported by your browser.'
        };
    }

    const rpId = window.location.hostname || 'localhost';

    try {
        // Attempt real WebAuthn registration
        const options: CredentialCreationOptions = {
            publicKey: {
                challenge: STATIC_CHALLENGE,
                rp: {
                    name: 'API Key Safe',
                    id: rpId
                },
                user: {
                    id: stringToBuffer(username),
                    name: username,
                    displayName: username
                },
                pubKeyCredParams: [
                    {type: 'public-key', alg: -7}, // ES256 (standard EC)
                    {type: 'public-key', alg: -257} // RS256 (standard RSA)
                ],
                authenticatorSelection: {
                    authenticatorAttachment: 'platform', // Touch ID / Face ID / Windows Hello
                    userVerification: 'required'
                },
                timeout: 30000
            }
        };

        const credential = (await navigator.credentials.create(options)) as PublicKeyCredential;

        if (!credential) {
            throw new Error('Credential creation returned null');
        }

        // Since we don't have a server to sign and send back, we can extract the public key
        // or use a sha256 hash of the credential raw ID combined with a static salt to represent the "secret" Key.
        // However, to ensure user verification occurred, the actual biometric-verified key is best derived
        // by signing a challenge using `navigator.credentials.get`.
        const credentialIdHex = arrayBufferToHex(credential.rawId);

        // Let's perform a dry-run sign to derive our initial encryption key
        const dryRunResult = await getWebAuthnAssertion(credentialIdHex);

        return {
            credentialId: credentialIdHex,
            signatureHex: dryRunResult.signatureHex,
            isSimulated: false
        };
    } catch (error: any) {
        console.warn('Real WebAuthn failed, switching to Sandbox Simulator:', error);

        let userFriendlyMsg = error?.message || 'Unknown error occurred.';
        if (isRunningInIframe()) {
            userFriendlyMsg =
                'Blocked by browser security rules inside iframes. Biometrics require top-level secure contexts.';
        }

        return {
            credentialId: '',
            signatureHex: '',
            isSimulated: true,
            errorMessage: userFriendlyMsg
        };
    }
}

/**
 * Request biometric assertion signature to derive the decryption key
 */
export async function getWebAuthnAssertion(credentialIdHex: string): Promise<WebAuthnAssertionResult> {
    if (!isWebAuthnSupported() || !credentialIdHex) {
        return {
            signatureHex: '',
            isSimulated: true,
            errorMessage: 'WebAuthn is not supported or not initialized.'
        };
    }

    const rpId = window.location.hostname || 'localhost';

    try {
        const credentialIdBuffer = hexToArrayBuffer(credentialIdHex);

        const options: CredentialRequestOptions = {
            publicKey: {
                challenge: STATIC_CHALLENGE,
                rpId: rpId,
                allowCredentials: [
                    {
                        type: 'public-key',
                        id: credentialIdBuffer
                    }
                ],
                userVerification: 'required',
                timeout: 30000
            }
        };

        const assertion = (await navigator.credentials.get(options)) as PublicKeyCredential;

        if (!assertion) {
            throw new Error('Assertion returned null');
        }

        const response = assertion.response as AuthenticatorAssertionResponse;
        const signatureBuffer = response.signature;

        return {
            signatureHex: arrayBufferToHex(signatureBuffer),
            isSimulated: false
        };
    } catch (error: any) {
        console.warn('WebAuthn assertion failed, falling back to simulated validation:', error);

        let userFriendlyMsg = error?.message || 'Unknown error occurred.';
        if (isRunningInIframe()) {
            userFriendlyMsg = 'Iframe security restrictions blocked Face ID / Touch ID.';
        }

        return {
            signatureHex: '',
            isSimulated: true,
            errorMessage: userFriendlyMsg
        };
    }
}

// Utility to convert hex back to array buffer
function hexToArrayBuffer(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}
