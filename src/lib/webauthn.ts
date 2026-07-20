import {arrayBufferToHex, stringToBuffer} from './crypto';

export function isWebAuthnSupported(): boolean {
    return (
        window.PublicKeyCredential !== undefined &&
        typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    );
}

export function isRunningInIframe(): boolean {
    try {
        return window.self !== window.top;
    } catch {
        return true;
    }
}

export type WebAuthnRegistrationResult = {
    credentialId: string;
    signatureHex: string;
    isSimulated?: boolean;
    errorMessage?: string;
};

export type WebAuthnAssertionResult = {
    signatureHex: string;
    isSimulated?: boolean;
    errorMessage?: string;
};

/**
 * Fixed challenge for reproducible client-only key derivation.
 * Not a standard production WebAuthn flow (no server-side challenge verification).
 */
const STATIC_CHALLENGE = new Uint8Array([
    0x6b, 0x62, 0x6f, 0x78, 0x2d, 0x76, 0x61, 0x75, 0x6c, 0x74, 0x2d, 0x63, 0x68, 0x61, 0x6c, 0x6c, 0x65, 0x6e, 0x67,
    0x65, 0x2d, 0x76, 0x31, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01
]);

function hexToUint8Array(hex: string): Uint8Array<ArrayBuffer> {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes as Uint8Array<ArrayBuffer>;
}

export async function registerWebAuthnCredential(username: string): Promise<WebAuthnRegistrationResult> {
    if (!isWebAuthnSupported()) {
        return {
            credentialId: '',
            signatureHex: '',
            errorMessage: 'WebAuthn is not supported by your browser.'
        };
    }

    if (isRunningInIframe()) {
        return {
            credentialId: '',
            signatureHex: '',
            errorMessage: 'Biometrics are unavailable inside an iframe. Use your PIN instead.'
        };
    }

    const rpId = window.location.hostname || 'localhost';

    try {
        const options: CredentialCreationOptions = {
            publicKey: {
                challenge: STATIC_CHALLENGE,
                rp: {
                    name: 'kbox',
                    id: rpId
                },
                user: {
                    id: stringToBuffer(username),
                    name: username,
                    displayName: username
                },
                pubKeyCredParams: [
                    {type: 'public-key', alg: -7},
                    {type: 'public-key', alg: -257}
                ],
                authenticatorSelection: {
                    authenticatorAttachment: 'platform',
                    userVerification: 'required'
                },
                timeout: 30000
            }
        };

        const credential = (await navigator.credentials.create(options)) as PublicKeyCredential | null;

        if (!credential) {
            throw new Error('Credential creation returned null');
        }

        const credentialIdHex = arrayBufferToHex(credential.rawId);
        const dryRunResult = await getWebAuthnAssertion(credentialIdHex);

        if (!dryRunResult.signatureHex) {
            return {
                credentialId: '',
                signatureHex: '',
                errorMessage: dryRunResult.errorMessage ?? 'Failed to complete biometric enrollment.'
            };
        }

        return {
            credentialId: credentialIdHex,
            signatureHex: dryRunResult.signatureHex
        };
    } catch (error: unknown) {
        console.warn('WebAuthn registration failed:', error);
        const message = error instanceof Error ? error.message : 'Unknown error occurred.';
        return {
            credentialId: '',
            signatureHex: '',
            errorMessage: message
        };
    }
}

export async function getWebAuthnAssertion(credentialIdHex: string): Promise<WebAuthnAssertionResult> {
    if (!isWebAuthnSupported() || !credentialIdHex) {
        return {
            signatureHex: '',
            errorMessage: 'WebAuthn is not supported or not initialized.'
        };
    }

    if (isRunningInIframe()) {
        return {
            signatureHex: '',
            errorMessage: 'Biometrics are unavailable inside an iframe. Use your PIN instead.'
        };
    }

    const rpId = window.location.hostname || 'localhost';

    try {
        const credentialIdBuffer = hexToUint8Array(credentialIdHex);

        const options: CredentialRequestOptions = {
            publicKey: {
                challenge: STATIC_CHALLENGE,
                rpId,
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

        const assertion = (await navigator.credentials.get(options)) as PublicKeyCredential | null;

        if (!assertion) {
            throw new Error('Assertion returned null');
        }

        const response = assertion.response as AuthenticatorAssertionResponse;

        return {
            signatureHex: arrayBufferToHex(response.signature)
        };
    } catch (error: unknown) {
        console.warn('WebAuthn assertion failed:', error);
        const message = error instanceof Error ? error.message : 'Unknown error occurred.';
        return {
            signatureHex: '',
            errorMessage: message
        };
    }
}
