import { describe, expect, it } from 'vitest';
import type { RequestEvent } from './runtime';
import { assertGoogleAdminEmail, normalizeLoginId } from './auth';

function event(emailList = 'admin@example.com'): RequestEvent {
  return {
    url: new URL('https://gshare.test/'),
    platform: { env: { GOOGLE_ADMIN_EMAILS: emailList } as Env }
  } as RequestEvent;
}

function thrownResponse(action: () => void): Response {
  try {
    action();
  } catch (cause) {
    expect(cause).toBeInstanceOf(Response);
    return cause as Response;
  }
  throw new Error('expected a Response to be thrown');
}

describe('authentication input policy', () => {
  it('normalizes a valid login id before persistence', () => {
    expect(normalizeLoginId('  Member.Name-1  ')).toBe('member.name-1');
  });

  it('rejects malformed login ids at the trust boundary', () => {
    const response = thrownResponse(() => normalizeLoginId('has space'));

    expect(response.status).toBe(400);
  });

  it('requires a verified, configured administrator email', () => {
    expect(() => assertGoogleAdminEmail(event(), 'ADMIN@EXAMPLE.COM', true)).not.toThrow();

    expect(() => assertGoogleAdminEmail(event(), 'admin@example.com', false)).toThrow(Response);
    expect(() => assertGoogleAdminEmail(event(''), 'admin@example.com', true)).toThrow(Response);
    expect(() => assertGoogleAdminEmail(event(), 'other@example.com', true)).toThrow(Response);
  });
});
