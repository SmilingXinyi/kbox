import type {UseWebRTCSyncReturn} from '../../src/hooks/useWebRTCSync';
import type {SyncSessionState, SyncRole, SyncPeerSummary} from '../../src/types/sync';

type MockSyncOverrides = Partial<UseWebRTCSyncReturn> & {
    sessionState?: SyncSessionState;
    role?: SyncRole | null;
    remote?: SyncPeerSummary | null;
};

export function createMockSync(overrides: MockSyncOverrides = {}): UseWebRTCSyncReturn {
    const sessionState = overrides.sessionState ?? 'idle';

    return {
        sessionState,
        role: overrides.role ?? null,
        peerId: overrides.peerId ?? null,
        qrDataUrl: overrides.qrDataUrl ?? null,
        remote: overrides.remote ?? null,
        error: overrides.error ?? null,
        lastSyncedCount: overrides.lastSyncedCount ?? null,
        pendingIncoming: overrides.pendingIncoming ?? null,
        localItemCount: overrides.localItemCount ?? 0,
        isActive: sessionState !== 'idle' && sessionState !== 'closed',
        isConnected: sessionState === 'connected' || sessionState === 'syncing' || sessionState === 'synced',
        clearError: cy.stub().as('clearError'),
        startHost: cy.stub().as('startHost').resolves(),
        startGuestScan: cy.stub().as('startGuestScan'),
        connectWithQrText: cy.stub().as('connectWithQrText').resolves(),
        runStrategy: cy.stub().as('runStrategy').resolves(),
        acceptIncomingSync: cy.stub().as('acceptIncomingSync').resolves(),
        rejectIncomingSync: cy.stub().as('rejectIncomingSync'),
        stop: cy.stub().as('stop'),
        ...overrides
    };
}
