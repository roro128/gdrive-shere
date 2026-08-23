import { describe, expect, it, vi } from 'vitest';
import { hashPassword } from './crypto';
import type { RequestEvent } from './runtime';

const database = vi.hoisted(() => vi.fn());

vi.mock('./db', async () => {
  const actual = await vi.importActual<typeof import('./db')>('./db');
  return { ...actual, database };
});

import { loginWithLegacyPassword } from './auth';

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
  return insertValues;
}

describe('legacy password login compatibility', () => {
  it('accepts an active pre-Better-Auth account and creates a session', async () => {
    const passwordHash = await hashPassword('correct horse battery staple');
    const insertValues = databaseWithUser({
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
    const insertValues = databaseWithUser({
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
    const insertValues = databaseWithUser(
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
});
