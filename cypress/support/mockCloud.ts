import type {UseCloudSyncReturn} from '../../src/hooks/useCloudSync';
import type {CloudAuthSession, CloudProviderId} from '../../src/types/cloudSync';

type MockCloudOverrides = Partial<UseCloudSyncReturn>;

const DEFAULT_PROVIDERS: UseCloudSyncReturn['providers'] = [
    {id: 'google-drive', label: 'Google Drive', configured: true},
    {id: 'onedrive', label: 'OneDrive', configured: true}
];

export function createMockCloud(overrides: MockCloudOverrides = {}): UseCloudSyncReturn {
    const session = (overrides.session ?? null) as CloudAuthSession | null;

    return {
        providers: DEFAULT_PROVIDERS,
        session,
        localRevision: overrides.localRevision ?? null,
        lastPushAt: overrides.lastPushAt ?? null,
        lastPullAt: overrides.lastPullAt ?? null,
        status: overrides.status ?? 'idle',
        error: overrides.error ?? null,
        lastResult: overrides.lastResult ?? null,
        isBusy: overrides.isBusy ?? false,
        connect: cy.stub().as('cloudConnect').resolves(),
        disconnect: cy.stub().as('cloudDisconnect'),
        pull: cy.stub().as('cloudPull').resolves(),
        schedulePush: cy.stub().as('cloudSchedulePush'),
        clearError: cy.stub().as('cloudClearError'),
        ...overrides
    };
}

export function configuredProvider(id: CloudProviderId, configured: boolean) {
    const label = id === 'google-drive' ? 'Google Drive' : 'OneDrive';
    return {id, label, configured};
}
