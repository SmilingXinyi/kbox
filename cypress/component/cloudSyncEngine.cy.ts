import {pullVaultFromCloud, pushVaultToCloud} from '../../src/lib/cloudSync/engine';
import {createMemoryTransport} from '../../src/lib/cloudSync/memoryTransport';
import {createCloudVaultFile, serializeCloudVaultFile} from '../../src/lib/cloudSync/snapshot';
import {deriveKeyFromPin, encryptMasterKey, generateRandomHex} from '../../src/lib/crypto';
import type {CloudAuthSession, CloudPushContext} from '../../src/types/cloudSync';
import type {VaultMetadata} from '../../src/types/vault';

const PIN = '123456';

function sessionFor(provider: CloudAuthSession['provider']): CloudAuthSession {
    return {
        provider,
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: Date.now() + 60_000,
        accountLabel: 'test'
    };
}

async function makeContext(label: string): Promise<CloudPushContext> {
    const masterKeyHex = generateRandomHex(32);
    const salt = generateRandomHex(16);
    const wrapped = await encryptMasterKey(masterKeyHex, await deriveKeyFromPin(PIN, salt));
    const metadata: VaultMetadata = {
        isInitialized: true,
        hasWebAuthn: false,
        salt,
        pinIv: wrapped.iv,
        encryptedMasterKeyWithPin: wrapped.ciphertext
    };
    return {
        masterKeyHex,
        metadata,
        lockBehavior: 'once',
        commonTags: ['Cloud'],
        items: [
            {
                id: 'item-1',
                label,
                createdAt: '2026-09-14T10:00:00.000Z',
                updatedAt: '2026-09-14T10:00:00.000Z',
                keys: [{id: 'key-1', label: 'API', value: `secret-${label}`}]
            }
        ]
    };
}

describe('cloud sync engine', () => {
    beforeEach(() => {
        localStorage.removeItem('kbox_cloud_sync:v1');
    });

    it('pushes a whole-file blob and pulls plaintext back', async () => {
        const drive = createMemoryTransport('google-drive');
        const context = await makeContext('OpenAI');

        const pushed = await pushVaultToCloud(drive, sessionFor('google-drive'), context, '2026-09-14T10:00:00.000Z');
        expect(pushed.result.status).to.eq('pushed');
        expect(drive.store.body).to.be.a('string');
        expect(drive.store.body).to.not.include('OpenAI');
        expect(drive.store.body).to.not.include('secret-OpenAI');

        const pulled = await pullVaultFromCloud(drive, sessionFor('google-drive'), {
            mode: 'manual',
            localRevision: '2026-09-14T11:00:00.000Z',
            secret: {pin: PIN}
        });
        expect(pulled.result.status).to.eq('applied');
        if (pulled.result.status !== 'applied') return;
        expect(pulled.result.snapshot.items[0].label).to.eq('OpenAI');
        expect(pulled.result.snapshot.items[0].keys[0].value).to.eq('secret-OpenAI');
    });

    it('skips auto-pull when local revision is newer', async () => {
        const drive = createMemoryTransport('google-drive');
        const context = await makeContext('OlderCloud');
        drive.store.body = serializeCloudVaultFile(await createCloudVaultFile(context, '2026-09-14T09:00:00.000Z'));

        const pulled = await pullVaultFromCloud(drive, sessionFor('google-drive'), {
            mode: 'auto',
            localRevision: '2026-09-14T12:00:00.000Z',
            secret: {masterKeyHex: context.masterKeyHex}
        });
        expect(pulled.result.status).to.eq('skipped');
        if (pulled.result.status !== 'skipped') return;
        expect(pulled.result.reason).to.eq('local-newer');
    });

    it('applies auto-pull when the cloud vault is newer', async () => {
        const drive = createMemoryTransport('google-drive');
        const context = await makeContext('NewerCloud');
        drive.store.body = serializeCloudVaultFile(await createCloudVaultFile(context, '2026-09-14T15:00:00.000Z'));

        const pulled = await pullVaultFromCloud(drive, sessionFor('google-drive'), {
            mode: 'auto',
            localRevision: '2026-09-14T10:00:00.000Z',
            secret: {masterKeyHex: context.masterKeyHex}
        });
        expect(pulled.result.status).to.eq('applied');
        if (pulled.result.status !== 'applied') return;
        expect(pulled.result.snapshot.items[0].label).to.eq('NewerCloud');
    });

    it('still overwrites on a manual pull when local looks newer', async () => {
        const drive = createMemoryTransport('google-drive');
        const context = await makeContext('ChosenDrive');
        drive.store.body = serializeCloudVaultFile(await createCloudVaultFile(context, '2026-09-14T09:00:00.000Z'));

        const pulled = await pullVaultFromCloud(drive, sessionFor('google-drive'), {
            mode: 'manual',
            localRevision: '2026-09-14T12:00:00.000Z',
            secret: {pin: PIN}
        });
        expect(pulled.result.status).to.eq('applied');
        if (pulled.result.status !== 'applied') return;
        expect(pulled.result.snapshot.items[0].label).to.eq('ChosenDrive');
    });

    it('returns empty when the drive has no vault file', async () => {
        const drive = createMemoryTransport('google-drive');
        const pulled = await pullVaultFromCloud(drive, sessionFor('google-drive'), {
            mode: 'manual',
            localRevision: null,
            secret: {pin: PIN}
        });
        expect(pulled.result.status).to.eq('empty');
    });

    it('skips push when this device has no unlocked vault', async () => {
        const drive = createMemoryTransport('google-drive');
        const pushed = await pushVaultToCloud(drive, sessionFor('google-drive'), null, '2026-09-14T10:00:00.000Z');
        expect(pushed.result.status).to.eq('skipped');
        expect(drive.store.body).to.eq(null);
    });
});
