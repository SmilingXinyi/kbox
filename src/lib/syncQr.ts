import QRCode from 'qrcode';
import type {SyncQrPayload} from '../types/sync';

const QR_PREFIX = 'kbox-sync:';

export function encodeSyncQrPayload(peerId: string): string {
    const payload: SyncQrPayload = {v: 1, app: 'kbox', peerId};
    return `${QR_PREFIX}${JSON.stringify(payload)}`;
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
        if (parsed.v === 1 && parsed.app === 'kbox' && typeof parsed.peerId === 'string' && parsed.peerId.length > 0) {
            return {v: 1, app: 'kbox', peerId: parsed.peerId};
        }
    } catch {
        // Fall through — allow bare peer IDs from PeerJS.
    }

    if (/^[a-zA-Z0-9_-]{5,64}$/.test(trimmed)) {
        return {v: 1, app: 'kbox', peerId: trimmed};
    }

    return null;
}

export async function renderSyncQrDataUrl(peerId: string): Promise<string> {
    const text = encodeSyncQrPayload(peerId);
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
