import QRCode from 'qrcode';
import type {SyncQrPayload} from '../types/sync';

const QR_PREFIX = 'kbox-sync:';
const SESSION_KEY_HEX_RE = /^[0-9a-f]{64}$/i;

export function encodeSyncQrPayload(peerId: string, sessionKeyHex: string): string {
    const payload: SyncQrPayload = {v: 2, app: 'kbox', peerId, sk: sessionKeyHex.toLowerCase()};
    return `${QR_PREFIX}${JSON.stringify(payload)}`;
}

function isValidSessionKey(sk: unknown): sk is string {
    return typeof sk === 'string' && SESSION_KEY_HEX_RE.test(sk);
}

export function parseSyncQrPayload(raw: string): SyncQrPayload | null {
    const trimmed = raw.trim();
    let jsonText = trimmed;

    if (trimmed.startsWith(QR_PREFIX)) {
        jsonText = trimmed.slice(QR_PREFIX.length);
    } else {
        try {
            const url = new URL(trimmed);
            const fromQuery = url.searchParams.get('sync') ?? url.searchParams.get('peer');
            if (fromQuery) {
                jsonText = fromQuery.startsWith(QR_PREFIX) ? fromQuery.slice(QR_PREFIX.length) : fromQuery;
            }
        } catch {
            // Not a URL — try raw JSON below.
        }
    }

    try {
        const parsed = JSON.parse(jsonText) as Partial<SyncQrPayload>;
        if (
            parsed.v === 2 &&
            parsed.app === 'kbox' &&
            typeof parsed.peerId === 'string' &&
            parsed.peerId.length > 0 &&
            isValidSessionKey(parsed.sk)
        ) {
            return {v: 2, app: 'kbox', peerId: parsed.peerId, sk: parsed.sk.toLowerCase()};
        }
    } catch {
        // Fall through.
    }

    // Bare PeerJS ids are intentionally rejected — they cannot carry the session key.
    return null;
}

export async function renderSyncQrDataUrl(peerId: string, sessionKeyHex: string): Promise<string> {
    const text = encodeSyncQrPayload(peerId, sessionKeyHex);
    return QRCode.toDataURL(text, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 280,
        color: {
            dark: '#0c1117',
            light: '#e8eef4'
        }
    });
}
