import {arrayBufferToHex, generateRandomHex, hexToArrayBuffer} from './crypto';

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
    /** Raw PRF first output (32 bytes when supported). */
    prfOutput: ArrayBuffer | null;
    /** Per-vault salt used for PRF eval (hex). */
    prfSaltHex: string;
    errorMessage?: string;
};

export type WebAuthnAssertionResult = {
    prfOutput: ArrayBuffer | null;
    errorMessage?: string;
};

type PrfExtensionClientOutputs = {
    enabled?: boolean;
    results?: {
        first?: ArrayBuffer;
        second?: ArrayBuffer;
    };
};

/** Shown on the passkey sheet. Unicode (including Chinese) is allowed. */
export const WEBAUTHN_USER_NAME_MAX_LENGTH = 64;

function readPrfExtension(credential: PublicKeyCredential): PrfExtensionClientOutputs | undefined {
    const outputs = credential.getClientExtensionResults() as AuthenticationExtensionsClientOutputs & {
        prf?: PrfExtensionClientOutputs;
    };
    return outputs.prf;
}

function randomChallenge(): Uint8Array<ArrayBuffer> {
    return window.crypto.getRandomValues(new Uint8Array(32)) as Uint8Array<ArrayBuffer>;
}

function hexToUint8Array(hex: string): Uint8Array<ArrayBuffer> {
    return new Uint8Array(hexToArrayBuffer(hex)) as Uint8Array<ArrayBuffer>;
}

function randomUserHandle(): Uint8Array<ArrayBuffer> {
    // WebAuthn user.id is an opaque 1–64 byte handle, not the display name.
    // Encoding CJK (or any long name) as UTF-8 can exceed 64 bytes and fail registration.
    return window.crypto.getRandomValues(new Uint8Array(16)) as Uint8Array<ArrayBuffer>;
}

/**
 * Register a platform credential with the WebAuthn PRF extension enabled, then
 * immediately evaluate PRF so the vault can wrap the master key with a stable KEK.
 *
 * Assertion signatures are NOT used for key derivation (they change with signCount).
 */
export async function registerWebAuthnCredential(username: string): Promise<WebAuthnRegistrationResult> {
    if (!isWebAuthnSupported()) {
        return {
            credentialId: '',
            prfOutput: null,
            prfSaltHex: '',
            errorMessage: 'WebAuthn is not supported by your browser.'
        };
    }

    if (isRunningInIframe()) {
        return {
            credentialId: '',
            prfOutput: null,
            prfSaltHex: '',
            errorMessage: 'Biometrics are unavailable inside an iframe. Use your PIN instead.'
        };
    }

    const rpId = window.location.hostname || 'localhost';
    const prfSaltHex = generateRandomHex(32);

    try {
        const options: CredentialCreationOptions = {
            publicKey: {
                challenge: randomChallenge(),
                rp: {
                    name: 'kbox',
                    id: rpId
                },
                user: {
                    id: randomUserHandle(),
                    name: username,
                    displayName: username
                },
                pubKeyCredParams: [
                    {type: 'public-key', alg: -7},
                    {type: 'public-key', alg: -257}
                ],
                authenticatorSelection: {
                    authenticatorAttachment: 'platform',
                    userVerification: 'required',
                    residentKey: 'preferred'
                },
                timeout: 60000,
                extensions: {
                    // Empty object enables PRF / hmac-secret on supporting authenticators.
                    prf: {}
                } as AuthenticationExtensionsClientInputs
            }
        };

        const credential = (await navigator.credentials.create(options)) as PublicKeyCredential | null;

        if (!credential) {
            throw new Error('Credential creation returned null');
        }

        const credentialIdHex = arrayBufferToHex(credential.rawId);
        const createPrf = readPrfExtension(credential);

        // Some platforms only report `enabled` on create; secrets come from a follow-up get().
        if (createPrf && createPrf.enabled === false) {
            return {
                credentialId: '',
                prfOutput: null,
                prfSaltHex: '',
                errorMessage:
                    'This authenticator does not support WebAuthn PRF. Use PIN only, or try a newer browser / passkey provider.'
            };
        }

        const dryRun = await getWebAuthnAssertion(credentialIdHex, prfSaltHex);
        if (!dryRun.prfOutput) {
            return {
                credentialId: '',
                prfOutput: null,
                prfSaltHex: '',
                errorMessage:
                    dryRun.errorMessage ??
                    'Failed to derive a biometric key (PRF unavailable). Use PIN only on this device.'
            };
        }

        return {
            credentialId: credentialIdHex,
            prfOutput: dryRun.prfOutput,
            prfSaltHex
        };
    } catch (error: unknown) {
        console.warn('WebAuthn registration failed:', error);
        const message = error instanceof Error ? error.message : 'Unknown error occurred.';
        return {
            credentialId: '',
            prfOutput: null,
            prfSaltHex: '',
            errorMessage: message
        };
    }
}

/**
 * Assert an existing credential and evaluate WebAuthn PRF with the vault's salt.
 */
export async function getWebAuthnAssertion(
    credentialIdHex: string,
    prfSaltHex: string
): Promise<WebAuthnAssertionResult> {
    if (!isWebAuthnSupported() || !credentialIdHex || !prfSaltHex) {
        return {
            prfOutput: null,
            errorMessage: 'WebAuthn is not supported or not initialized.'
        };
    }

    if (isRunningInIframe()) {
        return {
            prfOutput: null,
            errorMessage: 'Biometrics are unavailable inside an iframe. Use your PIN instead.'
        };
    }

    const rpId = window.location.hostname || 'localhost';

    try {
        const credentialIdBuffer = hexToUint8Array(credentialIdHex);
        const prfSalt = hexToUint8Array(prfSaltHex);

        const options: CredentialRequestOptions = {
            publicKey: {
                challenge: randomChallenge(),
                rpId,
                allowCredentials: [
                    {
                        type: 'public-key',
                        id: credentialIdBuffer
                    }
                ],
                userVerification: 'required',
                timeout: 60000,
                extensions: {
                    prf: {
                        eval: {
                            first: prfSalt
                        }
                    }
                } as AuthenticationExtensionsClientInputs
            }
        };

        const assertion = (await navigator.credentials.get(options)) as PublicKeyCredential | null;

        if (!assertion) {
            throw new Error('Assertion returned null');
        }

        const prfFirst = readPrfExtension(assertion)?.results?.first;
        if (!prfFirst || prfFirst.byteLength < 32) {
            return {
                prfOutput: null,
                errorMessage: 'Authenticator did not return a PRF secret. Biometric unlock needs a PRF-capable passkey.'
            };
        }

        return {prfOutput: prfFirst};
    } catch (error: unknown) {
        console.warn('WebAuthn assertion failed:', error);
        const message = error instanceof Error ? error.message : 'Unknown error occurred.';
        return {
            prfOutput: null,
            errorMessage: message
        };
    }
}
