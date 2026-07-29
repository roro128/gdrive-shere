import { describe, expect, it } from 'vitest';
import { googleRequestError, parseGoogleJson } from './google-http-model';

describe('google http model', () => {
  it('parses successful JSON and empty response bodies', () => {
    expect(
      parseGoogleJson<{ id: string }>({ ok: true, status: 200, body: '{"id":"file-1"}' })
    ).toEqual({
      id: 'file-1'
    });
    expect(parseGoogleJson({ ok: true, status: 204, body: '' })).toEqual({});
  });

  it('normalizes HTTP failures and malformed JSON as explicit errors', () => {
    expect(() =>
      parseGoogleJson({ ok: false, status: 403, body: 'forbidden'.repeat(100) })
    ).toThrow(googleRequestError(403, 'forbidden'.repeat(100)));
    expect(() => parseGoogleJson({ ok: true, status: 200, body: '{invalid' })).toThrow(SyntaxError);
  });
});
