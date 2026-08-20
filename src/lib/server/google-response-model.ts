export type StorageQuotaPayload = {
  storageQuota?: { limit?: string; usage?: string };
};

export type NormalizedStorageQuota = {
  limit: number | null;
  usage: number;
};

export type GoogleTokenPayload = {
  refresh_token?: string;
  access_token?: string;
};

export type GoogleToken = {
  refreshToken: string | null;
  accessToken: string | null;
};

export type GoogleProfilePayload = {
  email?: string;
  email_verified?: boolean;
  sub?: string;
  name?: string;
};

export type GoogleConnection = {
  refreshToken: string | null;
  email: string | null;
  emailVerified: boolean;
  subject: string | null;
  name: string | null;
};

export type GoogleConnectionPersistencePlan =
  | { kind: 'reuse-existing' }
  | { kind: 'persist'; refreshToken: string; email: string }
  | { kind: 'error'; message: string };

export function planGoogleConnectionPersistence(
  connection: GoogleConnection,
  hasStoredRefreshToken: boolean
): GoogleConnectionPersistencePlan {
  if (connection.refreshToken) {
    return {
      kind: 'persist',
      refreshToken: connection.refreshToken,
      email: connection.email ?? 'connected'
    };
  }
  if (hasStoredRefreshToken) return { kind: 'reuse-existing' };
  return {
    kind: 'error',
    message: 'Google refresh token이 발급되지 않았습니다. Drive 연결을 다시 시도해주세요.'
  };
}

export function normalizeStorageQuota(payload: StorageQuotaPayload): NormalizedStorageQuota {
  const limit = payload.storageQuota?.limit ? Number(payload.storageQuota.limit) : null;
  const usage = Number(payload.storageQuota?.usage ?? 0);
  return {
    limit: limit !== null && Number.isFinite(limit) ? limit : null,
    usage: Number.isFinite(usage) ? usage : 0
  };
}

export function toGoogleToken(payload: GoogleTokenPayload): GoogleToken {
  return {
    refreshToken: payload.refresh_token ?? null,
    accessToken: payload.access_token ?? null
  };
}

export function toGoogleConnection(
  tokenPayload: GoogleTokenPayload,
  profilePayload?: GoogleProfilePayload
): GoogleConnection {
  return {
    refreshToken: tokenPayload.refresh_token ?? null,
    email: profilePayload?.email ?? null,
    emailVerified: profilePayload?.email_verified === true,
    subject: profilePayload?.sub ?? null,
    name: profilePayload?.name ?? null
  };
}
