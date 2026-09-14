import {
    compareIsoTimestamps,
    isCloudVaultSnapshot,
    parseCloudVaultSnapshot,
    serializeCloudVaultSnapshot
} from '../../src/lib/cloudSync/snapshot';
import {CLOUD_VAULT_FORMAT, CLOUD_VAULT_VERSION, type CloudVaultSnapshot} from '../../src/types/cloudSync';
import type {VaultMetadata} from '../../src/types/vault';

const metadata: VaultMetadata = {
    isInitialized: true,
    hasWebAuthn: false,
    salt: 'aabbccdd',
    pinIv: '11223344',
    encryptedMasterKeyWithPin: 'deadbeef'
};

function sampleSnapshot(overrides: Partial<CloudVaultSnapshot> = {}): CloudVaultSnapshot {
    return {
        format: CLOUD_VAULT_FORMAT,
        version: CLOUD_VAULT_VERSION,
        updatedAt: '2026-09-14T10:00:00.000Z',
        metadata,
        lockBehavior: 'delay-1m',
        commonTags: ['AI'],
        items: [
            {
                id: 'item-1',
                label: 'OpenAI',
                createdAt: '2026-09-01T00:00:00.000Z',
                updatedAt: '2026-09-01T00:00:00.000Z',
                keys: [
                    {
                        id: 'key-1',
                        label: 'API',
                        value: 'sk-should-not-leave',
                        encryptedValue: 'enc',
                        iv: 'iv'
                    }
                ]
            }
        ],
        ...overrides
    };
}

describe('cloud vault snapshot', () => {
    it('strips plaintext secret values on serialize', () => {
        const json = serializeCloudVaultSnapshot(sampleSnapshot());
        const parsed = JSON.parse(json) as CloudVaultSnapshot;
        expect(parsed.items[0].keys[0].value).to.eq('');
        expect(parsed.items[0].keys[0].encryptedValue).to.eq('enc');
        expect(isCloudVaultSnapshot(parsed)).to.eq(true);
    });

    it('parses a valid snapshot and rejects junk', () => {
        const json = serializeCloudVaultSnapshot(sampleSnapshot());
        const parsed = parseCloudVaultSnapshot(json);
        expect(parsed.metadata.encryptedMasterKeyWithPin).to.eq('deadbeef');
        expect(parsed.items[0].keys[0].value).to.eq('');

        expect(() => parseCloudVaultSnapshot('{')).to.throw('not valid JSON');
        expect(() => parseCloudVaultSnapshot('{"format":"nope"}')).to.throw('unsupported');
    });

    it('compares ISO timestamps', () => {
        expect(compareIsoTimestamps('2026-09-14T12:00:00.000Z', '2026-09-14T10:00:00.000Z')).to.be.greaterThan(0);
        expect(compareIsoTimestamps('2026-09-14T10:00:00.000Z', '2026-09-14T12:00:00.000Z')).to.be.lessThan(0);
        expect(compareIsoTimestamps('2026-09-14T10:00:00.000Z', '2026-09-14T10:00:00.000Z')).to.eq(0);
    });
});
