import { describe, expect, it } from 'vitest';
import { applySecurityHeaders } from './security-headers';

describe('response security headers', () => {
  it('hardens HTML responses and enables HSTS over HTTPS', async () => {
    const response = applySecurityHeaders(
      new Response('<html></html>', { headers: { 'content-type': 'text/html' } }),
      new Request('https://gshare.test/')
    );

    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(response.headers.get('strict-transport-security')).toBe(
      'max-age=31536000; includeSubDomains'
    );
    await expect(response.text()).resolves.toBe('<html></html>');
  });

  it('does not add document-only or HTTPS-only headers to local API responses', () => {
    const response = applySecurityHeaders(
      new Response('{}', { headers: { 'content-type': 'application/json' } }),
      new Request('http://gshare.test/api/me')
    );

    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('x-frame-options')).toBeNull();
    expect(response.headers.get('strict-transport-security')).toBeNull();
  });
});
