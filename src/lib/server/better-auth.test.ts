import { describe, expect, it } from 'vitest';
import type { RequestEvent } from './runtime';
import {
  createBetterAuth,
  createPasskeyRegistrationContext,
  isPublicBetterAuthSignUpPath
} from './better-auth';

function event(env?: Partial<Env>): RequestEvent {
  return {
    request: new Request('https://gshare.test/api/auth'),
    url: new URL('https://gshare.test/api/auth'),
    params: {},
    ...(env ? { platform: { env: env as Env } } : {})
  } as RequestEvent;
}

describe('Better Auth public route policy', () => {
  it('blocks the public email signup endpoint, including a trailing slash', () => {
    expect(isPublicBetterAuthSignUpPath('/api/auth/sign-up/email')).toBe(true);
    expect(isPublicBetterAuthSignUpPath('/api/auth/sign-up/email/')).toBe(true);
    expect(isPublicBetterAuthSignUpPath('/api/auth/sign-up/email////')).toBe(true);
    expect(isPublicBetterAuthSignUpPath('/api/auth/sign-up/email/extra')).toBe(false);
    expect(isPublicBetterAuthSignUpPath('/api/auth/sign-in/username')).toBe(false);
  });

  it('fails closed when the Cloudflare runtime or auth secret is missing', () => {
    expect(() => createBetterAuth(event())).toThrow('Cloudflare environment is not configured');
    expect(() => createBetterAuth(event({ DB: {} as D1Database }))).toThrow(
      'AUTH_SECRET or APP_ENCRYPTION_KEY is not configured'
    );
  });

  it('does not create a passkey context without its encryption key', async () => {
    await expect(createPasskeyRegistrationContext(event({}), 'user-1')).rejects.toThrow(
      'APP_ENCRYPTION_KEY is not configured'
    );
  });
});
