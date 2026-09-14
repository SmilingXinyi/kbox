import {
    compareIsoTimestamps,
    createCloudVaultFile,
    decryptCloudVaultFile,
    isCloudVaultFile,
    parseCloudVaultFile,
    serializeCloudVaultFile
} from '../../src/lib/cloudSync/snapshot';
import {CLOUD_VAULT_FORMAT, CLOUD_VAULT_VERSION} from '../../src/types/cloudSync';
import {deriveKeyFromPin, encryptMasterKey, generateRandomHex} from '../../src/lib/crypto';
import type {CloudPushContext} from '../../src/types/cloudSync';
import type {VaultMetadata} from '../../src/types/vault';

const PIN = '123456';

async function makeContext(label: string): Promise<{context: CloudPushContext; masterKeyHex: string}> {
    const masterKeyHex = generateRandomHex(32);
    const salt = generateRandomHex(16);
    const wrapped = await encryptMasterKey(masterKeyHex, await deriveKeyFromPin(PIN, salt));
    const metadata: VaultMetadata = {
        isInitialized: true,
        hasWebAuthn: true,
        webauthnCredentialId: 'device-bound',
        salt,
        pinIv: wrapped.iv,
        encryptedMasterKeyWithPin: wrapped.ciphertext
    };
    return {
        masterKeyHex,
        context: {
            masterKeyHex,
            metadata,
            lockBehavior: 'delay-1m',
            commonTags: ['AI'],
            items: [
                {
                    id: 'item-1',
                    label,
                    createdAt: '2026-09-01T00:00:00.000Z',
                    updatedAt: '2026-09-01T00:00:00.000Z',
                    keys: [{id: 'key-1', label: 'API', value: 'sk-should-not-leave'}]
                }
            ]
        }
    };
}

describe('cloud vault snapshot', () => {
    it('stores one ciphertext blob with no plaintext labels or secrets', async () => {
        const {context} = await makeContext('OpenAI');
        const file = await createCloudVaultFile(context, '2026-09-14T10:00:00.000Z');
        const raw = serializeCloudVaultFile(file);

        expect(isCloudVaultFile(file)).to.eq(true);
        expect(file.version).to.eq(CLOUD_VAULT_VERSION);
        expect(raw).to.include(CLOUD_VAULT_FORMAT);
        expect(raw).to.not.include('OpenAI');
        expect(raw).to.not.include('sk-should-not-leave');
        expect(raw).to.not.include('device-bound');
        expect(Object.keys(JSON.parse(raw) as object)).to.not.include('items');
        expect(Object.keys(JSON.parse(raw) as object)).to.not.include('metadata');
    });

    it('round-trips through PIN and master key', async () => {
        const {context, masterKeyHex} = await makeContext('OpenAI');
        const file = await createCloudVaultFile(context, '2026-09-14T10:00:00.000Z');
        const viaPin = await decryptCloudVaultFile(file, {pin: PIN});
        const viaKey = await decryptCloudVaultFile(file, {masterKeyHex});

        expect(viaPin.items[0].label).to.eq('OpenAI');
        expect(viaPin.items[0].keys[0].value).to.eq('sk-should-not-leave');
        expect(viaPin.metadata.hasWebAuthn).to.eq(false);
        expect(viaKey.masterKeyHex).to.eq(masterKeyHex);
        expect(viaPin.masterKeyHex).to.eq(masterKeyHex);
    });

    it('rejects junk envelopes and the wrong PIN', async () => {
        expect(() => parseCloudVaultFile('{')).to.throw('not valid JSON');
        expect(() => parseCloudVaultFile('{"format":"nope"}')).to.throw('unsupported');

        const {context} = await makeContext('OpenAI');
        const file = await createCloudVaultFile(context, '2026-09-14T10:00:00.000Z');
        let failed = false;
        try {
            await decryptCloudVaultFile(file, {pin: '000000'});
        } catch (e) {
            failed = e instanceof Error && e.message.includes('Incorrect PIN');
        }
        expect(failed).to.eq(true);
    });

    it('compares ISO timestamps', () => {
        expect(compareIsoTimestamps('2026-09-14T12:00:00.000Z', '2026-09-14T10:00:00.000Z')).to.be.greaterThan(0);
        expect(compareIsoTimestamps('2026-09-14T10:00:00.000Z', '2026-09-14T12:00:00.000Z')).to.be.lessThan(0);
        expect(compareIsoTimestamps('2026-09-14T10:00:00.000Z', '2026-09-14T10:00:00.000Z')).to.eq(0);
    });
});
