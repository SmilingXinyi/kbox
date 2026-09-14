import {pullVaultFromCloud, pushVaultToCloud} from '../../src/lib/cloudSync/engine';
import {createMemoryTransport} from '../../src/lib/cloudSync/memoryTransport';
import {
    parseCloudVaultSnapshot,
    serializeCloudVaultSnapshot,
    writeLocalCloudSnapshot
} from '../../src/lib/cloudSync/snapshot';
import {clearVaultStorage, getEncryptedItemsFromDB} from '../../src/lib/indexedDB';
import {saveLockBehavior, saveVaultMetadata} from '../../src/lib/vaultMigration';
import {
    CLOUD_VAULT_FORMAT,
    CLOUD_VAULT_VERSION,
    type CloudAuthSession,
    type CloudVaultSnapshot
} from '../../src/types/cloudSync';
import type {VaultMetadata} from '../../src/types/vault';

const metadata: VaultMetadata = {
    isInitialized: true,
    hasWebAuthn: false,
    salt: 'aabbccdd',
    pinIv: '11223344',
    encryptedMasterKeyWithPin: 'deadbeef'
};

function sessionFor(provider: CloudAuthSession['provider']): CloudAuthSession {
    return {
        provider,
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: Date.now() + 60_000,
        accountLabel: 'test'
    };
}

function snapshot(updatedAt: string, label: string): CloudVaultSnapshot {
    return {
        format: CLOUD_VAULT_FORMAT,
        version: CLOUD_VAULT_VERSION,
        updatedAt,
        metadata,
        lockBehavior: 'once',
        commonTags: ['Cloud'],
        items: [
            {
                id: 'item-1',
                label,
                createdAt: updatedAt,
                updatedAt,
                keys: [{id: 'key-1', label: 'API', value: '', encryptedValue: 'enc-1', iv: 'iv-1'}]
            }
        ]
    };
}

async function seedLocal(updatedAt: string, label: string) {
    await writeLocalCloudSnapshot(snapshot(updatedAt, label));
}

describe('cloud sync engine', () => {
    beforeEach(async () => {
        await clearVaultStorage();
        localStorage.removeItem('kbox_cloud_sync:v1');
    });

    it('pushes the encrypted local vault and pulls it back', async () => {
        const drive = createMemoryTransport('google-drive');
        await seedLocal('2026-09-14T10:00:00.000Z', 'OpenAI');

        const pushed = await pushVaultToCloud(drive, sessionFor('google-drive'), '2026-09-14T10:00:00.000Z');
        expect(pushed.result.status).to.eq('pushed');
        expect(drive.store.body).to.be.a('string');
        expect(drive.store.body).to.include(CLOUD_VAULT_FORMAT);

        saveVaultMetadata({...metadata, encryptedMasterKeyWithPin: 'changed'});
        saveLockBehavior('always');
        await writeLocalCloudSnapshot(snapshot('2026-09-14T11:00:00.000Z', 'LocalOnly'));

        const pulled = await pullVaultFromCloud(drive, sessionFor('google-drive'), {
            mode: 'manual',
            localRevision: '2026-09-14T11:00:00.000Z'
        });
        expect(pulled.result.status).to.eq('applied');
        if (pulled.result.status !== 'applied') return;
        expect(pulled.result.snapshot.items[0].label).to.eq('OpenAI');
    });

    it('skips auto-pull when local revision is newer', async () => {
        const drive = createMemoryTransport('onedrive');
        drive.store.body = serializeCloudVaultSnapshot(snapshot('2026-09-14T09:00:00.000Z', 'OlderCloud'));

        const pulled = await pullVaultFromCloud(drive, sessionFor('onedrive'), {
            mode: 'auto',
            localRevision: '2026-09-14T12:00:00.000Z'
        });
        expect(pulled.result.status).to.eq('skipped');
        if (pulled.result.status !== 'skipped') return;
        expect(pulled.result.reason).to.eq('local-newer');
    });

    it('applies auto-pull when the cloud vault is newer', async () => {
        const drive = createMemoryTransport('google-drive');
        drive.store.body = serializeCloudVaultSnapshot(snapshot('2026-09-14T15:00:00.000Z', 'NewerCloud'));

        const pulled = await pullVaultFromCloud(drive, sessionFor('google-drive'), {
            mode: 'auto',
            localRevision: '2026-09-14T10:00:00.000Z'
        });
        expect(pulled.result.status).to.eq('applied');
        if (pulled.result.status !== 'applied') return;
        expect(pulled.result.snapshot.items[0].label).to.eq('NewerCloud');
    });

    it('still overwrites on a manual pull when local looks newer', async () => {
        const drive = createMemoryTransport('google-drive');
        drive.store.body = serializeCloudVaultSnapshot(snapshot('2026-09-14T09:00:00.000Z', 'ChosenDrive'));

        const pulled = await pullVaultFromCloud(drive, sessionFor('google-drive'), {
            mode: 'manual',
            localRevision: '2026-09-14T12:00:00.000Z'
        });
        expect(pulled.result.status).to.eq('applied');
        if (pulled.result.status !== 'applied') return;
        expect(pulled.result.snapshot.items[0].label).to.eq('ChosenDrive');
    });

    it('returns empty when the drive has no vault file', async () => {
        const drive = createMemoryTransport('google-drive');
        const pulled = await pullVaultFromCloud(drive, sessionFor('google-drive'), {
            mode: 'manual',
            localRevision: null
        });
        expect(pulled.result.status).to.eq('empty');
    });

    it('skips push when this device has no vault', async () => {
        const drive = createMemoryTransport('onedrive');
        const pushed = await pushVaultToCloud(drive, sessionFor('onedrive'), '2026-09-14T10:00:00.000Z');
        expect(pushed.result.status).to.eq('skipped');
        expect(drive.store.body).to.eq(null);
    });

    it('round-trips through writeLocalCloudSnapshot without restoring plaintext', async () => {
        const snap = snapshot('2026-09-14T10:00:00.000Z', 'Stripe');
        snap.items[0].keys[0].value = 'sk-live';
        const parsed = parseCloudVaultSnapshot(serializeCloudVaultSnapshot(snap));
        await writeLocalCloudSnapshot(parsed);
        const stored = await getEncryptedItemsFromDB();
        expect(stored?.[0].keys[0].value).to.eq('');
        expect(stored?.[0].keys[0].encryptedValue).to.eq('enc-1');
    });
});
