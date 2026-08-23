import { describe, expect, it, vi } from 'vitest';
import { hashPassword } from './crypto';
import type { RequestEvent } from './runtime';

const database = vi.hoisted(() => vi.fn());

vi.mock('./db', async () => {
  const actual = await vi.importActual<typeof import('./db')>('./db');
  return { ...actual, database };
});

import { currentUser, loginWithLegacyPassword } from './auth';

function event(cookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() }): RequestEvent {
  return {
    request: new Request('https://gshare.test/api/auth/password/login'),
    url: new URL('https://gshare.test/api/auth/password/login'),
    params: {},
    cookies
  } as unknown as RequestEvent;
}

function databaseWithUser(user: unknown, credentialPassword?: string) {
  const insertValues = vi.fn().mockReturnValue({
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } })
  });
  const get = vi
    .fn()
    .mockResolvedValueOnce(user)
    .mockResolvedValueOnce(credentialPassword ? { password: credentialPassword } : null);
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({ get })
      })
    }),
    insert: () => ({ values: insertValues })
  };
  database.mockReturnValue(db);
  return { insertValues, get };
}

function databaseWithLegacySession(joined: unknown) {
  const get = vi.fn().mockResolvedValue(joined);
  database.mockReturnValue({
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({ get })
        })
      })
    })
  });
  return get;
}

describe('legacy password login compatibility', () => {
  it('accepts an active pre-Better-Auth account and creates a session', async () => {
    const passwordHash = await hashPassword('correct horse battery staple');
    const { insertValues } = databaseWithUser({
      id: 'legacy-user-1',
      role: 'member',
      status: 'active',
      login_id: 'member',
      password_hash: passwordHash
    });
    const cookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };

    await loginWithLegacyPassword(event(cookies), {
      loginId: ' MEMBER ',
      password: 'correct horse battery staple'
    });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'legacy-user-1', token_hash: expect.any(String) })
    );
    expect(cookies.set).toHaveBeenCalledWith(
      'gdrive_session',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, path: '/' })
    );
  });

  it('rejects an invalid legacy password without creating a session', async () => {
    const passwordHash = await hashPassword('correct horse battery staple');
    const { insertValues } = databaseWithUser({
      id: 'legacy-user-1',
      role: 'member',
      status: 'active',
      login_id: 'member',
      password_hash: passwordHash
    });

    await expect(
      loginWithLegacyPassword(event(), { loginId: 'member', password: 'wrong password' })
    ).rejects.toMatchObject({ status: 401 });
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('accepts a linked account whose password is stored in Better Auth', async () => {
    const passwordHash = await hashPassword('correct horse battery staple');
    const { insertValues } = databaseWithUser(
      {
        id: 'linked-user-1',
        role: 'member',
        status: 'active',
        login_id: 'member',
        password_hash: null,
        auth_user_id: 'auth-user-1'
      },
      passwordHash
    );
    const cookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };

    await loginWithLegacyPassword(event(cookies), {
      loginId: 'member',
      password: 'correct horse battery staple'
    });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'linked-user-1', token_hash: expect.any(String) })
    );
  });

  it('uses the linked credential when a stale legacy hash is still present', async () => {
    const staleHash = await hashPassword('old password value');
    const credentialHash = await hashPassword('current password value');
    const { insertValues } = databaseWithUser(
      {
        id: 'linked-user-2',
        role: 'member',
        status: 'active',
        login_id: 'member-2',
        password_hash: staleHash,
        auth_user_id: 'auth-user-2'
      },
      credentialHash
    );

    await loginWithLegacyPassword(event(), {
      loginId: 'member-2',
      password: 'current password value'
    });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'linked-user-2', token_hash: expect.any(String) })
    );
  });

  it('rejects a linked account without a credential password', async () => {
    const { insertValues } = databaseWithUser({
      id: 'linked-user-3',
      role: 'member',
      status: 'active',
      login_id: 'member-3',
      password_hash: null,
      auth_user_id: 'auth-user-3'
    });

    await expect(
      loginWithLegacyPassword(event(), {
        loginId: 'member-3',
        password: 'correct horse battery staple'
      })
    ).rejects.toMatchObject({ status: 401 });
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('rejects malformed login input before touching the database', async () => {
    const { get } = databaseWithUser(null);

    await expect(
      loginWithLegacyPassword(event(), { loginId: 'ab', password: 'password' })
    ).rejects.toMatchObject({
      status: 400
    });
    await expect(
      loginWithLegacyPassword(event(), { loginId: 'member', password: '' })
    ).rejects.toMatchObject({
      status: 401
    });
    expect(get).not.toHaveBeenCalled();
  });

  it.each([
    ['null body', null],
    ['array body', []],
    ['numeric login id', { loginId: 123, password: 'correct horse battery staple' }],
    ['numeric password', { loginId: 'member', password: 123 }]
  ])('returns a client error for %s instead of throwing a runtime error', async (_label, input) => {
    const { get } = databaseWithUser(null);

    await expect(
      loginWithLegacyPassword(event(), input as unknown as { loginId?: string; password?: string })
    ).rejects.toMatchObject({ status: 400 });
    expect(get).not.toHaveBeenCalled();
  });

  it('restores an active user from the legacy session cookie after login', async () => {
    const user = {
      id: 'linked-user-4',
      status: 'active',
      role: 'member',
      login_id: 'member-4',
      avatar_url: 'data:image/svg+xml;base64,avatar'
    };
    const get = databaseWithLegacySession({ user });
    const cookies = {
      get: vi.fn().mockReturnValue('session-token'),
      set: vi.fn(),
      delete: vi.fn()
    };

    await expect(currentUser(event(cookies))).resolves.toMatchObject({ id: 'linked-user-4' });
    expect(get).toHaveBeenCalledOnce();
  });

  it('does not restore a disabled user from a legacy session cookie', async () => {
    const get = databaseWithLegacySession({
      user: { id: 'disabled-user', status: 'disabled', role: 'member' }
    });
    const cookies = {
      get: vi.fn().mockReturnValue('session-token'),
      set: vi.fn(),
      delete: vi.fn()
    };

    await expect(currentUser(event(cookies))).resolves.toBeNull();
    expect(get).toHaveBeenCalledOnce();
  });
});
