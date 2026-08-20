import { describe, expect, it } from 'vitest';
import { createShareLink } from './share-link-client';

describe('share link client', () => {
  it('creates a link for the selected file without exposing other fields', async () => {
    let request: Request | undefined;
    const response = await createShareLink(async (input, init) => {
      request = new Request(new URL(input.toString(), 'https://gshare.test'), init);
      return new Response(JSON.stringify({ link: 'https://gshare.test/api/share-links/token' }), {
        status: 201
      });
    }, 'file-1');

    expect(response.status).toBe(201);
    expect(request?.method).toBe('POST');
    expect(await request?.json()).toEqual({ fileId: 'file-1' });
  });
});
