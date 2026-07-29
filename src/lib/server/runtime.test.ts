import { describe, expect, it } from 'vitest';
import {
  appendResponseCookie,
  createCookieState,
  createEventCookies,
  parseCookieHeader,
  serializeCookie
} from './runtime';

describe('runtime cookie functions', () => {
  it('parses cookie values containing equals signs', () => {
    expect(parseCookieHeader('session=a=b; theme=dark')).toEqual({
      session: 'a=b',
      theme: 'dark'
    });
  });

  it('serializes cookie attributes without mutating options', () => {
    const options = { httpOnly: true, sameSite: 'lax' as const, path: '/api' };

    expect(serializeCookie('session', 'a b', options)).toBe(
      'session=a%20b; Path=/api; HttpOnly; SameSite=lax'
    );
    expect(options).toEqual({ httpOnly: true, sameSite: 'lax', path: '/api' });
  });

  it('keeps request parsing and response mutation as separate operations', () => {
    const cookies = createEventCookies(
      new Request('https://gshare.test', { headers: { cookie: 'a=1' } })
    );

    cookies.set('b', '2', { secure: true });

    expect(cookies.get('a')).toBe('1');
    expect(cookies.responseCookies).toEqual(['b=2; Secure']);
  });

  it('returns a new cookie state for every response transition', () => {
    const initial = createCookieState('a=1');
    const next = appendResponseCookie(initial, 'b', '2');

    expect(initial.responseCookies).toEqual([]);
    expect(next.requestCookies).toEqual({ a: '1' });
    expect(next.responseCookies).toEqual(['b=2']);
  });
});
