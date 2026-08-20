import { describe, expect, it } from 'vitest';
import { assertSameOrigin, readJson } from './http';

function thrownResponse(action: () => void): Response {
  try {
    action();
  } catch (cause) {
    expect(cause).toBeInstanceOf(Response);
    return cause as Response;
  }
  throw new Error('expected a Response to be thrown');
}

describe('HTTP trust boundaries', () => {
  it('rejects mutation requests without an Origin header', () => {
    const response = thrownResponse(() =>
      assertSameOrigin(
        new Request('https://gshare.test/api/files', { method: 'POST' }),
        'https://gshare.test'
      )
    );

    expect(response.status).toBe(403);
  });

  it('rejects mutation requests from another origin and accepts the exact origin', () => {
    const crossOrigin = thrownResponse(() =>
      assertSameOrigin(
        new Request('https://gshare.test/api/files', {
          method: 'POST',
          headers: { origin: 'https://attacker.test' }
        }),
        'https://gshare.test'
      )
    );
    expect(crossOrigin.status).toBe(403);

    expect(() =>
      assertSameOrigin(
        new Request('https://gshare.test/api/files', {
          method: 'POST',
          headers: { origin: 'https://gshare.test' }
        }),
        'https://gshare.test'
      )
    ).not.toThrow();
  });

  it('rejects oversized JSON bodies before parsing them', async () => {
    const response = await (async () => {
      try {
        await readJson(
          new Request('https://gshare.test/api/me', {
            method: 'POST',
            body: JSON.stringify({ value: 'x'.repeat(2 * 1024 * 1024) }),
            headers: { 'content-type': 'application/json' }
          })
        );
      } catch (cause) {
        expect(cause).toBeInstanceOf(Response);
        return cause as Response;
      }
      throw new Error('expected a Response to be thrown');
    })();

    expect(response.status).toBe(413);
  });

  it('parses a valid JSON body without changing its values', async () => {
    await expect(
      readJson<{ name: string; enabled: boolean }>(
        new Request('https://gshare.test/api/me', {
          method: 'POST',
          body: JSON.stringify({ name: 'GShare', enabled: true }),
          headers: { 'content-type': 'application/json' }
        })
      )
    ).resolves.toEqual({ name: 'GShare', enabled: true });
  });

  it('rejects an empty or malformed JSON body as a bad request', async () => {
    await expect(
      readJson(new Request('https://gshare.test/api/me', { method: 'POST' }))
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      readJson(
        new Request('https://gshare.test/api/me', {
          method: 'POST',
          body: '{',
          headers: { 'content-type': 'application/json' }
        })
      )
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects invalid or oversized content lengths before reading the stream', async () => {
    for (const contentLength of ['not-a-number', String(2 * 1024 * 1024 + 1)]) {
      await expect(
        readJson(
          new Request('https://gshare.test/api/me', {
            method: 'POST',
            body: '{}',
            headers: { 'content-length': contentLength }
          })
        )
      ).rejects.toMatchObject({ status: 413 });
    }
  });
});
