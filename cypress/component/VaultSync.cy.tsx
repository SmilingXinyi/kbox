import VaultSync from '../../src/components/vault/VaultSync';
import {createMockSync} from '../support/mockSync';

describe('<VaultSync />', () => {
    it('shows unlock warning and mode buttons when idle', () => {
        const sync = createMockSync({sessionState: 'idle'});
        const onRequestUnlock = cy.stub().as('onRequestUnlock');

        cy.mount(
            <VaultSync isOpen onClose={cy.stub()} sync={sync} isUnlocked={false} onRequestUnlock={onRequestUnlock} />
        );

        cy.contains('Device sync').should('be.visible');
        cy.contains('Unlock the vault before starting sync').should('be.visible');
        cy.contains('button', 'Enable sync service').should('be.disabled');
        cy.contains('button', 'Scan to join').should('be.disabled');

        cy.contains('button', 'Unlock now').click();
        cy.get('@onRequestUnlock').should('have.been.called');
    });

    it('starts host mode when unlocked', () => {
        const sync = createMockSync({sessionState: 'idle'});

        cy.mount(<VaultSync isOpen onClose={cy.stub()} sync={sync} isUnlocked onRequestUnlock={cy.stub()} />);

        cy.contains('button', 'Enable sync service').should('not.be.disabled').click();
        cy.get('@startHost').should('have.been.called');
    });

    it('shows QR while host is waiting', () => {
        const invite = 'kbox-sync:{"v":2,"app":"kbox","peerId":"hostPeer123456","sk":"' + 'a'.repeat(64) + '"}';
        const sync = createMockSync({
            sessionState: 'waiting',
            role: 'host',
            peerId: 'hostPeer123456',
            inviteText: invite,
            pairingCode: 'abcd1234',
            qrDataUrl:
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
        });

        cy.mount(<VaultSync isOpen onClose={cy.stub()} sync={sync} isUnlocked onRequestUnlock={cy.stub()} />);

        cy.contains('Waiting for the other device to scan').should('be.visible');
        cy.get('img[alt="Sync QR code"]').should('be.visible');
        cy.contains('hostPeer123456').should('be.visible');
        cy.contains('abcd1234').should('be.visible');
        cy.contains('button', 'Copy invite').should('be.visible');
    });

    it('shows connected status and merge strategies for host', () => {
        const sync = createMockSync({
            sessionState: 'connected',
            role: 'host',
            localItemCount: 3,
            remote: {role: 'guest', itemCount: 1}
        });

        cy.mount(<VaultSync isOpen onClose={cy.stub()} sync={sync} isUnlocked onRequestUnlock={cy.stub()} />);

        cy.contains('Devices linked — ready to sync').should('be.visible');
        cy.contains('3 keys').should('be.visible');
        cy.contains('1 key').should('be.visible');
        cy.contains('Merge strategy').should('be.visible');
        cy.contains('button', 'A overwrites B').should('be.visible');
        cy.contains('button', 'Read B, overwrite A').should('be.visible');
    });

    it('runs A-overwrites-B after confirm', () => {
        const sync = createMockSync({
            sessionState: 'connected',
            role: 'host',
            localItemCount: 2,
            remote: {role: 'guest', itemCount: 5}
        });

        cy.mount(<VaultSync isOpen onClose={cy.stub()} sync={sync} isUnlocked onRequestUnlock={cy.stub()} />);

        cy.window().then(win => {
            cy.stub(win, 'confirm').as('confirm').returns(true);
        });

        cy.contains('button', 'A overwrites B').click();
        cy.get('@confirm').should('have.been.called');
        cy.get('@runStrategy').should('have.been.calledWith', 'a-overwrites-b');
    });

    it('runs B-overwrites-A after confirm', () => {
        const sync = createMockSync({
            sessionState: 'connected',
            role: 'host',
            localItemCount: 2,
            remote: {role: 'guest', itemCount: 5}
        });

        cy.mount(<VaultSync isOpen onClose={cy.stub()} sync={sync} isUnlocked onRequestUnlock={cy.stub()} />);

        cy.window().then(win => {
            cy.stub(win, 'confirm').returns(true);
        });

        cy.contains('button', 'Read B, overwrite A').click();
        cy.get('@runStrategy').should('have.been.calledWith', 'b-overwrites-a');
    });

    it('shows guest waiting copy when connected as B', () => {
        const sync = createMockSync({
            sessionState: 'connected',
            role: 'guest',
            localItemCount: 1,
            remote: {role: 'host', itemCount: 4}
        });

        cy.mount(<VaultSync isOpen onClose={cy.stub()} sync={sync} isUnlocked onRequestUnlock={cy.stub()} />);

        cy.contains('You will be asked to confirm').should('be.visible');
        cy.contains('Merge strategy').should('not.exist');
    });

    it('shows guest confirm UI for pending host overwrite', () => {
        const sync = createMockSync({
            sessionState: 'connected',
            role: 'guest',
            localItemCount: 2,
            remote: {role: 'host', itemCount: 5},
            pendingIncoming: {
                strategy: 'a-overwrites-b',
                items: [
                    {
                        id: '1',
                        label: 'Demo',
                        createdAt: '2026-01-01',
                        updatedAt: '2026-01-01',
                        keys: [{id: 'k1', label: 'API', value: 'secret'}]
                    }
                ]
            }
        });

        cy.mount(<VaultSync isOpen onClose={cy.stub()} sync={sync} isUnlocked onRequestUnlock={cy.stub()} />);

        cy.contains('replace THIS vault').should('be.visible');
        cy.contains('button', 'Accept overwrite').click();
        cy.get('@acceptIncomingSync').should('have.been.called');
    });

    it('rejects pending pull request from guest UI', () => {
        const sync = createMockSync({
            sessionState: 'connected',
            role: 'guest',
            pendingIncoming: {strategy: 'b-overwrites-a'}
        });

        cy.mount(<VaultSync isOpen onClose={cy.stub()} sync={sync} isUnlocked onRequestUnlock={cy.stub()} />);

        cy.contains('pull THIS vault').should('be.visible');
        cy.contains('button', 'Reject').click();
        cy.get('@rejectIncomingSync').should('have.been.called');
    });

    it('shows sync complete banner', () => {
        const sync = createMockSync({
            sessionState: 'synced',
            role: 'host',
            localItemCount: 4,
            lastSyncedCount: 4,
            remote: {role: 'guest', itemCount: 4}
        });

        cy.mount(<VaultSync isOpen onClose={cy.stub()} sync={sync} isUnlocked onRequestUnlock={cy.stub()} />);

        cy.contains('Sync complete').should('be.visible');
        cy.contains('4 items applied').should('be.visible');
    });

    it('stops the session on close', () => {
        const sync = createMockSync({sessionState: 'waiting', role: 'host', peerId: 'x'});
        const onClose = cy.stub().as('onClose');

        cy.mount(<VaultSync isOpen onClose={onClose} sync={sync} isUnlocked onRequestUnlock={cy.stub()} />);

        cy.get('[aria-label="Close"]').click();
        cy.get('@stop').should('have.been.called');
        cy.get('@onClose').should('have.been.called');
    });
});
