import {KBOX_GOOGLE_DRIVE_CLIENT_ID, loadCloudClientId, saveCloudClientId} from '../../src/lib/cloudSync/clientIds';

describe('cloud OAuth client IDs', () => {
    beforeEach(() => {
        localStorage.removeItem('kbox_cloud_oauth_clients:v1');
    });

    it('uses the shipped Google Drive client ID until overridden', () => {
        expect(loadCloudClientId('google-drive')).to.eq(KBOX_GOOGLE_DRIVE_CLIENT_ID);
    });

    it('stores a public Google client ID in this browser', () => {
        saveCloudClientId('google-drive', ' 123.apps.googleusercontent.com ');
        expect(loadCloudClientId('google-drive')).to.eq('123.apps.googleusercontent.com');
    });

    it('clears a Google client ID back to the builtin default', () => {
        saveCloudClientId('google-drive', 'keep-me');
        saveCloudClientId('google-drive', '');
        expect(loadCloudClientId('google-drive')).to.eq(KBOX_GOOGLE_DRIVE_CLIENT_ID);
    });
});
