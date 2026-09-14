import type {CloudProviderId, CloudTransport} from '../../types/cloudSync';
import {googleDriveTransport} from './googleDrive';
import {oneDriveTransport} from './oneDrive';

const TRANSPORTS: Record<CloudProviderId, CloudTransport> = {
    'google-drive': googleDriveTransport,
    onedrive: oneDriveTransport
};

export const CLOUD_PROVIDER_IDS: CloudProviderId[] = ['google-drive', 'onedrive'];

export function getCloudTransport(id: CloudProviderId): CloudTransport {
    return TRANSPORTS[id];
}

export function listCloudTransports(): CloudTransport[] {
    return CLOUD_PROVIDER_IDS.map(id => TRANSPORTS[id]);
}
