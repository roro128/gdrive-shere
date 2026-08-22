import { describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '$lib/server/runtime';

const currentUser = vi.hoisted(() => vi.fn());
const hasUsers = vi.hoisted(() => vi.fn());
const randomToken = vi.hoisted(() => vi.fn(() => 'oauth-state'));
const googleAuthorizeUrl = vi.hoisted(() => vi.fn(() => 'https://accounts.google.test/authorize'));
const forbidden = vi.hoisted(() =>
  vi.fn((message: string): never => {
    throw new Response(JSON.stringify({ message }), { status: 403 });
  })
);

vi.mock('$lib/server/auth', () => ({ currentUser, hasUsers }));
vi.mock('$lib/server/crypto', () => ({ randomToken }));
vi.mock('$lib/server/google', () => ({ googleAuthorizeUrl }));
vi.mock('$lib/server/http', () => ({ forbidden }));
vi.mock('$lib/oauth-mode-model', () => ({
  resolveGoogleOAuthStartMode: (role: string | null, hasExistingUsers: boolean) =>
    role ? 'connect' : hasExistingUsers ? 'login' : 'bootstrap',
  shouldRequestGoogleDriveAccess: (mode: string) => mode !== 'login'
}));

import { GET } from './start/+server';

function event(): RequestEvent {
  return {
    request: new Request('https://gshare.test/api/auth/google/start'),
    url: new URL('https://gshare.test/api/auth/google/start'),
    params: {},
    cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() }
  } as unknown as RequestEvent;
}

describe('Google OAuth start boundary', () => {
  it('rejects a logged-in member before starting the administrator OAuth flow', async () => {
    currentUser.mockResolvedValue({ role: 'member' });

    await expect(GET(event())).rejects.toMatchObject({ status: 403 });

    expect(forbidden).toHaveBeenCalledWith('관리자 로그인이 필요합니다.');
    expect(googleAuthorizeUrl).not.toHaveBeenCalled();
  });
});
