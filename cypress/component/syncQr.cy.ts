import {encodeSyncQrPayload, parseSyncQrPayload, renderSyncQrDataUrl} from '../../src/lib/syncQr';

describe('syncQr', () => {
    const peerId = 'abcDEFghiJKLmnop';
    const sessionKey = 'a'.repeat(64);

    it('encodes a prefixed v2 payload with session key', () => {
        const encoded = encodeSyncQrPayload(peerId, sessionKey);
        expect(encoded.startsWith('kbox-sync:')).to.eq(true);
        expect(encoded).to.contain('"v":2');
        expect(encoded).to.contain('"app":"kbox"');
        expect(encoded).to.contain(`"peerId":"${peerId}"`);
        expect(encoded).to.contain(`"sk":"${sessionKey}"`);
    });

    it('round-trips prefixed QR text', () => {
        const encoded = encodeSyncQrPayload(peerId, sessionKey);
        const parsed = parseSyncQrPayload(encoded);
        expect(parsed?.peerId).to.eq(peerId);
        expect(parsed?.sk).to.eq(sessionKey);
        expect(parsed?.v).to.eq(2);
    });

    it('rejects bare PeerJS ids (no session key)', () => {
        expect(parseSyncQrPayload(peerId)).to.eq(null);
    });

    it('accepts raw JSON v2 payloads', () => {
        const raw = JSON.stringify({v: 2, app: 'kbox', peerId: 'xyzABC12345', sk: sessionKey});
        expect(parseSyncQrPayload(raw)?.peerId).to.eq('xyzABC12345');
        expect(parseSyncQrPayload(raw)?.sk).to.eq(sessionKey);
    });

    it('rejects invalid or insecure input', () => {
        expect(parseSyncQrPayload('nope')).to.eq(null);
        expect(parseSyncQrPayload('ab')).to.eq(null);
        expect(parseSyncQrPayload('{"v":1,"app":"kbox","peerId":"x"}')).to.eq(null);
        expect(parseSyncQrPayload(`{"v":2,"app":"kbox","peerId":"x","sk":"short"}`)).to.eq(null);
    });

    it('renders a PNG data URL', () => {
        cy.wrap(renderSyncQrDataUrl(peerId, sessionKey)).then(dataUrl => {
            expect(String(dataUrl).startsWith('data:image/png;base64,')).to.eq(true);
        });
    });
});
