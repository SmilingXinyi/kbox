import {isSyncPayloadValid, toSyncPayload} from '../../src/lib/syncPayload';
import type {ApiKeyItem} from '../../src/types/vault';

describe('syncPayload', () => {
    const sample: ApiKeyItem[] = [
        {
            id: '1',
            label: 'OpenAI',
            tag: 'ai',
            description: 'desc',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-02',
            keys: [
                {
                    id: 'k1',
                    label: 'API',
                    value: 'sk-secret',
                    encryptedValue: 'enc',
                    iv: 'iv'
                }
            ]
        }
    ];

    it('keeps plaintext values and strips ciphertext fields', () => {
        const payload = toSyncPayload(sample);
        expect(payload).to.have.length(1);
        expect(payload[0].keys[0].value).to.eq('sk-secret');
        expect(payload[0].keys[0].encryptedValue).to.eq(undefined);
        expect(payload[0].keys[0].iv).to.eq(undefined);
    });

    it('validates payload shape', () => {
        expect(isSyncPayloadValid(toSyncPayload(sample))).to.eq(true);
        expect(isSyncPayloadValid([{id: '1', label: 'x', keys: []}])).to.eq(true);
        expect(isSyncPayloadValid(null)).to.eq(false);
        expect(isSyncPayloadValid([{id: 1} as never])).to.eq(false);
    });
});
