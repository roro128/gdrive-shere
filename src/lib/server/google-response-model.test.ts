import { describe, expect, it } from 'vitest';
import {
  normalizeStorageQuota,
  planGoogleConnectionPersistence,
  toGoogleConnection,
  toGoogleToken
} from './google-response-model';

describe('google response model', () => {
  it('normalizes numeric storage quota values', () => {
    expect(normalizeStorageQuota({ storageQuota: { limit: '1000', usage: '250' } })).toEqual({
      limit: 1000,
      usage: 250
    });
  });

  it('uses safe defaults for missing or invalid quota values', () => {
    expect(
      normalizeStorageQuota({ storageQuota: { limit: 'not-a-number', usage: 'NaN' } })
    ).toEqual({
      limit: null,
      usage: 0
    });
    expect(normalizeStorageQuota({})).toEqual({ limit: null, usage: 0 });
  });

  it('maps token and profile payloads without mutating either input', () => {
    const tokenPayload = { refresh_token: 'refresh', access_token: 'access' };
    const profilePayload = { email: 'person@example.com', sub: 'subject', name: 'Person' };

    expect(toGoogleToken(tokenPayload)).toEqual({ refreshToken: 'refresh', accessToken: 'access' });
    expect(toGoogleConnection(tokenPayload, profilePayload)).toEqual({
      refreshToken: 'refresh',
      email: 'person@example.com',
      subject: 'subject',
      name: 'Person'
    });
    expect(tokenPayload).toEqual({ refresh_token: 'refresh', access_token: 'access' });
    expect(profilePayload).toEqual({ email: 'person@example.com', sub: 'subject', name: 'Person' });
  });

  it('normalizes missing OAuth fields to null', () => {
    expect(toGoogleToken({})).toEqual({ refreshToken: null, accessToken: null });
    expect(toGoogleConnection({}, undefined)).toEqual({
      refreshToken: null,
      email: null,
      subject: null,
      name: null
    });
  });

  it('plans refresh-token persistence and safe fallback behavior without effects', () => {
    expect(
      planGoogleConnectionPersistence(
        { refreshToken: 'refresh', email: null, subject: null, name: null },
        false
      )
    ).toEqual({ kind: 'persist', refreshToken: 'refresh', email: 'connected' });
    expect(
      planGoogleConnectionPersistence(
        { refreshToken: null, email: null, subject: null, name: null },
        true
      )
    ).toEqual({ kind: 'reuse-existing' });
    expect(
      planGoogleConnectionPersistence(
        { refreshToken: null, email: null, subject: null, name: null },
        false
      )
    ).toMatchObject({ kind: 'error' });
  });
});
