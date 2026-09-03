import {usePWA} from '../../src/hooks/usePWA';
import {registerServiceWorker} from '../../src/lib/registerServiceWorker';

type ListenerMap = Map<string, Set<EventListenerOrEventListenerObject>>;

function addListener(map: ListenerMap, type: string, listener: EventListenerOrEventListenerObject) {
    let set = map.get(type);
    if (!set) {
        set = new Set();
        map.set(type, set);
    }
    set.add(listener);
}

function removeListener(map: ListenerMap, type: string, listener: EventListenerOrEventListenerObject) {
    map.get(type)?.delete(listener);
}

function emit(map: ListenerMap, type: string, target: EventTarget) {
    const event = new Event(type);
    map.get(type)?.forEach(listener => {
        if (typeof listener === 'function') {
            listener.call(target, event);
        } else {
            listener.handleEvent(event);
        }
    });
}

function Probe() {
    const api = usePWA({enabled: true});
    return (
        <div>
            <span data-cy="update">{api.updateAvailable ? 'yes' : 'no'}</span>
            <button type="button" data-cy="upgrade" onClick={api.upgrade}>
                Upgrade
            </button>
            <button type="button" data-cy="dismiss" onClick={api.dismissUpdate}>
                Dismiss
            </button>
        </div>
    );
}

describe('PWA registration & updates', () => {
    let registrationListeners: ListenerMap;
    let installingListeners: ListenerMap;
    let swListeners: ListenerMap;
    let waitingWorker: {state: string; postMessage: ReturnType<typeof cy.stub>};
    let installingWorker: {
        state: string;
        addEventListener: ReturnType<typeof cy.stub>;
        removeEventListener: ReturnType<typeof cy.stub>;
    };
    let registration: {
        waiting: typeof waitingWorker | null;
        installing: typeof installingWorker | null;
        update: ReturnType<typeof cy.stub>;
        addEventListener: ReturnType<typeof cy.stub>;
        removeEventListener: ReturnType<typeof cy.stub>;
    };
    let registerStub: ReturnType<typeof cy.stub>;
    let readyResolve: (reg: typeof registration) => void;

    beforeEach(() => {
        registrationListeners = new Map();
        installingListeners = new Map();
        swListeners = new Map();

        waitingWorker = {
            state: 'installed',
            postMessage: cy.stub().as('postMessage')
        };

        installingWorker = {
            state: 'installing',
            addEventListener: cy
                .stub()
                .callsFake(
                    (type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions) => {
                        addListener(installingListeners, type, listener);
                        if (options?.signal) {
                            options.signal.addEventListener('abort', () => {
                                removeListener(installingListeners, type, listener);
                            });
                        }
                    }
                ),
            removeEventListener: cy.stub().callsFake((type: string, listener: EventListenerOrEventListenerObject) => {
                removeListener(installingListeners, type, listener);
            })
        };

        registration = {
            waiting: null,
            installing: null,
            update: cy.stub().resolves().as('regUpdate'),
            addEventListener: cy
                .stub()
                .callsFake(
                    (type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions) => {
                        addListener(registrationListeners, type, listener);
                        if (options?.signal) {
                            options.signal.addEventListener('abort', () => {
                                removeListener(registrationListeners, type, listener);
                            });
                        }
                    }
                ),
            removeEventListener: cy.stub().callsFake((type: string, listener: EventListenerOrEventListenerObject) => {
                removeListener(registrationListeners, type, listener);
            })
        };

        registerStub = cy.stub().resolves(registration).as('swRegister');

        cy.window().then(win => {
            const ready = new Promise<typeof registration>(resolve => {
                readyResolve = resolve;
            });

            Object.defineProperty(win.navigator, 'serviceWorker', {
                configurable: true,
                value: {
                    ready,
                    controller: {} as ServiceWorker,
                    register: registerStub,
                    addEventListener: (
                        type: string,
                        listener: EventListenerOrEventListenerObject,
                        options?: AddEventListenerOptions
                    ) => {
                        addListener(swListeners, type, listener);
                        if (options?.signal) {
                            options.signal.addEventListener('abort', () => {
                                removeListener(swListeners, type, listener);
                            });
                        }
                    },
                    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
                        removeListener(swListeners, type, listener);
                    }
                }
            });
        });
    });

    it('registerServiceWorker registers when enabled and document is complete', () => {
        cy.document().then(doc => {
            expect(doc.readyState).to.eq('complete');
        });

        cy.window().then(() => {
            registerServiceWorker({enabled: true});
        });

        cy.get('@swRegister').should('have.been.calledWith', '/sw.js', {updateViaCache: 'none'});
    });

    it('registerServiceWorker is a no-op when disabled', () => {
        cy.window().then(() => {
            registerServiceWorker({enabled: false});
        });

        cy.get('@swRegister').should('not.have.been.called');
    });

    it('surfaces updateAvailable when a waiting worker already exists', () => {
        cy.window().then(() => {
            registration.waiting = waitingWorker;
            readyResolve(registration);
        });

        cy.mount(<Probe />);
        cy.get('[data-cy=update]').should('have.text', 'yes');
    });

    it('surfaces updateAvailable after installing worker reaches installed', () => {
        cy.window().then(() => {
            readyResolve(registration);
        });

        cy.mount(<Probe />);
        cy.get('[data-cy=update]').should('have.text', 'no');

        cy.window().then(() => {
            registration.installing = installingWorker;
            emit(registrationListeners, 'updatefound', registration as unknown as EventTarget);
            installingWorker.state = 'installed';
            emit(installingListeners, 'statechange', installingWorker as unknown as EventTarget);
        });

        cy.get('[data-cy=update]').should('have.text', 'yes');
    });

    it('upgrade posts SKIP_WAITING to the waiting worker', () => {
        cy.window().then(() => {
            registration.waiting = waitingWorker;
            readyResolve(registration);
        });

        cy.mount(<Probe />);
        cy.get('[data-cy=update]').should('have.text', 'yes');
        cy.get('[data-cy=upgrade]').click();
        cy.get('@postMessage').should('have.been.calledWith', {type: 'SKIP_WAITING'});
    });

    it('dismissUpdate hides the banner without activating the worker', () => {
        cy.window().then(() => {
            registration.waiting = waitingWorker;
            readyResolve(registration);
        });

        cy.mount(<Probe />);
        cy.get('[data-cy=update]').should('have.text', 'yes');
        cy.get('[data-cy=dismiss]').click();
        cy.get('[data-cy=update]').should('have.text', 'no');
        cy.get('@postMessage').should('not.have.been.called');
    });

    it('requests registration.update when the tab becomes visible', () => {
        cy.window().then(() => {
            readyResolve(registration);
        });

        cy.mount(<Probe />);
        cy.get('@regUpdate').should('have.been.called');

        cy.document().then(doc => {
            Object.defineProperty(doc, 'visibilityState', {
                configurable: true,
                get: () => 'visible'
            });
            doc.dispatchEvent(new Event('visibilitychange'));
        });

        cy.get('@regUpdate').should('have.been.calledTwice');
    });
});
