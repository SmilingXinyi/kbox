import type {ApiKeyItem, LockBehavior, VaultMetadata} from './vault';

export type CloudProviderId = 'google-drive' | 'onedrive';

export const CLOUD_VAULT_FORMAT = 'kbox-cloud-vault' as const;
export const CLOUD_VAULT_VERSION = 1 as const;

/** Encrypted-at-rest vault blob stored on the user's drive. */
export type CloudVaultSnapshot = {
    format: typeof CLOUD_VAULT_FORMAT;
    version: typeof CLOUD_VAULT_VERSION;
    updatedAt: string;
    metadata: VaultMetadata;
    items: ApiKeyItem[];
    lockBehavior: LockBehavior;
    commonTags: string[];
};

export type CloudAuthSession = {
    provider: CloudProviderId;
    accessToken: string;
    refreshToken?: string;
    expiresAt: number;
    accountLabel?: string;
};

export type CloudTransport = {
    id: CloudProviderId;
    label: string;
    isConfigured: () => boolean;
    authorize: () => Promise<CloudAuthSession>;
    refresh: (session: CloudAuthSession) => Promise<CloudAuthSession>;
    upload: (session: CloudAuthSession, body: string) => Promise<void>;
    download: (session: CloudAuthSession) => Promise<string | null>;
};

export type CloudPullMode = 'auto' | 'manual';

export type CloudPullResult =
    | {status: 'applied'; snapshot: CloudVaultSnapshot}
    | {status: 'skipped'; reason: 'local-newer' | 'same-revision'}
    | {status: 'empty'};

export type CloudPushResult = {status: 'pushed'; updatedAt: string} | {status: 'skipped'; reason: 'no-vault'};
