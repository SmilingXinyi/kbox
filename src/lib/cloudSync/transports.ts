import type {CloudProviderId, CloudTransport} from '../../types/cloudSync';
import {googleDriveTransport} from './googleDrive';

const TRANSPORTS: Record<CloudProviderId, CloudTransport> = {
    'google-drive': googleDriveTransport
};

export const CLOUD_PROVIDER_IDS: CloudProviderId[] = ['google-drive'];

export function getCloudTransport(id: CloudProviderId): CloudTransport {
    return TRANSPORTS[id];
}

export function listCloudTransports(): CloudTransport[] {
    return CLOUD_PROVIDER_IDS.map(id => TRANSPORTS[id]);
}
