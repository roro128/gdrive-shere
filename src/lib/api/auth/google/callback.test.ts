import { describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '$lib/server/runtime';

const createAdminFromGoogle = vi.hoisted(() => vi.fn());
const createSession = vi.hoisted(() => vi.fn());
const currentUser = vi.hoisted(() => vi.fn());
const findAdminByGoogleSubject = vi.hoisted(() => vi.fn());
const assertGoogleAdminEmail = vi.hoisted(() => vi.fn());
const constantTimeEqual = vi.hoisted(() => vi.fn(() => true));
const exchangeGoogleCode = vi.hoisted(() =>
  vi.fn(async () => ({
    subject: 'member-subject',
    email: 'member@example.com',
    emailVerified: true,
    name: 'Member'
  }))
);
const persistGoogleConnection = vi.hoisted(() => vi.fn());
const forbidden = vi.hoisted(() =>
  vi.fn((message: string): never => {
    throw new Response(JSON.stringify({ message }), { status: 403 });
  })
);

vi.mock('$lib/server/auth', () => ({
  createAdminFromGoogle,
  createSession,
  currentUser,
  findAdminByGoogleSubject,
  assertGoogleAdminEmail
}));
vi.mock('$lib/server/crypto', () => ({ constantTimeEqual }));
vi.mock('$lib/server/google', () => ({ exchangeGoogleCode, persistGoogleConnection }));
vi.mock('$lib/server/http', () => ({ forbidden }));
vi.mock('$lib/oauth-mode-model', () => ({
  parseGoogleOAuthMode: (value: string | null) => (value === 'login' ? 'login' : null),
  resolveGoogleOAuthCallbackPlan: () => ({
    createSession: true,
    persistConnection: false,
    requireAdminEmail: true
  })
}));

import { GET } from './callback/+server';

function event(): RequestEvent {
  return {
    request: new Request('https://gshare.test/api/auth/google/callback?code=code&state=state'),
    url: new URL('https://gshare.test/api/auth/google/callback?code=code&state=state'),
    params: {},
    cookies: {
      get: vi.fn((name: string) =>
        name === 'gdrive_google_state'
          ? 'state'
          : name === 'gdrive_google_mode'
            ? 'login'
            : undefined
      ),
      set: vi.fn(),
      delete: vi.fn()
    }
  } as unknown as RequestEvent;
}

describe('Google OAuth callback boundary', () => {
  it('does not create a session for a Google account without an admin record', async () => {
    findAdminByGoogleSubject.mockResolvedValue(null);

    const response = await GET(event());

    expect(response.status).toBe(403);
    expect(assertGoogleAdminEmail).toHaveBeenCalledWith(
      expect.anything(),
      'member@example.com',
      true
    );
    expect(findAdminByGoogleSubject).toHaveBeenCalledWith(expect.anything(), 'member-subject');
    expect(createSession).not.toHaveBeenCalled();
  });
});
