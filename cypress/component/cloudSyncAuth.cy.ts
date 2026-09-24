import {clearCloudSyncState, loadCloudSyncState, patchCloudSyncState} from '../../src/lib/cloudSync/authStorage';

describe('cloud sync stored state', () => {
    beforeEach(() => {
        localStorage.removeItem('kbox_cloud_sync:v1');
    });

    it('defaults automatic sync to off', () => {
        expect(loadCloudSyncState().autoSync).to.eq(false);
        expect(loadCloudSyncState().session).to.eq(null);
    });

    it('persists automatic sync and clears it on reset', () => {
        patchCloudSyncState({autoSync: true, lastPushAt: '2026-09-17T00:00:00.000Z'});
        expect(loadCloudSyncState().autoSync).to.eq(true);
        expect(loadCloudSyncState().lastPushAt).to.eq('2026-09-17T00:00:00.000Z');

        const reset = clearCloudSyncState();
        expect(reset.autoSync).to.eq(false);
        expect(reset.lastPushAt).to.eq(null);
        expect(loadCloudSyncState().autoSync).to.eq(false);
    });

    it('drops a leftover OneDrive session from older builds', () => {
        localStorage.setItem(
            'kbox_cloud_sync:v1',
            JSON.stringify({
                v: 1,
                session: {provider: 'onedrive', accessToken: 'legacy', expiresAt: Date.now() + 1000},
                localRevision: '2026-01-01T00:00:00.000Z',
                lastPushAt: null,
                lastPullAt: null
            })
        );
        const state = loadCloudSyncState();
        expect(state.session).to.eq(null);
        expect(state.autoSync).to.eq(false);
        expect(state.localRevision).to.eq('2026-01-01T00:00:00.000Z');
    });
});
