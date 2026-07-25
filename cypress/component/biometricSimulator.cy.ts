import {isBiometricSimulatorEnabled} from '../../src/lib/biometricSimulator';

describe('biometricSimulator gate', () => {
    it('is enabled under Vite DEV (Cypress component runs in DEV)', () => {
        // Production builds set import.meta.env.DEV=false; Cypress mounts the Vite
        // DEV graph, so the sandbox must remain available for local iframe testing.
        expect(isBiometricSimulatorEnabled()).to.eq(true);
    });
});
