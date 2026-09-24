import type {CloudAuthSession, CloudProviderId, CloudTransport} from '../../types/cloudSync';

type MemoryStore = {
    body: string | null;
};

export function createMemoryTransport(
    id: CloudProviderId = 'google-drive',
    label = 'Google Drive'
): CloudTransport & {store: MemoryStore} {
    const store: MemoryStore = {body: null};

    const transport: CloudTransport & {store: MemoryStore} = {
        id,
        label,
        store,
        isConfigured: () => true,
        authorize: async () => ({
            provider: id,
            accessToken: `memory-${id}`,
            refreshToken: `refresh-${id}`,
            expiresAt: Date.now() + 60 * 60 * 1000,
            accountLabel: `${label} (memory)`
        }),
        refresh: async (session: CloudAuthSession) => ({
            ...session,
            accessToken: `memory-${id}-refreshed`,
            expiresAt: Date.now() + 60 * 60 * 1000
        }),
        upload: async (_session, body) => {
            store.body = body;
        },
        download: async () => store.body
    };

    return transport;
}
