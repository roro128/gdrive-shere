import { describe, expect, it } from 'vitest';
import { uploadChunkWithRetry } from './upload-chunk-workflow';

describe('uploadChunkWithRetry', () => {
  it('retries transient responses and returns the successful response', async () => {
    let attempts = 0;
    const sleeps: number[] = [];
    const response = await uploadChunkWithRetry({
      request: async () => {
        attempts += 1;
        return attempts === 1 ? new Response('retry', { status: 503 }) : new Response(null);
      },
      signal: new AbortController().signal,
      sleep: async (milliseconds) => {
        sleeps.push(milliseconds);
      }
    });

    expect(response.ok).toBe(true);
    expect(attempts).toBe(2);
    expect(sleeps).toEqual([250]);
  });

  it('does not retry a permanent response', async () => {
    let attempts = 0;

    await expect(
      uploadChunkWithRetry({
        request: async () => {
          attempts += 1;
          return new Response(JSON.stringify({ message: 'bad chunk' }), {
            status: 400,
            headers: { 'content-type': 'application/json' }
          });
        },
        signal: new AbortController().signal,
        sleep: async () => undefined
      })
    ).rejects.toThrow('bad chunk');
    expect(attempts).toBe(1);
  });
});
