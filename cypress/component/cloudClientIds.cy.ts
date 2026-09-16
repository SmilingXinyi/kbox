import {loadCloudClientId, saveCloudClientId} from '../../src/lib/cloudSync/clientIds';

describe('cloud OAuth client IDs', () => {
    beforeEach(() => {
        localStorage.removeItem('kbox_cloud_oauth_clients:v1');
    });

    it('stores public client IDs per provider in this browser', () => {
        expect(loadCloudClientId('google-drive')).to.eq('');
        saveCloudClientId('google-drive', ' 123.apps.googleusercontent.com ');
        expect(loadCloudClientId('google-drive')).to.eq('123.apps.googleusercontent.com');
        expect(loadCloudClientId('onedrive')).to.eq('');

        saveCloudClientId('onedrive', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
        expect(loadCloudClientId('onedrive')).to.eq('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
        expect(loadCloudClientId('google-drive')).to.eq('123.apps.googleusercontent.com');
    });

    it('clears a provider client ID', () => {
        saveCloudClientId('google-drive', 'keep-me');
        saveCloudClientId('onedrive', 'drop-me');
        saveCloudClientId('onedrive', '  ');
        expect(loadCloudClientId('google-drive')).to.eq('keep-me');
        expect(loadCloudClientId('onedrive')).to.eq('');
    });
});
