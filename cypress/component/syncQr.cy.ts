import {encodeSyncQrPayload, parseSyncQrPayload, renderSyncQrDataUrl} from '../../src/lib/syncQr';

describe('syncQr', () => {
    const peerId = 'abcDEFghiJKLmnop';

    it('encodes a prefixed payload', () => {
        const encoded = encodeSyncQrPayload(peerId);
        expect(encoded.startsWith('kbox-sync:')).to.eq(true);
        expect(encoded).to.contain('"app":"kbox"');
        expect(encoded).to.contain(`"peerId":"${peerId}"`);
    });

    it('round-trips prefixed QR text', () => {
        const encoded = encodeSyncQrPayload(peerId);
        expect(parseSyncQrPayload(encoded)?.peerId).to.eq(peerId);
    });

    it('accepts bare PeerJS ids', () => {
        expect(parseSyncQrPayload(peerId)?.peerId).to.eq(peerId);
    });

    it('accepts raw JSON payloads', () => {
        const raw = JSON.stringify({v: 1, app: 'kbox', peerId: 'xyzABC12345'});
        expect(parseSyncQrPayload(raw)?.peerId).to.eq('xyzABC12345');
    });

    it('rejects invalid input', () => {
        expect(parseSyncQrPayload('nope')).to.eq(null);
        expect(parseSyncQrPayload('ab')).to.eq(null);
        expect(parseSyncQrPayload('{"v":2,"app":"kbox","peerId":"x"}')).to.eq(null);
    });

    it('renders a PNG data URL', () => {
        cy.wrap(renderSyncQrDataUrl(peerId)).then(dataUrl => {
            expect(String(dataUrl).startsWith('data:image/png;base64,')).to.eq(true);
        });
    });
});
