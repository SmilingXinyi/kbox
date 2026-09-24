import type {UseCloudSyncReturn} from '../../src/hooks/useCloudSync';
import type {CloudAuthSession, CloudProviderId} from '../../src/types/cloudSync';

type MockCloudOverrides = Partial<UseCloudSyncReturn>;

const DEFAULT_PROVIDERS: UseCloudSyncReturn['providers'] = [
    {id: 'google-drive', label: 'Google Drive', configured: true, clientId: 'mock-google-client'}
];

export function createMockCloud(overrides: MockCloudOverrides = {}): UseCloudSyncReturn {
    const session = (overrides.session ?? null) as CloudAuthSession | null;

    return {
        providers: DEFAULT_PROVIDERS,
        session,
        localRevision: overrides.localRevision ?? null,
        lastPushAt: overrides.lastPushAt ?? null,
        lastPullAt: overrides.lastPullAt ?? null,
        autoSync: overrides.autoSync ?? false,
        status: overrides.status ?? 'idle',
        error: overrides.error ?? null,
        lastResult: overrides.lastResult ?? null,
        isBusy: overrides.isBusy ?? false,
        connect: cy.stub().as('cloudConnect').resolves(),
        disconnect: cy.stub().as('cloudDisconnect'),
        reset: cy.stub().as('cloudReset'),
        pull: cy.stub().as('cloudPull').resolves(),
        push: cy.stub().as('cloudPush').resolves(),
        saveClientId: cy.stub().as('cloudSaveClientId'),
        setAutoSync: cy.stub().as('cloudSetAutoSync'),
        schedulePush: cy.stub().as('cloudSchedulePush'),
        clearError: cy.stub().as('cloudClearError'),
        ...overrides
    };
}

export function configuredProvider(id: CloudProviderId, configured: boolean) {
    return {id, label: 'Google Drive', configured, clientId: configured ? `mock-${id}` : ''};
}
