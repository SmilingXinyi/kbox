import {toSyncPayload} from '../../src/lib/syncPayload';
import {
    decryptSyncItems,
    encryptSyncItems,
    generateSyncSessionKeyHex,
    importSyncSessionKey,
    syncKeyConfirmFingerprint
} from '../../src/lib/syncCrypto';
import type {ApiKeyItem} from '../../src/types/vault';

describe('syncCrypto', () => {
    const sample: ApiKeyItem[] = [
        {
            id: '1',
            label: 'OpenAI',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-02',
            keys: [{id: 'k1', label: 'API', value: 'sk-secret'}]
        }
    ];

    it('round-trips encrypted vault items', () => {
        const keyHex = generateSyncSessionKeyHex();
        cy.wrap(
            (async () => {
                const key = await importSyncSessionKey(keyHex);
                const envelope = await encryptSyncItems(toSyncPayload(sample), key);
                expect(envelope.iv).to.match(/^[0-9a-f]+$/);
                expect(envelope.ciphertext).to.match(/^[0-9a-f]+$/);
                expect(envelope.ciphertext).to.not.contain('sk-secret');

                const decrypted = await decryptSyncItems(envelope, key);
                expect(decrypted[0].keys[0].value).to.eq('sk-secret');
            })()
        );
    });

    it('produces a stable pairing fingerprint', () => {
        const keyHex = 'b'.repeat(64);
        cy.wrap(
            (async () => {
                const a = await syncKeyConfirmFingerprint(keyHex);
                const b = await syncKeyConfirmFingerprint(keyHex.toUpperCase());
                expect(a).to.have.length(8);
                expect(a).to.eq(b);
            })()
        );
    });

    it('fails decrypt with the wrong session key', () => {
        cy.wrap(
            (async () => {
                const keyA = await importSyncSessionKey(generateSyncSessionKeyHex());
                const keyB = await importSyncSessionKey(generateSyncSessionKeyHex());
                const envelope = await encryptSyncItems(toSyncPayload(sample), keyA);
                let failed = false;
                try {
                    await decryptSyncItems(envelope, keyB);
                } catch {
                    failed = true;
                }
                expect(failed).to.eq(true);
            })()
        );
    });
});
