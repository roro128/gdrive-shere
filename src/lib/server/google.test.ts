import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '$lib/server/runtime';
import { encrypt } from './crypto';
import {
  driveConnected,
  getDriveStorageQuota,
  getGoogleConnectionStatus,
  googleAuthorizeUrl
} from './google';

const mockedGetSetting = vi.hoisted(() => vi.fn());
const mockedSetSetting = vi.hoisted(() => vi.fn());

afterEach(() => {
  vi.restoreAllMocks();
  mockedGetSetting.mockReset();
  mockedSetSetting.mockReset();
});

vi.mock('./db', () => ({
  getSetting: mockedGetSetting,
  setSetting: mockedSetSetting
}));
vi.mock('$lib/server/db', () => ({
  getSetting: mockedGetSetting,
  setSetting: mockedSetSetting
}));

function oauthEvent(): RequestEvent {
  return {
    url: new URL('https://gdrive-share.codo.workers.dev/'),
    platform: {
      env: {
        GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: 'client-secret'
      }
    }
  } as unknown as RequestEvent;
}

describe('Google OAuth authorization URLs', () => {
  it('does not force a consent screen for an existing administrator login', () => {
    const url = new URL(googleAuthorizeUrl(oauthEvent(), 'state-value'));

    expect(url.searchParams.get('scope')).toBe('openid email');
    expect(url.searchParams.has('prompt')).toBe(false);
    expect(url.searchParams.has('access_type')).toBe(false);
  });

  it('requests offline Drive consent only while connecting Drive', () => {
    const url = new URL(
      googleAuthorizeUrl(oauthEvent(), 'state-value', {
        requestDriveAccess: true,
        forceConsent: true
      })
    );

    expect(url.searchParams.get('scope')).toContain('https://www.googleapis.com/auth/drive.file');
    expect(url.searchParams.get('scope')).toContain(
      'https://www.googleapis.com/auth/drive.readonly'
    );
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
  });
});

describe('Google Drive connection status', () => {
  it('requires reauthorization when Google rejects the refresh token', async () => {
    const key = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    mockedGetSetting.mockResolvedValue(await encrypt('refresh-token', key));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"error":"invalid_grant"}', { status: 400 })
    );

    await expect(
      getGoogleConnectionStatus({
        platform: {
          env: {
            APP_ENCRYPTION_KEY: key,
            GOOGLE_CLIENT_ID: 'client-id',
            GOOGLE_CLIENT_SECRET: 'client-secret'
          }
        }
      } as unknown as RequestEvent)
    ).resolves.toBe('reauthorization-required');
  });

  it('stores a rotated refresh token without exposing its plaintext', async () => {
    const key = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    mockedGetSetting.mockResolvedValue(await encrypt('old-refresh-token', key));
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response('{"access_token":"access-token","refresh_token":"new-refresh-token"}', {
          status: 200
        })
      )
      .mockResolvedValueOnce(new Response('{"storageQuota":{"usage":"42"}}', { status: 200 }));

    await expect(
      getDriveStorageQuota({
        platform: {
          env: {
            APP_ENCRYPTION_KEY: key,
            GOOGLE_CLIENT_ID: 'client-id',
            GOOGLE_CLIENT_SECRET: 'client-secret'
          }
        }
      } as unknown as RequestEvent)
    ).resolves.toEqual({ limit: null, usage: 42 });

    expect(mockedSetSetting).toHaveBeenCalledWith(
      expect.anything(),
      'google_refresh_token',
      expect.not.stringContaining('new-refresh-token')
    );
  });

  it('reports a stored token as disconnected when token refresh fails', async () => {
    const key = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    mockedGetSetting.mockResolvedValue(await encrypt('refresh-token', key));
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{"error":"invalid_grant"}', { status: 400 }));

    await expect(
      driveConnected({
        platform: {
          env: {
            APP_ENCRYPTION_KEY: key,
            GOOGLE_CLIENT_ID: 'client-id',
            GOOGLE_CLIENT_SECRET: 'client-secret'
          }
        }
      } as unknown as RequestEvent)
    ).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports Drive API rejection as disconnected after a successful token refresh', async () => {
    const key = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    mockedGetSetting.mockResolvedValue(await encrypt('refresh-token', key));
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{"access_token":"access-token"}', { status: 200 }))
      .mockResolvedValueOnce(new Response('forbidden', { status: 403 }));

    await expect(
      driveConnected({
        platform: {
          env: {
            APP_ENCRYPTION_KEY: key,
            GOOGLE_CLIENT_ID: 'client-id',
            GOOGLE_CLIENT_SECRET: 'client-secret'
          }
        }
      } as unknown as RequestEvent)
    ).resolves.toBe(false);
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/drive/v3/about'))).toBe(
      true
    );
  });

  it('refreshes the access token once when Drive rejects an expired token', async () => {
    const key = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    mockedGetSetting.mockImplementation(async (_event: RequestEvent, name: string) =>
      name === 'google_refresh_token' ? encrypt('refresh-token', key) : null
    );
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{"access_token":"expired-token"}', { status: 200 }))
      .mockResolvedValueOnce(new Response('expired', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"access_token":"fresh-token"}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{"storageQuota":{"usage":"42"}}', { status: 200 }));

    await expect(
      getDriveStorageQuota({
        platform: {
          env: {
            APP_ENCRYPTION_KEY: key,
            GOOGLE_CLIENT_ID: 'client-id',
            GOOGLE_CLIENT_SECRET: 'client-secret'
          }
        }
      } as unknown as RequestEvent)
    ).resolves.toEqual({ limit: null, usage: 42 });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(
      new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit | undefined)?.headers).get(
        'authorization'
      )
    ).toBe('Bearer expired-token');
    expect(
      new Headers((fetchMock.mock.calls[3]?.[1] as RequestInit | undefined)?.headers).get(
        'authorization'
      )
    ).toBe('Bearer fresh-token');
  });

  it('reuses one access-token exchange across Drive calls in the same request', async () => {
    const key = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const event = oauthEvent();
    event.platform = {
      ...(event.platform as NonNullable<RequestEvent['platform']>),
      env: {
        APP_ENCRYPTION_KEY: key,
        GOOGLE_CLIENT_ID: 'client-id',
        GOOGLE_CLIENT_SECRET: 'client-secret'
      } as unknown as Env
    };
    mockedGetSetting.mockResolvedValue(await encrypt('refresh-token', key));
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{"access_token":"access-token"}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{"storageQuota":{"usage":"42"}}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{"storageQuota":{"usage":"43"}}', { status: 200 }));

    await Promise.all([getDriveStorageQuota(event), getDriveStorageQuota(event)]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes('/token')).length).toBe(
      1
    );
  });
});
